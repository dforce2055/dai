// dai · API del forge para review de PR/MR (GitHub + GitLab).
// Cara CLI del "forge adapter": lee la PR y postea el comentario vía REST + token.
// La cara skill (MCP del forge) produce el MISMO comentario estándar.
// Auth: token SCOPEADO (GITHUB_TOKEN / GITLAB_TOKEN), nunca contraseñas. git usa SSH.

import { parseRemote, detectForge } from "./forge-url.mjs";

// Resuelve una referencia de PR/MR: URL completa, o solo un número + el remoto git.
//   → { forge, host, projectPath, owner, repo, number }
export function parsePrRef(input, remote) {
  const s = String(input ?? "").trim();
  const url = s.match(/^https?:\/\/([^/]+)\/(.+?)\/(?:-\/)?(?:pull|merge_requests)\/(\d+)/i);
  if (url) return build(url[1], url[2].replace(/\/+$/, ""), Number(url[3]));
  if (/^\d+$/.test(s)) {
    const r = parseRemote(remote);
    return r ? build(r.host, r.path, Number(s)) : null;
  }
  return null;
}

function build(host, projectPath, number) {
  const forge = detectForge(host);
  const parts = projectPath.split("/");
  return { forge, host, projectPath, owner: parts[0], repo: parts.slice(1).join("/"), number };
}

export function apiBase(ref) {
  if (ref.forge === "github") return ref.host === "github.com" ? "https://api.github.com" : `https://${ref.host}/api/v3`;
  if (ref.forge === "gitlab") return `https://${ref.host}/api/v4`;
  throw new Error(`forge no soportado para review: ${ref.forge} (solo github/gitlab)`);
}

export function prApiUrl(ref) {
  if (ref.forge === "github") return `${apiBase(ref)}/repos/${ref.owner}/${ref.repo}/pulls/${ref.number}`;
  return `${apiBase(ref)}/projects/${encodeURIComponent(ref.projectPath)}/merge_requests/${ref.number}`;
}

export function commentApiUrl(ref) {
  if (ref.forge === "github") return `${apiBase(ref)}/repos/${ref.owner}/${ref.repo}/issues/${ref.number}/comments`;
  return `${apiBase(ref)}/projects/${encodeURIComponent(ref.projectPath)}/merge_requests/${ref.number}/notes`;
}

// El endpoint del review INLINE (resumen + comentarios anclados a archivo:línea).
// Distinto de commentApiUrl, que postea al hilo de la PR: por eso el comentario de dai
// caía al final en vez de dentro del archivo.
//   github → 1 POST con todo (atómico)
//   gitlab → 1 nota (resumen) + 1 discussion por comentario (NO atómico)
export function reviewApiUrl(ref) {
  if (ref.forge === "github") return `${apiBase(ref)}/repos/${ref.owner}/${ref.repo}/pulls/${ref.number}/reviews`;
  if (ref.forge === "gitlab") return `${apiBase(ref)}/projects/${encodeURIComponent(ref.projectPath)}/merge_requests/${ref.number}/discussions`;
  throw new Error(`forge no soportado para review: ${ref.forge} (solo github/gitlab)`);
}

// La posición de un comentario inline según el forge.
//   github → { path, line, side, body }
//   gitlab → position con los TRES shas de diff_refs + new_line/old_line según el lado
export function inlinePosition(ref, c, { diffRefs } = {}) {
  if (ref.forge === "github") return { path: c.path, line: c.line, side: c.side || "RIGHT", body: c.body };
  if (!diffRefs?.base_sha || !diffRefs?.head_sha) {
    throw new Error("gitlab: faltan los diff_refs de la MR (base_sha/head_sha). Sin eso no se puede anclar un comentario.");
  }
  const position = {
    base_sha: diffRefs.base_sha,
    start_sha: diffRefs.start_sha || diffRefs.base_sha,
    head_sha: diffRefs.head_sha,
    position_type: "text",
    new_path: c.path,
    old_path: c.path,
  };
  if ((c.side || "RIGHT") === "LEFT") position.old_line = c.line;
  else position.new_line = c.line;
  return { body: c.body, position };
}

// La variable de entorno que autentica contra este forge, y su valor.
export function tokenVar(ref) { return ref.forge === "gitlab" ? "GITLAB_TOKEN" : "GITHUB_TOKEN"; }
export function tokenFor(ref, env = process.env) { return String(env[tokenVar(ref)] || "").trim(); }

