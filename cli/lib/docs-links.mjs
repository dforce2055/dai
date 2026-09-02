// dai · reescribir los links absolutos del sitio cuando la doc se copia afuera.
//
// Los .md de docs/ son la fuente del sitio (VitePress, `base: "/dai/docs/"`), así que las
// capturas se referencian con la ruta absoluta del sitio: `![…](/tutoriales/x.png)`, que
// VitePress resuelve contra docs/public/. Fuera del sitio esa ruta no resuelve a nada: en
// una copia hecha con `dai docs`, `/tutoriales/x.png` apunta a la raíz del filesystem (o
// del repo, si lo renderiza GitHub). O sea que la imagen ya estaba rota en la copia,
// tuviera o no el paquete los 2.9 MB de PNG adentro (issue #37).
//
// Al copiar, esos links se vuelven absolutos contra el sitio publicado: la doc copiada
// muestra las capturas, y el paquete de npm no las carga.

export const SITE_DOCS = "https://dforce2055.github.io/dai/docs";

// Rutas absolutas del sitio que aparecen en los .md. Se listan a propósito en vez de
// reescribir toda `](/…)`: un link a `/etc/hosts` en un ejemplo no es un link del sitio.
const SITE_PATHS = /\]\(\/(tutoriales\/[^)\s]+)\)/g;

// Devuelve el markdown con los links del sitio apuntando al sitio publicado.
// Idempotente: una URL ya absoluta no matchea (el patrón exige `](/`).
export function absolutizeSiteLinks(md) {
  return String(md).replace(SITE_PATHS, (_, path) => `](${SITE_DOCS}/${path})`);
}
