// dai · aviso de release a un canal de equipo (opcional, opt-in, default apagado).
//
// Tercer adaptador del CLI, con la misma anatomía que los dos que ya existen: una variable
// que elige el backend (DAI_NOTIFY, como DAI_PM) y las variables propias de ese backend.
//
// El mensaje es UNO SOLO para todos los canales: con ESTRUCTURA (qué salió, quién, cuándo,
// qué trae, dónde mirar) pero SIN FORMATO. Esa distinción es la que hace que esto sea una
// tabla y no un módulo de render:
//
//   · la estructura son saltos de línea y viñetas, y se ve igual en los cinco canales,
//   · el formato son cuatro dialectos incompatibles (Discord **negrita** sin links con
//     nombre, Slack *negrita* con <url|texto>, Webex markdown completo, Telegram con su
//     parse_mode y el escapeo de MarkdownV2 que devuelve 400 por un punto suelto),
//   · una URL pelada se vuelve clickeable sola en los cuatro,
//   · y lo único que queda distinto entre proveedores es EN QUÉ CAMPO del JSON va el string.
//
// Las viñetas se cortan en MAX_BULLETS, así que el mensaje no se acerca al límite de
// ningún canal (el más chico es Discord, 2000) y no hay nada que recortar a mano.
//
// El detalle del release vive en el ticket (dai release stamp) y en el release note. El
// canal avisa y linkea: un chat no es un registro, a los dos días nadie lo encuentra.
//
// Lo que esto NO es: un framework de notificaciones. dai avisa eventos de release con su
// manifiesto. Mandar mensajes arbitrarios a un canal no es dai.

import { daiFetch } from "./http.mjs";

// El envelope de cada canal. Esto es el adaptador entero.
const CANALES = {
  discord:  (msg) => ({ content: msg }),
  slack:    (msg) => ({ text: msg }),
  webex:    (msg) => ({ markdown: msg }),
  telegram: (msg, cfg) => ({ chat_id: cfg.chatId, text: msg }),
  // Genérico: los campos estructurados MÁS el texto ya armado. Una integración propia usa
  // los campos; cualquier endpoint estilo Slack (Mattermost, Rocket.Chat, un webhook de
  // Teams) levanta el `text` sin configurar nada. No cuesta una línea más soportar los dos.
  webhook:  (msg, cfg, ev) => ({ ...eventFields(ev), text: msg }),
};

export const CANALES_VALIDOS = Object.keys(CANALES);

// ── Config ───────────────────────────────────────────────────────────────────
// Devuelve null cuando el repo no declaró canal: no avisar es el default, y un default
// que habla hacia afuera sería una sorpresa desagradable.
export function notifyConfig(env = {}) {
  const channel = String(env.DAI_NOTIFY ?? "").trim().toLowerCase();
  if (channel === "" || channel === "none") return null;
  if (!CANALES[channel]) {
    throw new Error(
      `DAI_NOTIFY='${channel}' no es un canal que dai conozca (${CANALES_VALIDOS.join(" | ")} | none).\n` +
      `  Para un destino propio —Teams, Mattermost, un sistema interno— usá 'webhook':\n` +
      `  manda los campos del release en JSON y tu endpoint hace lo que quiera con ellos.`,
    );
  }
  const endpoint = String(env.DAI_NOTIFY_WEBHOOK ?? "").trim();
  if (!endpoint) {
    throw new Error(
      `DAI_NOTIFY=${channel} pero falta DAI_NOTIFY_WEBHOOK en el .env.dai (el endpoint del canal).\n` +
      `  Ese endpoint ES la credencial: quien lo tiene, postea. Nunca lo commitees.`,
    );
  }
  const chatId = String(env.DAI_NOTIFY_CHAT_ID ?? "").trim();
  // Telegram es el raro de los cuatro: no tiene webhooks de entrada. Es token de bot +
  // chat_id, y el token vale para el bot entero, no para un canal — por eso hace falta
  // decir a qué chat. Si falta, el POST sale igual y la API contesta un 400 que no lo explica.
  if (channel === "telegram" && !chatId) {
    throw new Error(
      "DAI_NOTIFY=telegram necesita además DAI_NOTIFY_CHAT_ID (a qué chat postear).\n" +
      "  Telegram no usa webhooks de entrada: el endpoint es el bot y el chat_id el destino.",
    );
  }
  return { channel, endpoint, chatId: chatId || null };
}

// Qué se le muestra al usuario como destino. NUNCA la URL entera: el endpoint es la
// credencial, y un webhook filtrado en una captura de pantalla es un canal comprometido.
export function describeTarget(cfg) {
  if (!cfg) return "sin canal (DAI_NOTIFY no declarado)";
  let host = "(endpoint ilegible)";
  try { host = new URL(cfg.endpoint).host; } catch { /* URL rara: no la mostramos igual */ }
  return `${cfg.channel} · ${host}${cfg.chatId ? ` · chat ${cfg.chatId}` : ""}`;
}

// ── El mensaje ───────────────────────────────────────────────────────────────
// Un evento de release: qué app, qué versión, a dónde fue, y qué US lleva adentro.
//   event: "released"  → se publicó la versión (dai release done)
//   event: "deployed"  → esa versión llegó a un ambiente (dai release stamp --env X)
//   event: "test"      → prueba de canal (dai release notify --test)
function eventFields(ev = {}) {
  return {
    event: `release.${ev.event || "released"}`,
    app: ev.app ?? null,
    version: ev.version ?? null,
    environment: ev.environment ?? null,
    url: ev.url ?? null,
    stories: (Array.isArray(ev.stories) ? ev.stories : []).map((s) => (typeof s === "string" ? { id: s, title: null } : { id: s.id, title: s.title ?? null })),
  };
}

