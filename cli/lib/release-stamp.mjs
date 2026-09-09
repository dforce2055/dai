// dai · el comentario que le avisa a cada User Story en qué versión y en qué ambiente salió.
//
// Es la vuelta completa de la trazabilidad: el `implements.yaml` ata la US al código, el
// `dai stamp` de cobertura ata la US al commit, y esto ata la US a la VERSIÓN DESPLEGADA.
// Con eso, el funcional abre el ticket y ve "esto está en producción desde la v1.2.0" sin
// preguntarle a nadie — que es exactamente lo que un equipo sin versiones no puede contestar.
//
// Dos cuidados que mandan sobre el diseño de este módulo:
//
//   1. Escribe N veces hacia afuera, en tickets de gente distinta, y no se deshace. Por eso
//      el comando muestra el alcance ANTES (cuántos comentarios, en qué tickets) y pide
//      confirmación. Un susto genérico no sirve: el número tiene que ser el real.
//   2. Es OPCIONAL. Si alguien no quiere hacer ruido en veinte tickets, la release ya está
//      hecha: el tag existe, el release note existe. Decir que no no puede romper nada.

// La marca que hace el comentario reconocible para dai mismo. Sin esto no hay forma de
// saber si ya estampamos: redesplegar la misma versión llenaría el ticket de comentarios
// idénticos, y un ticket con cuarenta avisos de deploy no lo lee nadie.
export function releaseMarker({ app, version, environment }) {
  const v = String(version ?? "").replace(/^v/, "");
    return `[dai:release app=${app || "?"} version=${v} env=${String(environment ?? "").toLowerCase() || "?"}]`;
}

// ¿Este comentario ya está puesto? Se compara la marca completa, así que la misma versión
// en OTRO ambiente (o de otra app) no se confunde con una repetición.
export function alreadyStamped(comments = [], marker) {
  return comments.some((c) => String(c ?? "").includes(marker));
}

// El comentario, en markdown. Los backends lo convierten a lo suyo (Jira lo pasa a ADF,
// ClickUp lo manda como texto). Corto a propósito: el detalle vive en el release note,
// y el ticket solo necesita saber qué salió, dónde y cuándo.
export function renderReleaseStamp(ev = {}) {
  const v = `v${String(ev.version ?? "").replace(/^v/, "")}`;
  const amb = String(ev.environment ?? "").toUpperCase();
  const L = [`**${ev.app || "app"} ${v}** desplegada en **${amb}** — ${ev.date || ""}`.trim(), ""];
  if (ev.commit) L.push(`- commit: \`${String(ev.commit).slice(0, 8)}\``);
  if (ev.url) L.push(`- release: ${ev.url}`);
  L.push("");
  L.push(releaseMarker(ev));
  return L.join("\n");
}

// El plan del estampado: a quién le toca, a quién no, y por qué. Se calcula ANTES de
// escribir nada para poder mostrarlo — mostrar "12 US" cuando en realidad se van a escribir
// 9 comentarios es la clase de aviso que la gente aprende a ignorar.
//
//   stories  → las US del manifiesto
//   stamped  → Set de ids que YA tienen la marca de este (app, versión, ambiente)
export function stampPlan({ stories = [], stamped = new Set(), unknown = false } = {}) {
  const pendientes = [], repetidas = [];
  for (const s of stories) (stamped.has(s.id) ? repetidas : pendientes).push(s);
  return { pendientes, repetidas, unknown, total: stories.length };
}

// El aviso de alcance. Es la pantalla que pidió existir: cuántos comentarios, en qué
// tickets, y que no se deshace.
export function renderStampPlan(plan, { app, version, environment, tracker } = {}) {
  const v = `v${String(version ?? "").replace(/^v/, "")}`;
  const L = [];
  L.push(`  ── Estampar despliegue ───────────────────────────────`);
  L.push(`  versión:  ${v}     app: ${app || "?"}     ambiente: ${String(environment ?? "").toUpperCase()}`);
  L.push(`  tracker:  ${tracker || "?"} · ${plan.total} User Storie(s) en el release`);
  L.push(`  ─────────────────────────────────────────────────────`);
  for (const s of plan.pendientes) L.push(`    ${s.id}${s.title ? `  ${s.title}` : ""}`);
  for (const s of plan.repetidas) L.push(`    ${s.id}${s.title ? `  ${s.title}` : ""}   ← ya estampada, se saltea`);
  if (plan.total === 0) L.push(`    (ninguna: el manifiesto de esta versión no declara US)`);
  L.push(`  ─────────────────────────────────────────────────────`);
  if (plan.unknown) {
    L.push(`  ⚠ No pude leer los comentarios del tracker, así que no sé cuáles ya estampé.`);
    L.push(`    Si esta versión ya se estampó en este ambiente, van a salir repetidos.`);
  }
  return L.join("\n");
}

// La frase que decide. Dice el número REAL de escrituras y que no hay vuelta atrás.
export function stampWarning(plan) {
  const n = plan.pendientes.length;
  if (n === 0) return "no hay nada para estampar: todas las US ya tienen esta versión en este ambiente.";
  const saltea = plan.repetidas.length ? ` (${plan.repetidas.length} ya estampada(s), se saltean)` : "";
  return `esto escribe ${n} comentario(s) en el tracker de todo el equipo${saltea}. No se deshace.`;
}

// Lo que se pierde al decir que no. Se dice UNA vez, sin insistir: elegir menos ruido es
// una decisión legítima, no un error a corregir.
export const SIN_ESTAMPAR =
  "sin estampar, el ticket no va a decir en qué versión salió: el registro queda solo en el release note.";
