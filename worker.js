
const ORIGIN = "https://radiant-dragon-95a5b9.netlify.app";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

async function createCheckout(request, env) {
  if (!env.STRIPE_SECRET_KEY) {
    return json({ error: "STRIPE_SECRET_KEY non configurée." }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Requête invalide." }, 400);
  }

  const plan = body.plan === "advanced" ? "advanced" : "basic";
  const amount = plan === "advanced" ? 4990 : 2990;

  const productName =
    plan === "advanced"
      ? "GWADAPROJET — Business plan + prévisionnel"
      : "GWADAPROJET — Plan complet";

  const url = new URL(request.url);
  const params = new URLSearchParams();

  params.set("mode", "payment");
  params.set(
    "success_url",
    `${url.origin}/success.html?session_id={CHECKOUT_SESSION_ID}`
  );
  params.set("cancel_url", `${url.origin}/?checkout=cancelled`);

  params.set("billing_address_collection", "required");
  params.set("invoice_creation[enabled]", "true");

  params.set("line_items[0][quantity]", "1");
  params.set("line_items[0][price_data][currency]", "eur");
  params.set(
    "line_items[0][price_data][unit_amount]",
    String(amount)
  );
  params.set(
    "line_items[0][price_data][product_data][name]",
    productName
  );

  params.set("metadata[plan]", plan);

  if (body.email) {
    params.set("customer_email", String(body.email).trim());
  }

  if (body.name) {
    params.set("metadata[name]", String(body.name).trim());
  }

  const response = await fetch(
    "https://api.stripe.com/v1/checkout/sessions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: params.toString()
    }
  );

  const data = await response.json();

  if (!response.ok) {
    return json(
      {
        error:
          data?.error?.message ||
          "Erreur pendant la création du paiement Stripe."
      },
      response.status
    );
  }

  return json({ url: data.url });
}

async function proxy(request) {
  const url = new URL(request.url);

  const target = new URL(
    url.pathname + url.search,
    ORIGIN
  );

  const headers = new Headers(request.headers);
  headers.delete("host");

  const init = {
    method: request.method,
    headers,
    redirect: "follow"
  };

  if (
    request.method !== "GET" &&
    request.method !== "HEAD"
  ) {
    init.body = request.body;
  }

  return fetch(target.toString(), init);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (
      url.pathname === "/api/create-checkout" &&
      request.method === "POST"
    ) {
      return createCheckout(request, env);
    }

    if (url.pathname === "/assets/config.js") {
      return new Response(
        'window.GWADA_CONFIG={checkoutEndpoint:"/api/create-checkout"};',
        {
          headers: {
            "content-type":
              "application/javascript; charset=utf-8",
            "cache-control": "no-store"
          }
        }
      );
    }

    return proxy(request);
  }
};
