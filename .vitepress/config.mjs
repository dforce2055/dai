// Config del sitio de docs de dai (VitePress). Fuente: los .md de docs/ (srcDir).
// El sitio se genera a HTML estático y se publica en Pages bajo /dai/docs/.
// La landing (index.html) vive aparte, en la raíz; un link "Docs" las une.
//
// Vive en .vitepress/ en la RAÍZ del repo, NO dentro de docs/: así queda fuera de
// las rutas de package.json "files" y no viaja en el paquete npm (con files[]
// presente, npm ignora .npmignore, así que la única exclusión confiable es la
// ubicación). El CLI sigue cero-dep: vitepress es solo devDependency.

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// .vitepress/ está en la raíz → los .md viven en ../docs.
const DOCS = join(dirname(fileURLToPath(import.meta.url)), "..", "docs");

// Título de un .md: su primer heading `# ...`, o el nombre del archivo si no tiene.
function titulo(rel) {
  try {
    const m = readFileSync(join(DOCS, rel), "utf8").match(/^#\s+(.+)$/m);
    if (m) return m[1].replace(/`/g, "").trim();
  } catch { /* archivo ilegible: cae al nombre */ }
  return rel.split("/").pop().replace(/\.md$/, "");
}

// Items de sidebar para todos los .md de un subdir, ordenados por nombre.
// `salvo` excluye (p. ej. el README que usamos como intro de la sección).
function seccion(subdir, { salvo = [] } = {}) {
  return readdirSync(join(DOCS, subdir))
    .filter((f) => f.endsWith(".md") && !salvo.includes(f))
    .sort()
    .map((f) => ({ text: titulo(`${subdir}/${f}`), link: `/${subdir}/${f.replace(/\.md$/, "")}` }));
}

export default {
  lang: "es-AR",
  title: "dai",
  description: "Desarrollo Asistido por IA — la metodología, los ADRs y las guías.",
  base: "/dai/docs/",
  srcDir: "docs",
  cleanUrls: true,
  lastUpdated: true,
  // Un .md roto no debe tumbar el build del sitio entero.
  ignoreDeadLinks: true,

  // VitePress NO trata README.md como índice de carpeta (GitHub sí). Sin esto, los
  // links de nav /detalle/ y /adr/ dan 404: mapeamos cada README a su index.
  rewrites: {
    "detalle/README.md": "detalle/index.md",
    "adr/README.md": "adr/index.md",
  },

  // El favicon NO recibe el `base` automático: va con el path completo.
  head: [["link", { rel: "icon", type: "image/svg+xml", href: "/dai/docs/favicon.svg" }]],

  themeConfig: {
    // El logo (Sol de Mayo + </>) al lado del nombre "dai" en la barra.
    logo: "/logo.svg",

    // Buscador ⌘K — índice estático, del lado del navegador. Sin servidor ni Algolia.
    search: {
      provider: "local",
      options: {
        translations: {
          button: { buttonText: "Buscar", buttonAriaLabel: "Buscar" },
          modal: {
            noResultsText: "Sin resultados para",
            resetButtonTitle: "Limpiar",
            footer: { selectText: "seleccionar", navigateText: "navegar", closeText: "cerrar" },
          },
        },
      },
    },

    nav: [
      { text: "Inicio", link: "/" },
      { text: "El método", link: "/MANIFIESTO" },
      { text: "Los 10 pasos", link: "/detalle/" },
      {
        text: "Tutoriales",
        items: [
          { text: "Configurar git", link: "/tutoriales/configurar-git" },
          { text: "Claves SSH", link: "/tutoriales/claves-ssh" },
          { text: "Instalar gh / glab", link: "/tutoriales/instalar-glab" },
          { text: "Token de Jira", link: "/tutoriales/token-jira" },
          { text: "Token de ClickUp", link: "/tutoriales/token-clickup" },
        ],
      },
      { text: "Decisiones (ADR)", link: "/adr/" },
      { text: "↩ Landing", link: "https://dforce2055.github.io/dai/" },
    ],

    sidebar: [
      {
        text: "Empezar",
        items: [
          { text: "Inicio", link: "/" },
          { text: titulo("PROBAR.md"), link: "/PROBAR" },
          { text: titulo("EJEMPLO-END-TO-END.md"), link: "/EJEMPLO-END-TO-END" },
        ],
      },
      {
        text: "Tutoriales",
        items: [
          { text: "Configurar git", link: "/tutoriales/configurar-git" },
          { text: "Claves SSH", link: "/tutoriales/claves-ssh" },
          { text: "Instalar gh / glab", link: "/tutoriales/instalar-glab" },
          { text: "Token de Jira", link: "/tutoriales/token-jira" },
          { text: "Token de ClickUp", link: "/tutoriales/token-clickup" },
        ],
      },
      {
        text: "El método",
        items: [
          { text: titulo("MANIFIESTO.md"), link: "/MANIFIESTO" },
          { text: titulo("METODOLOGIA.md"), link: "/METODOLOGIA" },
          { text: titulo("SCRUM-CON-IA.md"), link: "/SCRUM-CON-IA" },
          { text: titulo("glosario.md"), link: "/glosario" },
        ],
      },
      { text: "Los 10 pasos", collapsed: false, items: seccion("detalle", { salvo: ["README.md"] }) },
      { text: "Guías por rol", items: seccion("guias") },
      { text: "Decisiones (ADR)", collapsed: true, items: seccion("adr", { salvo: ["README.md"] }) },
    ],

    outline: { level: [2, 3], label: "En esta página" },
    docFooter: { prev: "Anterior", next: "Siguiente" },
    darkModeSwitchLabel: "Tema",
    sidebarMenuLabel: "Menú",
    returnToTopLabel: "Volver arriba",

    editLink: {
      pattern: "https://github.com/dforce2055/dai/edit/main/docs/:path",
      text: "Editar esta página en GitHub",
    },

    socialLinks: [
      { icon: "github", link: "https://github.com/dforce2055/dai" },
      {
        // VitePress no trae ícono npm nativo: se lo pasamos como SVG inline.
        icon: {
          svg: '<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>npm</title><path d="M1.763 0C.786 0 0 .786 0 1.763v20.474C0 23.214.786 24 1.763 24h20.474c.977 0 1.763-.786 1.763-1.763V1.763C24 .786 23.214 0 22.237 0zM5.13 5.323l13.837.019-.009 13.836h-3.464l.01-10.382h-3.456L12.04 19.17H5.113z"/></svg>',
        },
        link: "https://www.npmjs.com/package/@dforce2055/dai",
        ariaLabel: "dai en npm",
      },
    ],

    footer: {
      message: "Software libre (GPLv3). La IA asiste; la persona firma.",
      copyright: "dai — Desarrollo Asistido por IA",
    },
  },
};
