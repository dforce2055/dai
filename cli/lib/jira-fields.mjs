// dai · campos obligatorios propios de Jira, declarados por issuetype (cero dependencias).
//
// El Jira de una empresa casi siempre exige campos propios (customfield_NNNNN) que el
// alta de un issue rechaza si faltan. Y su valor no es config fija: "Clasificación" es
// Mejora o Corrección SEGÚN LA US. Un default fijo publicaría todas iguales — un dato
// incorrecto en Jira, en silencio, que es peor que fallar.
//
// Así que se declaran acá, con nombre humano, forma y opciones válidas, y dai valida
// ANTES de llamar a la API: un typo da un error local con la lista, no un 400 críptico.
//
// .dai/jira-fields.json:
//   {
//     "Story": {
//       "clasificacion": {
//         "field":   "customfield_10042",   // el id de Jira (requerido)
//         "shape":   "select",              // opcional — ver SHAPES
//         "default": "Mejora",           // opcional — si falta, --field es obligatorio
//         "options": ["Mejora", "Corrección"]   // opcional — si está, dai valida contra ella
//       }
//     },
//     "Epic": { … }
//   }
//
// Un campo DECLARADO tiene que resolver a un valor (default o --field): se declara porque
// Jira lo exige. Si es opcional, no lo declares.

// Cómo se envuelve el valor para la API de Jira:
//   select → { "value": X }        el caso típico de un desplegable
//   text   → X                     texto plano
//   multi  → [{ "value": X }, …]   lista (el valor se parte por comas)
//   raw    → JSON.parse(X)         escape hatch: cualquier forma que Jira pida
const SHAPES = new Set(["select", "text", "multi", "raw"]);

// JSON no admite comentarios, y este archivo lo edita gente que no escribe código. Las
// claves que empiezan con "_" son notas y se ignoran — así el molde se explica solo.
const isNote = (k) => k.startsWith("_");

// Si no se declara `shape`: con options es un desplegable; sin options, texto.
const shapeOf = (def) => def.shape || (Array.isArray(def.options) ? "select" : "text");

const optionsHint = (def) => (Array.isArray(def.options) && def.options.length ? `\n  válidas: ${def.options.join(" | ")}` : "");

// Valida la estructura del archivo y lo devuelve. Los errores nombran la ruta exacta
// (`Story.clasificacion`) para que se arregle sin adivinar.
export function parseFieldsFile(text, path = ".dai/jira-fields.json") {
  let json;
  try { json = JSON.parse(text); }
  catch (e) { throw new Error(`${path} no es JSON válido: ${e.message}`); }
  if (json === null || typeof json !== "object" || Array.isArray(json)) {
    throw new Error(`${path}: se espera un objeto { "<issuetype>": { "<alias>": {…} } }`);
  }
  for (const [type, entry] of Object.entries(json)) {
    if (isNote(type)) continue;    // JSON no tiene comentarios: las claves _x son notas
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`${path}: '${type}' tiene que ser un objeto de campos`);
    }
    for (const [alias, def] of Object.entries(entry)) {
      if (isNote(alias)) continue;
      const at = `${path}: ${type}.${alias}`;
      if (def === null || typeof def !== "object" || Array.isArray(def)) throw new Error(`${at} tiene que ser un objeto`);
      if (typeof def.field !== "string" || !def.field.trim()) {
        throw new Error(`${at}: falta 'field' (el id de Jira, p. ej. "customfield_10042")`);
      }
      if (def.shape !== undefined && !SHAPES.has(def.shape)) {
        throw new Error(`${at}: shape '${def.shape}' desconocido (${[...SHAPES].join(" | ")})`);
      }
      if (def.options !== undefined && !Array.isArray(def.options)) {
        throw new Error(`${at}: 'options' tiene que ser una lista`);
      }
    }
  }
  return json;
}

// `--field alias=valor` (repetible) → { alias: "valor" }.
export function parseFieldOverrides(input) {
  const list = input === undefined ? [] : Array.isArray(input) ? input : [input];
  const out = {};
  for (const raw of list) {
    if (typeof raw !== "string") throw new Error("--field espera 'alias=valor'");
    const i = raw.indexOf("=");
    if (i <= 0) throw new Error(`--field espera 'alias=valor' (recibí: '${raw}')`);
    out[raw.slice(0, i).trim()] = raw.slice(i + 1);
  }
  return out;
}

// Los campos declarados para un issuetype. Exacto primero, después sin distinguir
// mayúsculas ("story" encuentra "Story"), y {} si no hay nada declarado.
function specFor(spec, issuetype) {
  if (!spec || typeof spec !== "object") return {};
  const lower = String(issuetype).toLowerCase();
  const hit = Object.keys(spec).find((k) => !isNote(k) && (k === issuetype || k.toLowerCase() === lower));
  if (!hit) return {};
  return Object.fromEntries(Object.entries(spec[hit]).filter(([alias]) => !isNote(alias)));
}

function checkOptions(def, alias, value) {
  if (!Array.isArray(def.options) || def.options.length === 0) return;
  const values = shapeOf(def) === "multi" ? value.split(",").map((s) => s.trim()).filter(Boolean) : [value];
  for (const v of values) {
    if (!def.options.includes(v)) throw new Error(`'${v}' no es opción de '${alias}'.${optionsHint(def)}`);
  }
}

function castValue(def, alias, value) {
  switch (shapeOf(def)) {
    case "select": return { value };
    case "text":   return value;
    case "multi":  return value.split(",").map((s) => s.trim()).filter(Boolean).map((v) => ({ value: v }));
    case "raw":
      try { return JSON.parse(value); }
      catch (e) { throw new Error(`--field ${alias}: shape 'raw' espera JSON válido — ${e.message}`); }
    default: throw new Error(`shape '${def.shape}' desconocido en '${alias}'`);
  }
}

// Resuelve los campos declarados para este issuetype al payload que espera la API.
// Lanza (sin tocar la red) si un override no existe, si falta un valor obligatorio,
// o si el valor no está entre las opciones válidas.
export function resolveJiraFields({ spec, issuetype, overrides = {} }) {
  const entry = specFor(spec, issuetype);
  const aliases = Object.keys(entry);

  for (const a of Object.keys(overrides)) {
    if (Object.prototype.hasOwnProperty.call(entry, a)) continue;
    throw new Error(aliases.length
      ? `--field '${a}' no está declarado para el issuetype '${issuetype}'.\n  declarados: ${aliases.join(" | ")}`
      : `--field '${a}': no hay campos declarados para el issuetype '${issuetype}' (revisá el archivo de campos).`);
  }

  const out = {};
  for (const [alias, def] of Object.entries(entry)) {
    const raw = Object.prototype.hasOwnProperty.call(overrides, alias) ? overrides[alias] : def.default;
    if (raw === undefined) {
      throw new Error(`falta el valor de '${alias}' (lo exige el issuetype '${issuetype}').\n  pasalo con:  --field ${alias}=<valor>${optionsHint(def)}`);
    }
    const value = String(raw);
    checkOptions(def, alias, value);
    out[def.field] = castValue(def, alias, value);
  }
  return out;
}