// El texto, uno solo para todos los canales. Con ESTRUCTURA (qué salió, quién, cuándo,
// qué trae, dónde mirar) pero SIN FORMATO: ni negritas ni links con nombre.
//
// La diferencia no es estética, es de costo. La estructura son saltos de línea y viñetas,
// que se ven igual en los cinco canales. El formato son cuatro dialectos incompatibles:
// Discord usa **negrita** y no soporta links con nombre; Slack usa *negrita* de un
// asterisco y <url|texto>; Webex quiere markdown completo; Telegram exige parse_mode y
// escapar media docena de caracteres o devuelve 400. Una URL pelada, en cambio, se vuelve
// clickeable sola en los cuatro.
//
//   🎉 Nuevo release · backend v1.2.0
//   Autor: Ada Lovelace · Fecha: 09/09/2026 08:12 · Ambiente: PRODUCCIÓN
//
//   Cambios principales:
//    • ACME-482  Checkout sin duplicado
//    • ACME-491  Alta de póliza sin duplicar cliente
//
//   Ver release: https://…/releases/v1.2.0
//
// Las viñetas salen de las US del manifiesto, no de los subjects de los commits: lo que
// el equipo quiere leer es qué valor salió, no qué archivos se tocaron. Es la misma
// diferencia entre el QUÉ y el CÓMO que sostiene todo el método.
const MAX_BULLETS = 8;

const dosDigitos = (n) => String(n).padStart(2, "0");
export function formatFecha(d = new Date()) {
  return `${dosDigitos(d.getDate())}/${dosDigitos(d.getMonth() + 1)}/${d.getFullYear()} ` +
         `${dosDigitos(d.getHours())}:${dosDigitos(d.getMinutes())}`;
}

export function renderNotice(ev = {}) {
  if (ev.event === "test") {
    return "✅ Prueba de canal · dai\nSi ves esto, el canal está bien configurado.";
  }
  const app = ev.app ? `${ev.app} ` : "";
  const version = ev.version ? `v${String(ev.version).replace(/^v/, "")}` : "(sin versión)";
  const L = [];
  L.push(ev.environment
    ? `🚀 Release desplegada · ${app}${version} → ${String(ev.environment).toUpperCase()}`
    : `🎉 Nuevo release · ${app}${version}`);

  // Segunda línea: quién y cuándo. Sale de git y del reloj — nada que configurar.
  const meta = [];
  if (ev.author) meta.push(`Autor: ${ev.author}`);
  meta.push(`Fecha: ${ev.date || formatFecha()}`);
  L.push(meta.join(" · "));

  const stories = Array.isArray(ev.stories) ? ev.stories : [];
  if (stories.length) {
    L.push("");
    L.push("Cambios principales:");
    for (const s of stories.slice(0, MAX_BULLETS)) {
      const id = typeof s === "string" ? s : s.id;
      const title = typeof s === "string" ? null : s.title;
      L.push(` • ${id}${title ? `  ${title}` : ""}`);
    }
    if (stories.length > MAX_BULLETS) L.push(` • …y ${stories.length - MAX_BULLETS} más`);
  }
  if (ev.url) { L.push(""); L.push(`Ver release: ${ev.url}`); }
  return L.join("\n");
}

// El cuerpo que se le manda al canal.
export function payloadFor(cfg, ev) {
  const envelope = CANALES[cfg.channel];
  if (!envelope) throw new Error(`canal desconocido: ${cfg.channel}`);
  return envelope(renderNotice(ev), cfg, ev);
}

// ── Efecto de red ────────────────────────────────────────────────────────────
// Un aviso que no sale NO puede voltear una release: para cuando esto corre, el tag ya
// existe y las US ya están estampadas. Por eso devuelve el error en vez de tirarlo —
// quien llama lo reporta como advertencia y sigue.
export async function sendNotice(cfg, ev) {
  try {
    const res = await daiFetch(cfg.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payloadFor(cfg, ev)),
    });
    if (!res.ok) {
      const body = (await res.text().catch(() => "")).slice(0, 300);
      return { ok: false, status: res.status, error: explainNotifyError(cfg, res.status, body) };
    }
    return { ok: true, status: res.status, error: null };
  } catch (e) {
    // El mensaje de daiFetch ya explica el caso de TLS corporativo; acá solo se le pone
    // alrededor qué se estaba haciendo, sin filtrar el endpoint.
    return { ok: false, status: null, error: `no pude avisar a ${describeTarget(cfg)}: ${String(e.message).split("\n")[0]}` };
  }
}

export function explainNotifyError(cfg, status, body = "") {
  const donde = describeTarget(cfg);
  if (status === 401 || status === 403) {
    return `${donde} rechazó el aviso (${status}): el endpoint existe pero no autoriza.\n` +
           "  Revisá DAI_NOTIFY_WEBHOOK en el .env.dai — puede estar revocado o ser de otro espacio.";
  }
  if (status === 404) {
    return `${donde} no existe (404). El webhook fue borrado, o la URL está mal copiada.`;
  }
  if (status === 429) {
    return `${donde} te frenó por rate limit (429). El aviso no salió; el release sí está hecho.`;
  }
  return `${donde} respondió ${status}.${body ? `\n  ${body}` : ""}`;
}
