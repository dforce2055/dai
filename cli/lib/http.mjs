// dai · fetch con diagnóstico de TLS (cero dependencias).
//
// En una red corporativa el proxy suele interceptar TLS con una CA propia. Node NO usa
// el trust store del sistema (trae su propia lista de CAs), así que falla justo donde el
// navegador anda — y el error crudo de undici no dice nada de eso.
//
// El fix es DECLARAR la CA (NODE_EXTRA_CA_CERTS), nunca apagar la verificación:
// NODE_TLS_REJECT_UNAUTHORIZED=0 hace que la conexión acepte CUALQUIER certificado, y
// por acá viajan los tokens del tracker. Este módulo existe para que el que se topa con
// el muro encuentre el camino correcto antes que el atajo peligroso.

const TLS_CODES = new Set([
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
  "SELF_SIGNED_CERT_IN_CHAIN",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "CERT_HAS_EXPIRED",
  "ERR_TLS_CERT_ALTNAME_INVALID",
]);

// Extrae el código de error TLS de un fallo de fetch, o null si no es de TLS.
// undici anida el error real en `cause` (a veces dos niveles).
export function tlsErrorCode(e) {
  for (let cur = e, depth = 0; cur && depth < 4; cur = cur.cause, depth++) {
    const code = cur.code;
    if (code && TLS_CODES.has(code)) return code;
  }
  return null;
}

export function tlsHint(host, code) {
  return [
    `no pude verificar el certificado TLS de ${host} (${code}).`,
    "",
    "  Casi siempre es un proxy corporativo que intercepta TLS con su propia CA. Node no",
    "  usa el trust store de Windows/macOS, por eso el navegador anda y dai no.",
    "",
    "  Solución: exportá la CA raíz de tu empresa a un .pem y declarásela a Node:",
    "    Windows (PowerShell):  $env:NODE_EXTRA_CA_CERTS=\"C:\\ruta\\ca-empresa.pem\"",
    "    macOS / Linux:         export NODE_EXTRA_CA_CERTS=/ruta/ca-empresa.pem",
    "",
    "  NO uses NODE_TLS_REJECT_UNAUTHORIZED=0. Eso no arregla nada: apaga la verificación",
    "  entera, y tu token del tracker viajaría aceptando cualquier certificado — incluido",
    "  el de alguien haciéndose pasar por el tracker.",
  ].join("\n");
}

// fetch, pero traduciendo el fallo de TLS a un error accionable.
export async function daiFetch(url, init) {
  try {
    return await fetch(url, init);
  } catch (e) {
    const code = tlsErrorCode(e);
    if (!code) throw e;
    let host = String(url);
    try { host = new URL(url).host; } catch { /* url rara: mostramos lo que vino */ }
    const err = new Error(tlsHint(host, code));
    err.cause = e;
    throw err;
  }
}
