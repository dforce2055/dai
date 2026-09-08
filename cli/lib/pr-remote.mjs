// dai · la PR/MR que YA existe para esta branch: cómo buscarla, cómo actualizarla (issue #46).
//
// El bug: con una MR ya abierta, `dai pr` pusheaba la branch (el diff quedaba al día) y
// después `glab mr create` fallaba porque la MR existía. El body NO se actualizaba y lo
// único que se veía era el comando crudo del forge, sin un error legible. Resultado: una
// MR con el diff correcto y una descripción que MIENTE sobre lo que contiene — el peor de
// los dos mundos, porque parece que salió bien.
//
// Acá está la parte pura y testeable: armar los comandos del forge y leer lo que devuelven.
// Los efectos (execFileSync) viven en dai.mjs.

// ── Buscar la PR/MR abierta de una branch ────────────────────────────────────
export function listPrCmd(tool, branch) {
  if (tool === "gh") {
    return ["pr", "list", "--head", branch, "--state", "open", "--limit", "5",
            "--json", "number,url,title,baseRefName"];
  }
  return ["mr", "list", "--source-branch", branch, "--per-page", "5", "--output", "json"];
}

// Normaliza la respuesta de gh/glab a la MISMA forma: { number, url, title, base }.
// Devuelve null si no hay ninguna abierta. Tira si el JSON no parsea — quien llama decide
// si eso es fatal (no lo es: se sigue por el camino de crear, que también sabe fallar bien).
export function parsePrList(tool, stdout) {
  const raw = String(stdout ?? "").trim();
  if (!raw) return null;
  const arr = JSON.parse(raw);
  const list = Array.isArray(arr) ? arr : Array.isArray(arr?.items) ? arr.items : [];
  for (const it of list) {
    // glab devuelve TODAS las MR de la branch si no se filtra por estado: las cerradas y
    // mergeadas no cuentan — reabrir una MR mergeada no es lo que pidió nadie.
    const state = String(it.state ?? "opened").toLowerCase();
    if (!["open", "opened"].includes(state)) continue;
    const number = it.number ?? it.iid ?? null;
    if (number == null) continue;
    return {
      number: Number(number),
      url: it.url ?? it.web_url ?? null,
      title: it.title ?? null,
      base: it.baseRefName ?? it.target_branch ?? null,
    };
  }
  return null;
}

// ── Actualizar el body/título de una PR/MR existente ─────────────────────────
// gh lee el body de un archivo; glab lo toma como string (igual que en `mr create`, que
// ya funciona así). Por eso la firma pide los dos y cada uno usa el que le sirve.
export function updatePrCmd(tool, { number, title, body, bodyFile }) {
  if (tool === "gh") {
    return ["pr", "edit", String(number), "--title", title, "--body-file", bodyFile];
  }
  return ["mr", "update", String(number), "--title", title, "--description", body, "--yes"];
}

// ── "ya existe una PR para esta branch" ──────────────────────────────────────
// El forge lo dice de formas distintas y en inglés. Se reconoce para poder pasar al camino
// de actualizar en vez de morir con el comando crudo en pantalla.
const ALREADY = [
  /already exists/i,
  /a merge request already exists/i,
  /existing (?:pull request|merge request)/i,
  /pull request for branch .* already exists/i,
  /open merge request already exists/i,
];
export function isAlreadyExistsError(msg) {
  const s = String(msg ?? "");
  return ALREADY.some((re) => re.test(s));
}

// Lo que se le muestra al dev cuando dai detecta la PR existente: qué va a pasar con ella.
export function describeUpdate(pr, { base, tool }) {
  const lines = [`ya hay una PR/MR abierta para esta branch: #${pr.number}${pr.url ? ` — ${pr.url}` : ""}`];
  if (pr.base && base && pr.base !== base) {
    lines.push(`ojo: apunta a '${pr.base}' y vos pediste '${base}'. dai NO cambia la base de una PR abierta: ` +
               `si querés otra base, cerrala y creá una nueva.`);
  }
  lines.push(`dai va a ACTUALIZAR su título y su descripción con ${tool} (el diff ya lo actualiza el push).`);
  return lines;
}
