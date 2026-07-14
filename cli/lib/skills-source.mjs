// dai · resolución de una fuente de skills externas (`dai skills install --from`).
// Núcleo puro (sin fs ni red): clasifica el argumento en git URL o path local y
// separa el ref (`#branch`/`#tag`). Ver ADR-0013.

// Devuelve { type: 'git'|'path', location, ref }.
//   git   → URL clonable. `host/org/repo` (sin esquema) se normaliza a https://.
//   path  → ruta local (relativa o absoluta). El `ref` se ignora aguas abajo.
//   ref   → lo que va después de '#', o null.
export function parseSource(src) {
  const raw = String(src ?? "").trim();
  if (!raw) throw new Error("fuente vacía (pasá un git URL o un path)");

  // Separar el ref (#branch/tag). El scp de git (git@host:org/repo) no usa '#'.
  let ref = null, loc = raw;
  const hash = raw.lastIndexOf("#");
  if (hash > 0) { ref = raw.slice(hash + 1) || null; loc = raw.slice(0, hash); }

  // Path local explícito (./ ../ / ~/).
  if (/^(\.\.?\/|\/|~\/)/.test(loc)) return { type: "path", location: loc, ref };
  // git por sintaxis de URL (https, ssh, scp git@host:…).
  if (/^(https?:\/\/|ssh:\/\/|git@|[\w.-]+@)/.test(loc)) return { type: "git", location: loc, ref };
  // host/org/repo (p.ej. github.com/org/skills) → git https.
  if (/^[\w.-]+\.[\w.-]+\/.+/.test(loc)) return { type: "git", location: "https://" + loc, ref };
  // Resto: path local relativo sin ./.
  return { type: "path", location: loc, ref };
}
