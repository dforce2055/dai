// dai · comparación mínima de versiones semver (X.Y.Z). Cero dependencias.
// Se usa para el chequeo de version-drift (`dai doctor`) y `dai sync` (ADR-0010).

export function parseVersion(v) {
  const m = String(v ?? "").trim().match(/^(\d+)\.(\d+)\.(\d+)/);
  return m ? { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) } : null;
}

// -1 / 0 / 1 (a<b / a==b / a>b), o null si alguna no parsea.
export function compareVersions(a, b) {
  const pa = parseVersion(a), pb = parseVersion(b);
  if (!pa || !pb) return null;
  const d = (pa.major - pb.major) || (pa.minor - pb.minor) || (pa.patch - pb.patch);
  return d < 0 ? -1 : d > 0 ? 1 : 0;
}

// Estado del scaffold del repo (repoV, de `.dai/VERSION`) frente al CLI instalado (cliV):
//   current      → iguales
//   minor-behind → CLI adelante, MISMA major (refresh opcional con `dai sync`, nada roto)
//   major-behind → CLI adelante, major DISTINTA (revisar CHANGELOG/MIGRATION antes)
//   cli-behind   → el repo se scaffoldeó con una versión más nueva que el CLI (actualizá el CLI)
//   unknown      → alguna versión no parseable
export function versionDrift(repoV, cliV) {
  const r = parseVersion(repoV), c = parseVersion(cliV);
  if (!r || !c) return "unknown";
  const cmp = compareVersions(cliV, repoV);
  if (cmp === 0) return "current";
  if (cmp < 0) return "cli-behind";
  return c.major > r.major ? "major-behind" : "minor-behind";
}

// Plan de `dai upgrade` (ADR-0012): compara el CLI instalado (currentV) con la
// última publicada en el registry (latestV). Núcleo puro; el I/O (npm view /
// npm i -g) vive en el comando.
//   up-to-date → iguales                        → { action, version }
//   ahead      → el CLI local es más nuevo       → { action, current, latest }
//   upgrade    → hay una versión más nueva        → { action, from, to }
//   unknown    → alguna versión no parsea         → { action }
export function planUpgrade(currentV, latestV) {
  const cmp = compareVersions(currentV, latestV);
  if (cmp === null) return { action: "unknown" };
  if (cmp === 0) return { action: "up-to-date", version: currentV };
  if (cmp > 0) return { action: "ahead", current: currentV, latest: latestV };
  return { action: "upgrade", from: currentV, to: latestV };
}
