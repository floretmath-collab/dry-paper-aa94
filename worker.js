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

function stripeConfiguration(env) {
  const secretKey = String(env.STRIPE_SECRET_KEY || "").trim();
  const mode = String(env.STRIPE_MODE || "test").toLowerCase() === "live" ? "live" : "test";

  if (!secretKey) {
    return { error: "STRIPE_SECRET_KEY manquante dans Cloudflare." };
  }
  if (mode === "test" && !secretKey.startsWith("sk_test_")) {
    return { error: "Mode test activé : ajoute une clé Stripe commençant par sk_test_." };
  }
  if (mode === "live" && !secretKey.startsWith("sk_live_")) {
    return { error: "Mode réel activé : ajoute une clé Stripe commençant par sk_live_." };
  }

  return { secretKey, mode };
}

function rank(plan) {
  return plan === "advanced" ? 2 : ["basic", "visibility_ai"].includes(plan) ? 1 : 0;
}

function visibilityPage() {
  return new Response(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Visibilité IA — GWADAPROJET</title><style>
  :root{--navy:#0b1f44;--green:#159447;--light:#f4faf7;--purple:#7557d9}*{box-sizing:border-box}body{margin:0;font-family:Inter,system-ui,sans-serif;background:linear-gradient(135deg,#f4faf7,#eef3ff);color:var(--navy)}main{max-width:980px;margin:auto;padding:28px 20px 60px}.brand{font-weight:900;font-size:26px;color:var(--navy);text-decoration:none}.brand span{color:var(--green)}.hero{background:#fff;border-radius:28px;padding:42px;margin-top:28px;box-shadow:0 18px 55px #0b1f4414}.tag{display:inline-block;background:#eee9ff;color:#593db8;padding:8px 14px;border-radius:999px;font-weight:800}h1{font-size:clamp(36px,7vw,64px);line-height:1.03;margin:20px 0}.lead{font-size:20px;color:#536070;max-width:720px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin:28px 0}.card{border:1px solid #dfe8e3;border-radius:18px;padding:20px;background:#fbfdfc}.price{font-size:40px;font-weight:900;margin:24px 0 4px}.small{color:#68746f}.form{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:20px}input{width:100%;padding:14px;border:1px solid #ccd8d2;border-radius:12px;font:inherit}.btn{grid-column:1/-1;border:0;border-radius:14px;padding:16px;background:linear-gradient(90deg,var(--purple),#9b66e6);color:#fff;font-weight:900;font-size:17px;cursor:pointer}.back{display:inline-block;margin-top:22px;color:var(--green);font-weight:800;text-decoration:none}@media(max-width:720px){.hero{padding:25px}.grid,.form{grid-template-columns:1fr}}
  </style></head><body><main><a class="brand" href="/">GWADA<span>PROJET</span></a><section class="hero"><span class="tag">NOUVEAU · INTELLIGENCE ARTIFICIELLE</span><h1>Rends ton entreprise visible grâce à l’IA</h1><p class="lead">GWADAPROJET prépare une base de communication adaptée à ton activité et au marché guadeloupéen, pour publier plus facilement sur les réseaux sociaux.</p><div class="grid"><div class="card"><b>Présentation claire</b><p>Un texte professionnel pour expliquer ton activité et ta valeur.</p></div><div class="card"><b>Idées de publications</b><p>Des sujets concrets pour Facebook, Instagram et tes autres réseaux.</p></div><div class="card"><b>Textes adaptables</b><p>Des modèles que tu peux personnaliser selon tes offres et actualités.</p></div></div><div class="price">19,90 €</div><div class="small">Paiement unique et sécurisé par Stripe</div><div class="form"><input id="name" autocomplete="name" placeholder="Ton nom" maxlength="120"><input id="email" type="email" autocomplete="email" placeholder="Ton e-mail" maxlength="254"><button class="btn" id="buy">Obtenir mon Pack Visibilité IA</button></div><p id="msg" class="small"></p><a class="back" href="/">← Retour à GWADAPROJET</a></section></main><script>
  document.getElementById('buy').onclick=async()=>{const b=document.getElementById('buy'),m=document.getElementById('msg'),name=document.getElementById('name').value.trim(),email=document.getElementById('email').value.trim();if(!name||!email){m.textContent='Indique ton nom et ton e-mail.';return}b.disabled=true;b.textContent='Connexion à Stripe…';m.textContent='';try{const r=await fetch('/.netlify/functions/create-checkout',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({plan:'visibility_ai',name,email})}),d=await r.json();if(!r.ok||!d.url)throw new Error(d.error||'Paiement indisponible');location.href=d.url}catch(e){m.textContent=e.message;b.disabled=false;b.textContent='Obtenir mon Pack Visibilité IA'}};
  </script></body></html>`, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}

function base64url(bytes) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64url(value) {
  const pad = value.replace(/-/g, "+").replace(/_/g, "/");
  const normalized = pad + "=".repeat((4 - (pad.length % 4)) % 4);
  const bin = atob(normalized);
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}

async function entitlementKey(secret) {
  const raw = new TextEncoder().encode("GWADAPROJET_ENTITLEMENT_V1:" + secret);
  const digest = await crypto.subtle.digest("SHA-256", raw);
  return crypto.subtle.importKey(
    "raw",
    digest,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function signEntitlement(payload, stripeSecret) {
  const body = base64url(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await entitlementKey(stripeSecret);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return body + "." + base64url(new Uint8Array(sig));
}

async function verifyEntitlement(token, stripeSecret) {
  if (!token || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;

  try {
    const key = await entitlementKey(stripeSecret);
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      fromBase64url(sig),
      new TextEncoder().encode(body)
    );
    if (!valid) return null;

    const payload = JSON.parse(new TextDecoder().decode(fromBase64url(body)));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

async function stripeRequest(path, stripeSecret, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set("authorization", `Bearer ${stripeSecret}`);
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    ...options,
    headers
  });
  const data = await response.json();
  return { response, data };
}

async function createCheckout(request, env) {
  if (request.method !== "POST") return json({ error: "Méthode non autorisée." }, 405);
  const stripe = stripeConfiguration(env);
  if (stripe.error) return json({ error: stripe.error }, 500);

  let body = {};
  try {
    body = await request.json();
  } catch {
    return json({ error: "Requête invalide." }, 400);
  }

  const products = {
    basic: { amount: 2990, name: "GWADAPROJET — Plan complet 29,90 €" },
    advanced: { amount: 4990, name: "GWADAPROJET — Business plan + prévisionnel 49,90 €" },
    visibility_ai: { amount: 1990, name: "GWADAPROJET — Pack Visibilité IA 19,90 €" }
  };

  const plan = body.plan;
  const product = products[plan];
  const email = String(body.email || "").trim().slice(0, 254);
  const name = String(body.name || "").trim().slice(0, 120);

  if (!product || !email || !name) {
    return json({ error: "Offre, nom ou e-mail invalide." }, 400);
  }

  const base = new URL(request.url).origin;
  const form = new URLSearchParams();
  form.set("mode", "payment");
  form.set("success_url", `${base}/?payment=success&session_id={CHECKOUT_SESSION_ID}`);
  form.set("cancel_url", `${base}/?payment=cancelled`);
  form.set("customer_email", email);
  form.set("client_reference_id", plan + "-" + Date.now());
  form.set("metadata[plan]", plan);
  form.set("metadata[gwadaprojet_mode]", stripe.mode);
  form.set("metadata[customer_name]", name);
  form.set("billing_address_collection", "required");
  form.set("invoice_creation[enabled]", "true");
  form.set("line_items[0][quantity]", "1");
  form.set("line_items[0][price_data][currency]", "eur");
  form.set("line_items[0][price_data][unit_amount]", String(product.amount));
  form.set("line_items[0][price_data][product_data][name]", product.name);

  try {
    const { response, data } = await stripeRequest(
      "checkout/sessions",
      stripe.secretKey,
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: form.toString()
      }
    );

    if (!response.ok) {
      return json({ error: data?.error?.message || "Stripe a refusé la création du paiement." }, 502);
    }

    if (!data?.url) {
      return json({ error: "Stripe n'a pas renvoyé d'URL de paiement." }, 502);
    }

    return json({ url: data.url });
  } catch (e) {
    return json({ error: e?.message || "Erreur serveur Stripe." }, 500);
  }
}

async function verifyPayment(request, env) {
  const stripe = stripeConfiguration(env);
  if (stripe.error) return json({ error: stripe.error }, 500);

  const id = new URL(request.url).searchParams.get("session_id") || "";
  if (!/^cs_/.test(id)) return json({ error: "Session Stripe invalide." }, 400);

  try {
    const { response, data: session } = await stripeRequest(
      "checkout/sessions/" + encodeURIComponent(id),
      stripe.secretKey
    );

    if (!response.ok) {
      return json({ error: session?.error?.message || "Session Stripe introuvable." }, 502);
    }

    const plan = session?.metadata?.plan;
    if (session.payment_status !== "paid" || !["basic", "advanced", "visibility_ai"].includes(plan)) {
      return json({ error: "Le paiement n'est pas confirmé." }, 402);
    }

    const token = await signEntitlement({
      v: 1,
      plan,
      session_id: session.id,
      email: session.customer_details?.email || session.customer_email || "",
      iat: Date.now(),
      exp: Date.now() + 1000 * 60 * 60 * 24 * 365
    }, stripe.secretKey);

    return json({ paid: true, plan, token });
  } catch (e) {
    return json({ error: e?.message || "Erreur de vérification Stripe." }, 500);
  }
}

async function verifyAccess(request, env) {
  if (request.method !== "POST") return json({ error: "Méthode non autorisée." }, 405);
  const stripe = stripeConfiguration(env);
  if (stripe.error) return json({ error: stripe.error }, 500);

  let body = {};
  try {
    body = await request.json();
  } catch {
    return json({ valid: false }, 400);
  }

  const payload = await verifyEntitlement(body.token, stripe.secretKey);
  if (!payload || !["basic", "advanced", "visibility_ai"].includes(payload.plan)) {
    return json({ valid: false }, 401);
  }

  const required = body.requiredPlan;
  if (required && rank(payload.plan) < rank(required)) {
    return json({ valid: false, plan: payload.plan }, 403);
  }

  return json({ valid: true, plan: payload.plan, expiresAt: payload.exp });
}

async function proxyToCurrentSite(request) {
  const incoming = new URL(request.url);
  const target = new URL(ORIGIN);
  target.pathname = incoming.pathname;
  target.search = incoming.search;

  const headers = new Headers(request.headers);
  headers.delete("host");

  const init = {
    method: request.method,
    headers,
    redirect: "follow"
  };

  if (!["GET", "HEAD"].includes(request.method)) {
    init.body = request.body;
  }

  const response = await fetch(target.toString(), init);
  if (request.method !== "GET" || incoming.pathname !== "/" || !response.headers.get("content-type")?.includes("text/html")) return response;

  return new HTMLRewriter().on("body", {
    element(element) {
      element.append(`<section style="max-width:1100px;margin:28px auto;padding:0 20px"><div style="background:linear-gradient(135deg,#251b55,#7557d9);color:white;border-radius:26px;padding:32px;box-shadow:0 18px 50px #251b5530"><div style="font-weight:900;color:#d9ceff">NOUVEAU · VISIBILITÉ IA</div><h2 style="font-size:clamp(28px,5vw,44px);margin:10px 0">Développe ta communication avec l’intelligence artificielle</h2><p style="font-size:18px;max-width:760px;color:#eee9ff">Présentation professionnelle, idées de publications et textes adaptables pour tes réseaux sociaux.</p><a href="/visibilite-ia" style="display:inline-block;margin-top:12px;background:white;color:#4c349e;text-decoration:none;font-weight:900;padding:14px 20px;border-radius:13px">Découvrir le Pack IA — 19,90 €</a></div></section>`, { html: true });
    }
  }).transform(response);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/.netlify/functions/create-checkout") {
      return createCheckout(request, env);
    }

    if (url.pathname === "/.netlify/functions/verify-payment") {
      return verifyPayment(request, env);
    }

    if (url.pathname === "/.netlify/functions/verify-entitlement") {
      return verifyAccess(request, env);
    }

    if (url.pathname === "/visibilite-ia" || url.pathname === "/visibilite-ia/") {
      return visibilityPage();
    }

    return proxyToCurrentSite(request);
  }
};
