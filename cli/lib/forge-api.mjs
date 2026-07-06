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
export async function getPR(ref, env = process.env) {
  const res = await fetch(prApiUrl(ref), { headers: authHeaders(ref, env) });
  if (!res.ok) throw new Error(`forge ${res.status}: ${await res.text()}`);
  const j = await res.json();
  return ref.forge === "github"
    ? { title: j.title, state: j.state, body: j.body, branch: j.head?.ref, url: j.html_url }
    : { title: j.title, state: j.state, body: j.description, branch: j.source_branch, url: j.web_url };
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
