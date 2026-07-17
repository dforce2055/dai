// dai · la URL de la US en el tracker. Puro, sync, sin red (ADR-0007: config por .env).
//
// Cadena de resolución, del más específico al más general:
//   1. DAI_TRACKER_URL_TEMPLATE — override explícito del usuario: siempre gana.
//   2. La URL que devolvió el tracker en `fetchUS` — la canónica (ClickUp la trae con
//      el team_id; la derivada no puede saberlo). Solo existe si hubo red.
//   3. Derivada del backend + su config — determinística y offline.
//   4. `null` — dai NO sabe la URL.
//
// El paso 4 es el que importa. Antes devolvíamos el `id` pelado, y como un string es
// truthy, quien consumía esto lo escribía igual — un id disfrazado de enlace, sin un
// solo aviso. Preferimos no decir nada antes que mentir: quien llama decide si omite
// la línea o avisa.

// URL web de la US deducida del backend, sin salir a la red.
export function deriveTrackerUrl(id, env = {}) {
  if (!id) return null;
  const kind = String(env.DAI_PM || "md").toLowerCase();
  if (kind === "clickup") {
    // /t/<id> redirige a la canónica /t/<team_id>/<id>. Sin token no sabemos el team.
    return `https://app.clickup.com/t/${encodeURIComponent(id)}`;
  }
  if (kind === "jira") {
    const base = String(env.DAI_JIRA_BASE_URL || "").replace(/\/+$/, "");
    return base ? `${base}/browse/${encodeURIComponent(id)}` : null;
  }
  return null;   // md: la US es un archivo local, no tiene URL web
}

// La URL final, o null si no hay forma de saberla. `liveUrl` es la que trajo fetchUS.
export function trackerUrl(id, { env = {}, liveUrl = null } = {}) {
  if (!id) return null;
  const tpl = env.DAI_TRACKER_URL_TEMPLATE;
  if (tpl) return String(tpl).replace(/\{id\}/g, id);
  return liveUrl || deriveTrackerUrl(id, env);
}