export function authHeaders(ref, env = process.env) {
  if (ref.forge === "github") {
    return { Authorization: `Bearer ${env.GITHUB_TOKEN || ""}`, Accept: "application/vnd.github+json", "User-Agent": "dai" };
  }
  return { "PRIVATE-TOKEN": env.GITLAB_TOKEN || "" };
}

// Traduce el fallo del forge a algo accionable (issue #24).
//
// El mensaje viejo era `¿token? ¿ref correcta?` para TODO: sin token, token vencido,
// token sin scope, PR inexistente y repo privado caían en la misma frase. Costó una
// sesión de diagnóstico equivocado. Cada causa tiene una acción distinta, así que se
// nombran por separado — y "no hay token" se detecta ANTES de salir a la red.
//
// Ojo con el 404 de GitHub: en un repo privado, un token sin permiso devuelve 404 (no
// 403) para no filtrar la existencia del repo. Por eso el 404 nombra las dos causas.
export function describeForgeError(ref, { status = null, body = "", env = process.env, cause = null } = {}) {
  const v = tokenVar(ref);
  const has = tokenFor(ref, env) !== "";
  const where = `${ref.projectPath}#${ref.number} (${ref.host})`;
  const setIt = `  Configuralo en tu .env.dai (o exportalo en la shell):  ${v}=<token>`;

  if (!has) {
    return `no hay ${v} configurado, así que la llamada al forge salió sin credencial.\n` +
      `${setIt}\n` +
      (ref.forge === "github"
        ? "  Token: https://github.com/settings/tokens  ·  scope 'repo' (o fine-grained con Pull requests: read+write)."
        : "  Token: <tu-gitlab>/-/user_settings/personal_access_tokens  ·  scope 'api'.");
  }
  if (status === 401) {
    return `el forge rechazó tu ${v} (401): el token existe pero NO es válido — vencido, revocado, o mal copiado.\n` +
      `  Probalo:  ${ref.forge === "github"
        ? "curl -sI -H \"Authorization: Bearer $GITHUB_TOKEN\" https://api.github.com/user"
        : `curl -sI -H "PRIVATE-TOKEN: $GITLAB_TOKEN" https://${ref.host}/api/v4/user`}\n` +
      `  Si da 200, el token sirve y el problema es otro. Si da 401, generá uno nuevo.\n${setIt}`;
  }
  if (status === 403) {
    const rate = /rate limit|api rate/i.test(String(body));
    return rate
      ? `el forge te frenó por rate limit (403). Esperá unos minutos, o usá un ${v} con más cuota.`
      : `tu ${v} es válido pero NO tiene permiso sobre ${where} (403).\n` +
        `  Le falta scope (github: 'repo' / fine-grained con Pull requests read+write · gitlab: 'api'),\n` +
        "  o tu usuario no tiene acceso a ese repo.";
  }
  if (status === 404) {
    return `el forge no encontró ${where} (404). Dos causas posibles, y no se distinguen desde afuera:\n` +
      "    1. La PR/MR no existe con ese número en ese repo (revisá la ref).\n" +
      `    2. El repo es privado y tu ${v} no tiene permiso — GitHub devuelve 404, no 403, para no filtrar que existe.`;
  }
  if (status != null) return `el forge respondió ${status} sobre ${where}.${body ? `\n  ${String(body).slice(0, 400)}` : ""}`;
  return `no pude hablar con ${ref.host}${cause ? `: ${cause}` : ""}. ¿Hay red / proxy / VPN de por medio?`;
}

// El error que tiran getPR/postComment/postReview lleva el status pegado al mensaje
// (`forge 401: {...}`). Esto lo vuelve a separar para poder explicarlo.
export function parseForgeError(e) {
  const m = String(e?.message || e || "").match(/^forge (\d{3}): ([\s\S]*)$/);
  return m ? { status: Number(m[1]), body: m[2] } : { status: null, body: "", cause: String(e?.message || e || "") };
}

// Comentario estándar de dai-review (mismo formato lo emita el CLI o la skill).
export function renderReviewComment(r) {
  const { us, version, checkStatus, dod, errors = [], improvements = [], good = [] } = r;
  const bul = (arr) => (arr.length ? arr.map((x) => `- ${x}`).join("\n") : "- — ninguno —");
  const head = us
    ? `**US:** \`${us}\`${version ? ` @ ${version}` : ""} · \`dai check\`: ${checkStatus || "?"}`
    : "**US:** _(este PR no declara implementar una US)_";
  return [
    "## 🤖 dai-review",
    "",
    head,
    dod ? `**Definition of Done:** ${dod}` : null,
    "",
    "### 🔴 Errores (correctitud)",
    bul(errors),
    "",
    "### 🟡 Mejoras (calidad, reuso, simplicidad)",
    bul(improvements),
    "",
    "### ✅ Lo que está bien",
    bul(good),
    "",
    "---",
    "_Revisión asistida por dai. La aprobación la firma un humano (Art. 5 del manifiesto)._",
  ].filter((l) => l !== null).join("\n") + "\n";
}

