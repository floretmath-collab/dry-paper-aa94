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
  form.set("success_url", plan === "visibility_ai" ? `${base}/pack-visibilite?session_id={CHECKOUT_SESSION_ID}` : `${base}/?payment=success&session_id={CHECKOUT_SESSION_ID}`);
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


function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function packPage() {
  return new Response(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mon Pack Visibilité IA — GWADAPROJET</title><style>
  :root{--navy:#0b1f44;--green:#159447;--purple:#7557d9;--bg:#f4f7fb}*{box-sizing:border-box}body{margin:0;font-family:Inter,system-ui,sans-serif;background:var(--bg);color:var(--navy)}main{max-width:920px;margin:auto;padding:24px 16px 70px}.brand{font-weight:900;font-size:24px;color:var(--navy);text-decoration:none}.brand span{color:var(--green)}.panel{background:#fff;border-radius:24px;padding:28px;margin-top:22px;box-shadow:0 14px 45px #0b1f4414}h1{font-size:clamp(30px,6vw,50px);margin:8px 0}.lead{color:#5d6876;font-size:18px}.notice{background:#edf9f1;border:1px solid #a7dfb9;border-radius:14px;padding:14px;margin:18px 0}.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}label{font-weight:800;display:block;margin-bottom:6px}input,textarea,select{width:100%;padding:13px;border:1px solid #cbd5df;border-radius:11px;font:inherit}textarea{min-height:92px;resize:vertical}.full{grid-column:1/-1}.btn{border:0;border-radius:13px;padding:15px 18px;background:linear-gradient(90deg,var(--purple),#9b66e6);color:#fff;font-weight:900;font-size:16px;cursor:pointer}.btn.secondary{background:var(--navy)}.result{white-space:pre-wrap;background:#f8fafc;border:1px solid #dbe3ec;border-radius:16px;padding:20px;line-height:1.55}.actions{display:flex;gap:10px;flex-wrap:wrap;margin:16px 0}.hidden{display:none}@media(max-width:680px){.grid{grid-template-columns:1fr}.panel{padding:21px}.full{grid-column:auto}}</style></head><body><main><a class="brand" href="/">GWADA<span>PROJET</span></a><section class="panel"><div id="loading"><h1>Vérification du paiement…</h1><p class="lead">Quelques secondes suffisent.</p></div><div id="denied" class="hidden"><h1>Paiement non confirmé</h1><p class="lead" id="deniedMsg">Nous ne pouvons pas encore ouvrir ton pack.</p><a href="/visibilite-ia">Retour au Pack Visibilité IA</a></div><div id="formWrap" class="hidden"><div class="notice">✓ Paiement confirmé. Complète ces informations pour créer ton pack.</div><h1>Prépare ton Pack Visibilité IA</h1><p class="lead">Tes réponses servent uniquement à adapter les textes à ton activité.</p><div class="grid"><div><label for="business">Nom de l’entreprise</label><input id="business" maxlength="120" placeholder="Ex. Karukéra Services"></div><div><label for="activity">Activité</label><input id="activity" maxlength="160" placeholder="Ex. coiffure à domicile"></div><div class="full"><label for="audience">Clients recherchés</label><textarea id="audience" maxlength="500" placeholder="Qui souhaites-tu attirer ?"></textarea></div><div class="full"><label for="offer">Offre principale</label><textarea id="offer" maxlength="500" placeholder="Que proposes-tu et quel problème résous-tu ?"></textarea></div><div><label for="tone">Ton souhaité</label><select id="tone"><option>Professionnel et chaleureux</option><option>Dynamique et direct</option><option>Simple et rassurant</option><option>Créatif et original</option></select></div><div><label for="channels">Réseaux principaux</label><input id="channels" maxlength="120" value="Facebook et Instagram"></div><div class="full"><button class="btn" id="generate">Créer mon pack maintenant</button></div></div></div><div id="resultWrap" class="hidden"><h1>Ton pack est prêt</h1><p class="lead">Relis et adapte les informations pratiques avant publication.</p><div class="actions"><button class="btn" id="copy">Copier les textes</button><button class="btn secondary" id="download">Télécharger le pack</button></div><div id="result" class="result"></div></div></section></main><script>
  let token='',packText='';const q=new URLSearchParams(location.search),sid=q.get('session_id')||'';
  async function start(){try{const r=await fetch('/api/verify-payment?session_id='+encodeURIComponent(sid)),d=await r.json();if(!r.ok||!d.paid||d.plan!=='visibility_ai')throw new Error(d.error||'Paiement non confirmé.');token=d.token;document.getElementById('loading').classList.add('hidden');document.getElementById('formWrap').classList.remove('hidden')}catch(e){document.getElementById('loading').classList.add('hidden');document.getElementById('denied').classList.remove('hidden');document.getElementById('deniedMsg').textContent=e.message}}
  document.getElementById('generate').onclick=async()=>{const b=document.getElementById('generate'),payload={token,business:document.getElementById('business').value.trim(),activity:document.getElementById('activity').value.trim(),audience:document.getElementById('audience').value.trim(),offer:document.getElementById('offer').value.trim(),tone:document.getElementById('tone').value,channels:document.getElementById('channels').value.trim()};if(!payload.business||!payload.activity||!payload.audience||!payload.offer){alert('Complète les quatre informations principales.');return}b.disabled=true;b.textContent='Création en cours…';try{const r=await fetch('/api/generate-visibility-pack',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)}),d=await r.json();if(!r.ok)throw new Error(d.error||'Création impossible');packText=d.text;document.getElementById('formWrap').classList.add('hidden');document.getElementById('resultWrap').classList.remove('hidden');document.getElementById('result').textContent=packText;scrollTo({top:0,behavior:'smooth'})}catch(e){alert(e.message);b.disabled=false;b.textContent='Créer mon pack maintenant'}};
  document.getElementById('copy').onclick=async()=>{await navigator.clipboard.writeText(packText);document.getElementById('copy').textContent='Copié ✓'};
  document.getElementById('download').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([packText],{type:'text/plain;charset=utf-8'}));a.download='Pack-Visibilite-GWADAPROJET.txt';a.click();URL.revokeObjectURL(a.href)};
  start();
