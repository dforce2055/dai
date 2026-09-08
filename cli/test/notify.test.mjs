import test from "node:test";
import assert from "node:assert/strict";
import { notifyConfig, describeTarget, renderNotice, payloadFor, sendNotice, explainNotifyError, CANALES_VALIDOS } from "../lib/notify.mjs";
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
test("el aviso son dos líneas: qué salió y a dónde mirar", () => {
  const msg = renderNotice({ event: "deployed", app: "backend", version: "1.2.0", environment: "prod", url: "https://x/r/v1.2.0", stories: ["A-1", "A-2"] });
  assert.equal(msg, "🚀 backend v1.2.0 → PROD · 2 US\nhttps://x/r/v1.2.0");
});

test("sin ambiente el evento es 'publicada', no un deploy", () => {
  const msg = renderNotice({ event: "released", app: "cli", version: "v0.15.0", url: "https://x" });
  assert.match(msg, /^📦 cli v0\.15\.0 publicada\n/);
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

// Texto plano a propósito: sin markdown no hay tres sintaxis incompatibles que conciliar
// ni caracteres que escapar (el MarkdownV2 de Telegram devuelve 400 por un punto suelto).
test("el mensaje no lleva markdown", () => {
  const msg = renderNotice({ app: "backend", version: "1.2.0", environment: "prod", url: "https://x", stories: ["A-1"] });
  assert.doesNotMatch(msg, /[*_`]|\[.*\]\(.*\)|<https?:/);
});

// ── envelopes ────────────────────────────────────────────────────────────────
test("cada canal pone el MISMO texto en su propio campo", () => {
  const ev = { event: "deployed", app: "backend", version: "1.2.0", environment: "prod", url: "https://x", stories: ["A-1"] };
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
  assert.deepEqual(p.stories, ["A-1", "A-2"]);
  assert.match(p.text, /🚀 backend v1\.2\.0 → PROD · 2 US/);   // los dos caminos, en un payload
});

test("todos los canales documentados están implementados", () => {
  assert.deepEqual(CANALES_VALIDOS.sort(), ["discord", "slack", "telegram", "webex", "webhook"]);
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