// ── Efectos de red (testeados con fetch mockeado en cli/test) ────────────────
// `baseRef`/`headSha`/`diffRefs` son lo que hace falta para ANCLAR un comentario inline:
// GitHub necesita el sha del head; GitLab exige los tres shas de `diff_refs` en cada
// discussion. Sin esto no se puede postear un review inline.
export async function getPR(ref, env = process.env) {
  const res = await fetch(prApiUrl(ref), { headers: authHeaders(ref, env) });
  if (!res.ok) throw new Error(`forge ${res.status}: ${await res.text()}`);
  const j = await res.json();
  return ref.forge === "github"
    ? { title: j.title, state: j.state, body: j.body, branch: j.head?.ref, url: j.html_url,
        baseRef: j.base?.ref ?? null, headSha: j.head?.sha ?? null, diffRefs: null }
    : { title: j.title, state: j.state, body: j.description, branch: j.source_branch, url: j.web_url,
        baseRef: j.target_branch ?? null, headSha: j.diff_refs?.head_sha ?? null, diffRefs: j.diff_refs ?? null };
}

export async function postComment(ref, body, env = process.env) {
  const res = await fetch(commentApiUrl(ref), {
    method: "POST",
    headers: { ...authHeaders(ref, env), "Content-Type": "application/json" },
    body: JSON.stringify({ body }),
  });
  if (!res.ok) throw new Error(`forge ${res.status}: ${await res.text()}`);
  const j = await res.json();
  return { url: j.html_url || j.web_url || null };
}

// ── Review inline ────────────────────────────────────────────────────────────
// `comments` viene con el body YA renderizado (el render vive en review-findings.mjs;
// acá solo se arma el payload y se postea).
//
// event: "COMMENT", NUNCA "APPROVE" — dai comenta, el humano firma (Art. 5). No es un
// default configurable: es un corte duro.
export async function postReview(ref, { body, comments = [], headSha = null, diffRefs = null }, env = process.env) {
  if (ref.forge === "github") return postReviewGithub(ref, { body, comments, headSha }, env);
  if (ref.forge === "gitlab") return postReviewGitlab(ref, { body, comments, diffRefs }, env);
  throw new Error(`forge no soportado para review: ${ref.forge} (solo github/gitlab)`);
}

// GitHub: TODO en un POST. O entra el review entero o no entra nada.
async function postReviewGithub(ref, { body, comments, headSha }, env) {
  const payload = { event: "COMMENT", body, comments: comments.map((c) => inlinePosition(ref, c)) };
  if (headSha) payload.commit_id = headSha;
  const res = await fetch(reviewApiUrl(ref), {
    method: "POST",
    headers: { ...authHeaders(ref, env), "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`forge ${res.status}: ${await res.text()}`);
  const j = await res.json();
  return { url: j.html_url || null, posted: comments.length, failed: [], atomic: true };
}

// GitLab: NO hay review atómico. Son 1 nota (el resumen) + N discussions sueltas, así que
// si la tercera falla, las dos primeras YA están publicadas. Se mitiga validando todo
// antes de la primera llamada (ver review-findings.mjs), pero no se puede prometer
// atomicidad — así que se reporta qué entró y qué no, en vez de fingirla.
async function postReviewGitlab(ref, { body, comments, diffRefs }, env) {
  const summary = await postComment(ref, body, env);
  const failed = [];
  let posted = 0;
  for (const c of comments) {
    try {
      const res = await fetch(reviewApiUrl(ref), {
        method: "POST",
        headers: { ...authHeaders(ref, env), "Content-Type": "application/json" },
        body: JSON.stringify(inlinePosition(ref, c, { diffRefs })),
      });
      if (!res.ok) throw new Error(`forge ${res.status}: ${await res.text()}`);
      posted++;
    } catch (e) {
      failed.push({ path: c.path, line: c.line, error: String(e.message) });
    }
  }
  return { url: summary.url, posted, failed, atomic: false };
}
