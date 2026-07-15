import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFieldsFile, parseFieldOverrides, resolveJiraFields } from "../lib/jira-fields.mjs";

// El caso real que motivó todo esto: un Jira corporativo exige "Tipo de trabajo"
// (customfield_10042), un desplegable Mejora | Corrección que cambia según la US.
const SPEC = {
  Story: {
    clasificacion: { field: "customfield_10042", shape: "select", default: "Mejora", options: ["Mejora", "Corrección"] },
  },
  Epic: {
    clasificacion: { field: "customfield_10042", shape: "select", options: ["Mejora", "Corrección"] },
  },
};

test("parseFieldsFile acepta un archivo bien formado", () => {
  const spec = parseFieldsFile(JSON.stringify(SPEC));
  assert.equal(spec.Story.clasificacion.field, "customfield_10042");
});

test("parseFieldsFile: JSON roto nombra el archivo", () => {
  assert.throws(() => parseFieldsFile("{nope", "x.json"), /x\.json no es JSON válido/);
});

test("parseFieldsFile: falta 'field' → error con la ruta exacta", () => {
  const bad = JSON.stringify({ Story: { clasificacion: { default: "Mejora" } } });
  assert.throws(() => parseFieldsFile(bad), /Story\.clasificacion: falta 'field'/);
});

test("parseFieldsFile: shape desconocido lanza y lista los válidos", () => {
  const bad = JSON.stringify({ Story: { c: { field: "customfield_1", shape: "dropdown" } } });
  assert.throws(() => parseFieldsFile(bad), /shape 'dropdown' desconocido.*select \| text \| multi \| raw/s);
});

test("parseFieldsFile: options tiene que ser lista", () => {
  const bad = JSON.stringify({ Story: { c: { field: "customfield_1", options: "Mejora" } } });
  assert.throws(() => parseFieldsFile(bad), /'options' tiene que ser una lista/);
});

test("parseFieldOverrides: 'alias=valor', repetible", () => {
  assert.deepEqual(parseFieldOverrides("clasificacion=Corrección"), { clasificacion: "Corrección" });
  assert.deepEqual(parseFieldOverrides(["a=1", "b=2"]), { a: "1", b: "2" });
  assert.deepEqual(parseFieldOverrides(undefined), {});
});

test("parseFieldOverrides: el valor puede tener '=' adentro", () => {
  assert.deepEqual(parseFieldOverrides("raw={\"value\":\"x=y\"}"), { raw: '{"value":"x=y"}' });
});

test("parseFieldOverrides: sin '=' explica la forma", () => {
  assert.throws(() => parseFieldOverrides("clasificacion"), /--field espera 'alias=valor'/);
  assert.throws(() => parseFieldOverrides("=Corrección"), /--field espera 'alias=valor'/);
});

test("resolveJiraFields usa el default cuando no hay override", () => {
  const f = resolveJiraFields({ spec: SPEC, issuetype: "Story" });
  assert.deepEqual(f, { customfield_10042: { value: "Mejora" } });
});

test("resolveJiraFields: el override gana sobre el default", () => {
  const f = resolveJiraFields({ spec: SPEC, issuetype: "Story", overrides: { clasificacion: "Corrección" } });
  assert.deepEqual(f, { customfield_10042: { value: "Corrección" } });
});

test("resolveJiraFields: un valor fuera de options falla LOCAL, con la lista", () => {
  assert.throws(
    () => resolveJiraFields({ spec: SPEC, issuetype: "Story", overrides: { clasificacion: "Mejraa" } }),
    /'Mejraa' no es opción de 'clasificacion'[\s\S]*Mejora \| Corrección/,
  );
});

test("resolveJiraFields: declarado sin default y sin override → pide el --field", () => {
  assert.throws(
    () => resolveJiraFields({ spec: SPEC, issuetype: "Epic" }),
    /falta el valor de 'clasificacion'[\s\S]*--field clasificacion=<valor>[\s\S]*Mejora \| Corrección/,
  );
});

test("resolveJiraFields: un --field no declarado lista los que sí", () => {
  assert.throws(
    () => resolveJiraFields({ spec: SPEC, issuetype: "Story", overrides: { prioridad: "Alta" } }),
    /--field 'prioridad' no está declarado[\s\S]*declarados: clasificacion/,
  );
});

test("resolveJiraFields: sin campos declarados para el issuetype → {}", () => {
  assert.deepEqual(resolveJiraFields({ spec: SPEC, issuetype: "Bug" }), {});
  assert.deepEqual(resolveJiraFields({ spec: undefined, issuetype: "Story" }), {});
});

test("resolveJiraFields: el issuetype no distingue mayúsculas", () => {
  assert.deepEqual(resolveJiraFields({ spec: SPEC, issuetype: "story" }), { customfield_10042: { value: "Mejora" } });
});

test("resolveJiraFields: shape se infiere — con options es select, sin options es text", () => {
  const spec = {
    Story: {
      sel: { field: "customfield_1", options: ["A", "B"], default: "A" },
      txt: { field: "customfield_2", default: "hola" },
    },
  };
  assert.deepEqual(resolveJiraFields({ spec, issuetype: "Story" }), {
    customfield_1: { value: "A" },
    customfield_2: "hola",
  });
});

test("resolveJiraFields: shape multi parte por comas y valida cada parte", () => {
  const spec = { Story: { equipos: { field: "customfield_3", shape: "multi", options: ["Web", "API"] } } };
  assert.deepEqual(
    resolveJiraFields({ spec, issuetype: "Story", overrides: { equipos: "Web, API" } }),
    { customfield_3: [{ value: "Web" }, { value: "API" }] },
  );
  assert.throws(
    () => resolveJiraFields({ spec, issuetype: "Story", overrides: { equipos: "Web, Mobile" } }),
    /'Mobile' no es opción de 'equipos'/,
  );
});

test("resolveJiraFields: shape raw pasa cualquier forma que Jira pida", () => {
  const spec = { Story: { sprint: { field: "customfield_9", shape: "raw" } } };
  assert.deepEqual(
    resolveJiraFields({ spec, issuetype: "Story", overrides: { sprint: '{"id":42}' } }),
    { customfield_9: { id: 42 } },
  );
  assert.throws(
    () => resolveJiraFields({ spec, issuetype: "Story", overrides: { sprint: "42abc" } }),
    /shape 'raw' espera JSON válido/,
  );
});

// El molde (templates/jira-fields.example.json) se explica solo con claves "_", porque
// JSON no tiene comentarios y lo edita gente que no escribe código. Tiene que parsear.
test("las claves _ son notas: no son issuetypes ni campos", () => {
  const spec = parseFieldsFile(JSON.stringify({
    _comentario: ["esto es una nota", "y esto también"],
    Story: { _nota: "ojo con esto", clasificacion: { field: "customfield_10042", options: ["A"], default: "A" } },
  }));
  assert.deepEqual(resolveJiraFields({ spec, issuetype: "Story" }), { customfield_10042: { value: "A" } });
  assert.deepEqual(resolveJiraFields({ spec, issuetype: "_comentario" }), {});
});
