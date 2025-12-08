// api/magic-pix.js
// API genérica para criar cobrança PIX no gateway Magic (MagicPay)

export default async function handler(req, res) {
  // CORS básico — depois você pode travar para o domínio do Framer
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Pré-flight (CORS)
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  // GET só para teste rápido no navegador
  if (req.method === "GET") {
    res.status(200).json({
      ok: true,
      message: "Magic PIX API ativa. Use POST para criar um PIX.",
    });
    return;
  }

  // A partir daqui, só trabalhamos com POST
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed. Use POST." });
    return;
  }

  try {
    const {
      amount,        // em centavos: 1990 = R$ 19,90
      productName,   // nome da oferta/produto
      customer,      // { name, email, document, phone }
      metadata,      // opcional (vamos converter pra string)
    } = req.body || {};

    // Validação básica dos campos obrigatórios
    if (!amount || !productName || !customer?.name || !customer?.email) {
      res.status(400).json({
        error:
          "Campos obrigatórios: amount, productName, customer.name, customer.email",
      });
      return;
    }

    const url = "https://api.gateway-magicpay.com/v1/transactions";

    // Chaves do gateway Magic (vão vir das variáveis de ambiente na Vercel)
    const publicKey = process.env.MAGIC_PUBLIC_KEY;
    const secretKey = process.env.MAGIC_SECRET_KEY;

    if (!publicKey || !secretKey) {
      res.status(500).json({
        error:
          "Variáveis de ambiente MAGIC_PUBLIC_KEY ou MAGIC_SECRET_KEY não configuradas.",
      });
      return;
    }

    // 1) Normalizar o document: se vier string, converte pra objeto { number, type }
    const normalizedCustomer = {
      ...customer,
      document:
        typeof customer.document === "string"
          ? { number: customer.document, type: "cpf" } // tipo em minúsculo
          : customer.document,
    };

    // 2) Normalizar o metadata: o Magic quer STRING
    let normalizedMetadata = "";
    if (typeof metadata === "string") {
      normalizedMetadata = metadata;
    } else if (metadata && typeof metadata === "object") {
      normalizedMetadata = JSON.stringify(metadata);
    } else {
      normalizedMetadata = ""; // pode deixar vazio
    }

    // Basic Auth: publicKey:secretKey em base64
    const auth =
      "Basic " + Buffer.from(publicKey + ":" + secretKey).toString("base64");

    // Monta o payload conforme a doc do Magic
    const payload = {
      amount,                 // sempre em centavos
      paymentMethod: "pix",   // fixo: PIX
      description: `Compra: ${productName}`,
      customer: normalizedCustomer,
      metadata: normalizedMetadata,
      items: [
        {
          title: productName,
          quantity: 1,
          unitPrice: amount,
          tangible: false,
        },
      ],
    };

    // Chamada para a API do gateway Magic
    const gatewayRes = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: auth,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await gatewayRes.json();

    // Se o gateway retornou erro (status HTTP != 2xx)
    if (!gatewayRes.ok) {
      res.status(gatewayRes.status).json({
        error: "Erro retornado pelo gateway Magic",
        detail: data,
      });
      return;
    }

    // Extrair info de PIX do Magic (tanto topo quanto de raw)
    const pixData = data.pix || data.raw?.pix || null;

    res.status(200).json({
      id: data.id,
      status: data.status,
      qrCode: pixData?.qrcode || null,          // código copia e cola
      expirationDate: pixData?.expirationDate || null,
      receiptUrl: pixData?.receiptUrl || null,
      raw: data, // deixa por enquanto pra debug; depois pode remover se quiser
    });
  } catch (error) {
    console.error("Erro na API Magic PIX:", error);
    res.status(500).json({
      error: "Erro interno ao criar cobrança PIX",
      detail: error.message,
    });
  }
}