</script></body></html>`, {headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store"}});
}

async function generateVisibilityPack(request, env) {
  if (request.method !== "POST") return json({ error: "Méthode non autorisée." }, 405);
  const stripe = stripeConfiguration(env);
  if (stripe.error) return json({ error: stripe.error }, 500);
  let body = {};
  try { body = await request.json(); } catch { return json({ error: "Requête invalide." }, 400); }
  const access = await verifyEntitlement(body.token, stripe.secretKey);
  if (!access || access.plan !== "visibility_ai") return json({ error: "Accès non autorisé." }, 401);
  const business = String(body.business || "").trim().slice(0,120);
  const activity = String(body.activity || "").trim().slice(0,160);
  const audience = String(body.audience || "").trim().slice(0,500);
  const offer = String(body.offer || "").trim().slice(0,500);
  const tone = String(body.tone || "Professionnel et chaleureux").trim().slice(0,80);
  const channels = String(body.channels || "Facebook et Instagram").trim().slice(0,120);
  if (!business || !activity || !audience || !offer) return json({ error: "Informations incomplètes." }, 400);
  const hashtags = ["#Guadeloupe","#Entrepreneuriat","#EntrepriseLocale","#GWADAPROJET","#" + business.replace(/[^A-Za-zÀ-ÿ0-9]/g,"")].join(" ");
  const text = `PACK VISIBILITÉ IA — GWADAPROJET
Entreprise : ${business}
Activité : ${activity}
Public recherché : ${audience}
Réseaux : ${channels}
Ton : ${tone}

1. PRÉSENTATION PROFESSIONNELLE
${business} propose ${offer}. Notre objectif : accompagner ${audience} avec une approche ${tone.toLowerCase()}, pensée pour les réalités de la Guadeloupe. Contactez-nous pour vérifier ensemble si notre solution correspond à votre besoin.

