// dai · construcción de URLs web desde el remoto de git (ADR-0005).
// Deriva repo/branch/commit web URLs sin API del forge. La forma de la URL es
// específica del forge (GitHub / GitLab / Bitbucket), detectada por el host.

// Normaliza un remoto (SSH o HTTPS) a { host, path }.
//   git@github.com:org/repo.git        → { host: github.com, path: org/repo }
//   https://github.com/org/repo.git    → { host: github.com, path: org/repo }
//   ssh://git@host:22/org/repo.git     → { host, path: org/repo }
export function parseRemote(remote) {
  if (!remote) return null;
  let r = remote.trim();

  // scp-like: git@host:org/repo(.git)
  const scp = r.match(/^[\w.-]+@([^:]+):(.+)$/);
  if (scp) return { host: scp[1], path: stripGit(scp[2]) };

  // url-like: (ssh|https|http|git)://[user@]host[:port]/org/repo(.git)
  const url = r.match(/^[a-z]+:\/\/(?:[^@/]+@)?([^:/]+)(?::\d+)?\/(.+)$/i);
  if (url) return { host: url[1], path: stripGit(url[2]) };

  return null;
}

function stripGit(p) {
  return p.replace(/\/+$/, "").replace(/\.git$/, "");
}

// Detecta el forge por el host. Heurística + default GitHub-style.
export function detectForge(host) {
  const h = (host || "").toLowerCase();
  if (h.includes("gitlab")) return "gitlab";
  if (h.includes("bitbucket")) return "bitbucket";
  if (h.includes("github")) return "github";
  return "github"; // default: el esquema más común
}

export function repoWebUrl(remote) {
  const p = parseRemote(remote);
  if (!p) return null;
  return `https://${p.host}/${p.path}`;
}

const SCHEMES = {
  github:    { tree: "/tree/",     commit: "/commit/"  },
  gitlab:    { tree: "/-/tree/",   commit: "/-/commit/" },
  bitbucket: { tree: "/src/",      commit: "/commits/" },
};

export function branchUrl(remote, branch) {
  const base = repoWebUrl(remote);
  if (!base || !branch) return null;
  const s = SCHEMES[detectForge(parseRemote(remote).host)];
  return base + s.tree + encodeURIComponent(branch).replace(/%2F/g, "/");
}

export function commitUrl(remote, sha) {
  const base = repoWebUrl(remote);
  if (!base || !sha) return null;
  const s = SCHEMES[detectForge(parseRemote(remote).host)];
  return base + s.commit + sha;
}
