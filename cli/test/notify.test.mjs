import test from "node:test";
import assert from "node:assert/strict";
import { notifyConfig, describeTarget, renderNotice, payloadFor, sendNotice, explainNotifyError, formatFecha, VALID_CHANNELS } from "../lib/notify.mjs";
import { withMockFetch, mockResponse } from "./helpers.mjs";

const DISCORD = { DAI_NOTIFY: "discord", DAI_NOTIFY_WEBHOOK: "https://discord.com/api/webhooks/1/secreto" };

// ── config ───────────────────────────────────────────────────────────────────
test("sin DAI_NOTIFY no hay canal: no avisar es el default", () => {
  assert.equal(notifyConfig({}), null);
  assert.equal(notifyConfig({ DAI_NOTIFY: "none" }), null);
  assert.equal(notifyConfig({ DAI_NOTIFY: "  " }), null);
});

test("un canal desconocido nombra los válidos y sugiere el genérico", () => {
  assert.throws(() => notifyConfig({ DAI_NOTIFY: "teams" }), /webhook/);
  assert.throws(() => notifyConfig({ DAI_NOTIFY: "teams" }), /no es un canal que dai conozca/);
});

test("un canal declarado sin endpoint falla explicando que el endpoint es la credencial", () => {
  assert.throws(() => notifyConfig({ DAI_NOTIFY: "slack" }), /DAI_NOTIFY_WEBHOOK/);
  assert.throws(() => notifyConfig({ DAI_NOTIFY: "slack" }), /quien lo tiene, postea/);
});

test("telegram es el raro: sin chat_id no se puede saber a dónde postear", () => {
  const env = { DAI_NOTIFY: "telegram", DAI_NOTIFY_WEBHOOK: "https://api.telegram.org/botX/sendMessage" };
  assert.throws(() => notifyConfig(env), /DAI_NOTIFY_CHAT_ID/);
  const cfg = notifyConfig({ ...env, DAI_NOTIFY_CHAT_ID: "-100123" });
  assert.equal(cfg.chatId, "-100123");
});

// El endpoint ES la credencial: un webhook en una captura de pantalla es un canal comprometido.
test("describeTarget muestra el host, NUNCA la URL entera", () => {
  const cfg = notifyConfig(DISCORD);
  const s = describeTarget(cfg);
  assert.match(s, /discord · discord\.com/);
  assert.doesNotMatch(s, /secreto/);
  assert.doesNotMatch(s, /webhooks\/1/);
});

// ── mensaje ──────────────────────────────────────────────────────────────────
const EV = {
  event: "deployed", app: "backend", version: "1.2.0", environment: "prod",
  author: "Ada Lovelace", date: "09/09/2026 08:12", url: "https://x/r/v1.2.0",
  stories: [{ id: "ACME-482", title: "Checkout sin duplicado" }, { id: "ACME-491", title: "Alta de póliza" }],
};

test("el aviso tiene estructura: qué salió, quién, cuándo, qué trae y dónde mirar", () => {
  const msg = renderNotice(EV);
  assert.equal(msg, [
    "🚀 Release desplegada · backend v1.2.0 → PROD",
    "Autor: Ada Lovelace · Fecha: 09/09/2026 08:12",
    "",
    "Cambios principales:",
    " • ACME-482  Checkout sin duplicado",
    " • ACME-491  Alta de póliza",
    "",
    "Ver release: https://x/r/v1.2.0",
  ].join("\n"));
});

test("sin ambiente es un release publicado, no un deploy", () => {
  const msg = renderNotice({ ...EV, environment: null, stories: [] });
  assert.match(msg, /^🎉 Nuevo release · backend v1\.2\.0\n/);
});

// Las viñetas son las US del manifiesto, no los subjects de los commits: lo que el equipo
// quiere leer es qué valor salió, no qué archivos se tocaron.
test("las viñetas se cortan para no mandar un muro de texto al canal", () => {
  const stories = Array.from({ length: 12 }, (_, i) => ({ id: `ACME-${i}`, title: "una historia" }));
  const msg = renderNotice({ ...EV, stories });
  assert.equal((msg.match(/ • /g) || []).length, 9);       // 8 US + la línea del resto
  assert.match(msg, /…y 4 más/);
  assert.ok(msg.length < 2000, "no se acerca al límite del canal más chico (Discord)");
});

test("una US sin título se lista igual, con su id", () => {
  assert.match(renderNotice({ ...EV, stories: [{ id: "ACME-9", title: null }] }), / • ACME-9\n/);
  assert.match(renderNotice({ ...EV, stories: ["ACME-9"] }), / • ACME-9\n/);
});

test("la versión se normaliza a una sola v, venga como venga", () => {
  assert.match(renderNotice({ version: "v1.2.0" }), /v1\.2\.0/);
  assert.match(renderNotice({ version: "1.2.0" }), /v1\.2\.0/);
  assert.doesNotMatch(renderNotice({ version: "v1.2.0" }), /vv/);
});

test("el ambiente se muestra tal como lo escribió el usuario: dai no tiene catálogo", () => {
  assert.match(renderNotice({ version: "1.0.0", environment: "pre" }), /→ PRE/);
  assert.match(renderNotice({ version: "1.0.0", environment: "uat-2" }), /→ UAT-2/);
});