2. BIO COURTE POUR LES RÉSEAUX
${activity} en Guadeloupe • ${offer} • Informations et contact par message privé.

3. SEPT PUBLICATIONS PRÊTES À ADAPTER

PUBLICATION 1 — PRÉSENTATION
🌴 Bienvenue chez ${business} !
Nous accompagnons ${audience}.
Notre offre : ${offer}
Vous avez une question ? Envoyez-nous un message privé.
${hashtags}

PUBLICATION 2 — LE BESOIN
Vous recherchez une solution pour ${offer} ?
${business} vous explique clairement les possibilités, sans promesse exagérée. Écrivez-nous pour présenter votre besoin.
${hashtags}

PUBLICATION 3 — CONSEIL
Avant de choisir un professionnel, précisez votre objectif, votre budget et votre délai. Ces trois informations permettent de proposer une réponse plus adaptée.
Besoin d’en parler ? Contactez ${business}.
${hashtags}

PUBLICATION 4 — COULISSES
Aujourd’hui, nous préparons nos prochaines prestations pour mieux répondre aux besoins de ${audience}. La qualité commence par une bonne écoute et une organisation sérieuse.
${hashtags}

PUBLICATION 5 — QUESTION
Quelle est votre principale difficulté concernant ${activity} ?
Répondez en commentaire ou par message privé : vos questions nous aideront à partager des conseils réellement utiles.
${hashtags}

PUBLICATION 6 — OFFRE
Notre priorité : proposer une solution claire autour de ${offer}.
Demandez les informations pratiques, les conditions et le tarif avant de décider.
${hashtags}

PUBLICATION 7 — PROXIMITÉ
Entreprise locale en Guadeloupe, ${business} souhaite construire une relation simple et transparente avec ses clients.
Découvrez notre activité et échangeons sur votre projet.
${hashtags}

4. ACCROCHES COURTES
• Une solution locale pour un besoin concret.
• Votre projet mérite une réponse claire.
• Parlons de votre besoin avant de parler de solution.
• En Guadeloupe, développons aussi les entreprises locales.
• Une bonne offre commence par une bonne écoute.

5. APPELS À L’ACTION
• Envoyez-nous un message pour recevoir les informations.
• Décrivez votre besoin en quelques lignes.
• Enregistrez cette publication pour la retrouver.
• Partagez ce conseil avec une personne concernée.
• Demandez les conditions et le tarif sans engagement.

6. PLAN D’ACTION SUR 7 JOURS
Jour 1 : publier la présentation.
Jour 2 : répondre aux messages et noter les questions.
Jour 3 : publier un conseil utile.
Jour 4 : montrer une étape de travail ou les coulisses.
Jour 5 : poser une question au public.
Jour 6 : présenter clairement l’offre et ses conditions.
Jour 7 : mesurer les messages, clics et demandes reçus.

IMPORTANT
Relisez chaque texte, ajoutez vos coordonnées, vos conditions réelles et vos visuels. Ne publiez aucun tarif, délai ou résultat que vous ne pouvez pas garantir.`;
  return json({ text });
}

async function serveSite(request, env) {
  const incoming = new URL(request.url);
  const response = await env.ASSETS.fetch(request);
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

    if (url.pathname === "/.netlify/functions/create-checkout" || url.pathname === "/api/create-checkout") {
      return createCheckout(request, env);
    }

    if (url.pathname === "/.netlify/functions/verify-payment" || url.pathname === "/api/verify-payment") {
      return verifyPayment(request, env);
    }

    if (url.pathname === "/.netlify/functions/verify-entitlement" || url.pathname === "/api/verify-entitlement") {
      return verifyAccess(request, env);
    }

    if (url.pathname === "/visibilite-ia" || url.pathname === "/visibilite-ia/") {
      return visibilityPage();
    }

    if (url.pathname === "/pack-visibilite" || url.pathname === "/pack-visibilite/") {
      return packPage();
    }

    if (url.pathname === "/api/generate-visibility-pack") {
      return generateVisibilityPack(request, env);
    }

    return serveSite(request, env);
  }
};
