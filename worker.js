const PRODUCTS = {
  basic: { amount: 2990, name: "GWADAPROJET — Plan complet 29,90 €" },
  advanced: { amount: 4990, name: "GWADAPROJET — Business plan + prévisionnel 49,90 €" },
};

const encoder = new TextEncoder();

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function getSecrets(env) {
  // Prefer the newest valid secret configured as SECRET in Cloudflare.
  // Older variable names remain fallbacks only.
  const stripe = String(env.SECRET || env.Secret || env.STRIPE_SECRET_KEY || "").trim();
  if (!stripe) throw new Error("Clé Stripe non configurée dans Cloudflare.");
  if (stripe.includes("*") || stripe.includes("...") || !/^(?:sk|rk)_(?:test|live)_[A-Za-z0-9]+$/.test(stripe)) {
    throw new Error("La clé Stripe Cloudflare est masquée ou invalide. Utilisez la clé complète sk_live_… ou rk_live_….");
  }
  const entitlement = env.GWADA_ENTITLEMENT_SECRET || stripe;
  return { stripe, entitlement };
}

function toBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function fromBase64Url(value) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(normalized + "=".repeat((4 - (normalized.length % 4)) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function hmac(value, secret) {
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

async function signEntitlement(payload, secret) {
  const body = toBase64Url(encoder.encode(JSON.stringify(payload)));
  return `${body}.${toBase64Url(await hmac(body, secret))}`;
}

async function verifyEntitlement(token, secret) {
  if (!token || !token.includes(".")) return null;
  try {
    const [body, signature] = token.split(".");
    const expected = await hmac(body, secret);
    const received = fromBase64Url(signature);
    if (expected.length !== received.length) return null;
    let difference = 0;
    for (let index = 0; index < expected.length; index += 1) difference |= expected[index] ^ received[index];
    if (difference !== 0) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(body)));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function rank(plan) {
  return plan === "advanced" ? 2 : plan === "basic" ? 1 : 0;
}

async function stripeRequest(path, options, stripe) {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${stripe}`, ...(options?.headers || {}) },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || "Stripe a refusé la requête.");
  return data;
}

async function createCheckout(request, env) {
  if (request.method !== "POST") return json({ error: "Méthode non autorisée." }, 405);
  const { stripe } = getSecrets(env);
  const body = await request.json();
  const product = PRODUCTS[body.plan];
  const email = String(body.email || "").trim().slice(0, 254);
  const name = String(body.name || "").trim().slice(0, 120);
  if (!product || !email || !name) return json({ error: "Offre, nom ou e-mail invalide." }, 400);

  const origin = new URL(request.url).origin;
  const form = new URLSearchParams({
    mode: "payment",
    success_url: `${origin}/?payment=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/?payment=cancelled`,
    customer_email: email,
    client_reference_id: `${body.plan}-${Date.now()}`,
    "metadata[plan]": body.plan,
    "metadata[customer_name]": name,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "eur",
    "line_items[0][price_data][unit_amount]": String(product.amount),
    "line_items[0][price_data][product_data][name]": product.name,
    billing_address_collection: "required",
    "invoice_creation[enabled]": "true",
  });
  const session = await stripeRequest("checkout/sessions", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  }, stripe);
  return json({ url: session.url });
}

async function verifyPayment(request, env) {
  const { stripe, entitlement } = getSecrets(env);
  const sessionId = new URL(request.url).searchParams.get("session_id") || "";
  if (!/^cs_(test_)?[A-Za-z0-9]+$/.test(sessionId)) return json({ error: "Session Stripe invalide." }, 400);
  const session = await stripeRequest(`checkout/sessions/${encodeURIComponent(sessionId)}`, {}, stripe);
  const plan = session?.metadata?.plan;
  if (session.payment_status !== "paid" || !PRODUCTS[plan]) {
    return json({ error: "Le paiement n'est pas confirmé." }, 402);
  }
  const token = await signEntitlement({
    v: 1,
    plan,
    session_id: session.id,
    email: session.customer_details?.email || session.customer_email || "",
    iat: Date.now(),
    exp: Date.now() + 1000 * 60 * 60 * 24 * 365,
  }, entitlement);
  return json({ paid: true, plan, token });
}

async function checkEntitlement(request, env) {
  if (request.method !== "POST") return json({ error: "Méthode non autorisée." }, 405);
  const { entitlement } = getSecrets(env);
  const body = await request.json();
  const payload = await verifyEntitlement(body.token, entitlement);
  if (!payload || !PRODUCTS[payload.plan]) return json({ valid: false }, 401);
  if (body.requiredPlan && rank(payload.plan) < rank(body.requiredPlan)) {
    return json({ valid: false, plan: payload.plan }, 403);
  }
  return json({ valid: true, plan: payload.plan, expiresAt: payload.exp });
}

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    try {
      if (path === "/api/create-checkout") return await createCheckout(request, env);
      if (path === "/api/verify-payment") return await verifyPayment(request, env);
      if (path === "/api/verify-entitlement") return await checkEntitlement(request, env);
      return env.ASSETS.fetch(request);
    } catch (error) {
      return json({ error: error?.message || "Erreur serveur." }, 500);
    }
  },
};
