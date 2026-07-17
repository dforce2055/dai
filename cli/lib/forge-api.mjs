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

export function authHeaders(ref, env = process.env) {
  if (ref.forge === "github") {
    return { Authorization: `Bearer ${env.GITHUB_TOKEN || ""}`, Accept: "application/vnd.github+json", "User-Agent": "dai" };
  }
  return { "PRIVATE-TOKEN": env.GITLAB_TOKEN || "" };
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