// Estructura sí, formato no: es la línea que evita cuatro renderers y su escapeo.
test("el mensaje no lleva markdown de ningún dialecto", () => {
  const msg = renderNotice(EV);
  assert.doesNotMatch(msg, /\*\*|__|\[.*\]\(.*\)|<https?:/);
});

test("formatFecha usa dd/mm/aaaa hh:mm con ceros a la izquierda", () => {
  assert.equal(formatFecha(new Date(2026, 8, 9, 8, 5)), "09/09/2026 08:05");
});

// ── envelopes ────────────────────────────────────────────────────────────────
test("cada canal pone el MISMO texto en su propio campo", () => {
  const ev = { event: "deployed", app: "backend", version: "1.2.0", environment: "prod", url: "https://x", stories: ["A-1"], date: "09/09/2026 08:12" };
  const msg = renderNotice(ev);
  const mk = (env) => payloadFor(notifyConfig(env), ev);

  assert.deepEqual(mk(DISCORD), { content: msg });
  assert.deepEqual(mk({ DAI_NOTIFY: "slack", DAI_NOTIFY_WEBHOOK: "https://hooks.slack.com/x" }), { text: msg });
  assert.deepEqual(mk({ DAI_NOTIFY: "webex", DAI_NOTIFY_WEBHOOK: "https://webexapis.com/x" }), { markdown: msg });
  assert.deepEqual(mk({ DAI_NOTIFY: "telegram", DAI_NOTIFY_WEBHOOK: "https://api.telegram.org/botX/sendMessage", DAI_NOTIFY_CHAT_ID: "-100" }),
    { chat_id: "-100", text: msg });
});

test("telegram sale sin parse_mode: es lo que evita el escapeo de MarkdownV2", () => {
  const cfg = notifyConfig({ DAI_NOTIFY: "telegram", DAI_NOTIFY_WEBHOOK: "https://api.telegram.org/botX/sendMessage", DAI_NOTIFY_CHAT_ID: "-100" });
  const p = payloadFor(cfg, { version: "1.2.0" });
  assert.equal(p.parse_mode, undefined);
});

test("el canal genérico manda los campos estructurados Y el texto ya armado", () => {
  const cfg = notifyConfig({ DAI_NOTIFY: "webhook", DAI_NOTIFY_WEBHOOK: "https://interno/hook" });
  const p = payloadFor(cfg, { event: "deployed", app: "backend", version: "1.2.0", environment: "prod", url: "https://x", stories: ["A-1", "A-2"] });
  assert.equal(p.event, "release.deployed");
  assert.equal(p.app, "backend");
  assert.equal(p.version, "1.2.0");
  assert.equal(p.environment, "prod");
  assert.deepEqual(p.stories, [{ id: "A-1", title: null }, { id: "A-2", title: null }]);
  assert.match(p.text, /🚀 Release desplegada · backend v1\.2\.0 → PROD/);   // los dos caminos, en un payload
});

test("todos los canales documentados están implementados", () => {
  assert.deepEqual(VALID_CHANNELS.sort(), ["discord", "slack", "telegram", "webex", "webhook"]);
});

// ── red ──────────────────────────────────────────────────────────────────────
test("sendNotice postea JSON al endpoint y reporta el éxito", async () => {
  const cfg = notifyConfig(DISCORD);
  await withMockFetch(() => mockResponse(204, ""), async (calls) => {
    const r = await sendNotice(cfg, { app: "backend", version: "1.2.0", environment: "prod", url: "https://x" });
    assert.equal(r.ok, true);
    assert.equal(calls[0].url, cfg.endpoint);
    assert.equal(calls[0].opts.method, "POST");
    assert.match(JSON.parse(calls[0].opts.body).content, /backend v1\.2\.0/);
  });
});

// Para cuando esto corre, el tag ya existe y las US ya están estampadas: un aviso que no
// sale no puede voltear una release hecha.
test("un aviso que falla se reporta, no se tira: la release ya está hecha", async () => {
  const cfg = notifyConfig(DISCORD);
  await withMockFetch(() => mockResponse(404, "not found"), async () => {
    const r = await sendNotice(cfg, { version: "1.2.0" });
    assert.equal(r.ok, false);
    assert.match(r.error, /404/);
  });
});

test("el error de red tampoco filtra el endpoint", async () => {
  const cfg = notifyConfig(DISCORD);
  await withMockFetch(() => { throw new Error("fetch failed"); }, async () => {
    const r = await sendNotice(cfg, { version: "1.2.0" });
    assert.equal(r.ok, false);
    assert.doesNotMatch(r.error, /secreto/);
  });
});

test("explainNotifyError separa credencial, endpoint borrado y rate limit", () => {
  const cfg = notifyConfig(DISCORD);
  assert.match(explainNotifyError(cfg, 401), /no autoriza/);
  assert.match(explainNotifyError(cfg, 404), /borrado/);
  assert.match(explainNotifyError(cfg, 429), /rate limit/);
  assert.doesNotMatch(explainNotifyError(cfg, 500, "boom"), /secreto/);
});
