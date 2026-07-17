# Roadmap de dai

Hacia dónde va la herramienta. No es un compromiso de fechas: es la dirección, para que
quien evalúa dai sepa qué viene. Las decisiones de fondo se registran como
[ADRs](docs/adr/); este archivo lista lo que todavía no está hecho.

## En curso

- **Sitio de documentación (VitePress).** La metodología, los ADRs y las guías, navegables
  y buscables (⌘K), publicados en GitHub Pages junto a la landing. _(En rama; reemplaza al
  markdown plano + los HTML sueltos.)_

## Próximo — Internacionalización (inglés)

El público de open source es mayoritariamente anglófono y **npm/GitHub muestran el README
primero**: sin inglés, dai pierde adopción antes de que la evalúen. La estrategia ya está
decidida en el **[ADR-0008](docs/adr/0008-estrategia-de-i18n.md)** — _fuente única en
español + traducciones derivadas_, con glosario ES→EN fijo y la regla anti-drift "si
divergen, gana el español". Falta ejecutarla, y abarca **todas las superficies**, no solo
la doc:

| Superficie | Qué implica | Cómo |
|---|---|---|
| **README / npm** | Es lo primero que se ve. Probablemente el `README.md` raíz vaya en inglés (lo muestra npm) + `README.es.md`. | fase 1 |
| **Landing** (`index.html`) | HTML artesanal: una versión por idioma o un toggle. No la cubre el i18n de VitePress. | fase 1 |
| **Docs** (VitePress) | i18n **nativo** de VitePress: un `locales` con `root` (es) + `en`, selector de idioma y buscador por idioma automáticos. Inglés en `docs/en/`. | fase 2 |
| **CLI — mensajes y textos** | Todo lo que imprime `dai` (info, warns, errores, ayuda). `DAI_LANG` (default `es`) + un catálogo `{es,en}` con `t(key)`, **cero dependencias** (ADR-0006). Es un refactor mecánico de literales a `t()`. | fase 3 |
| **Skills** | Se generan en el idioma elegido: `dai init --lang en\|es` copia la variante del `SKILL.md`. | fase 3 |
| **Glosario ES→EN** | Términos fijos (QUÉ→WHAT, estampar→stamp, atrasado→stale, trazabilidad→traceability) para que no varíen entre archivos. Es el insumo de toda traducción. | transversal |

**Nota de trazabilidad:** el ADR-0008 (estado _propuesto_) descartó en su momento adoptar
un generador de docs como VitePress "por sumar tooling pesado". Al haber adoptado VitePress
para el sitio, esa objeción caducó y encima **facilita** el i18n de la doc (lo trae nativo).
Cuando se ejecute esta fase hay que **actualizar el ADR-0008** para registrar ese cambio de
premisa — decisiones sobre decisiones, que es de lo que trata dai.

**Costo real:** el tooling es lo barato; mantener N idiomas en sincronía es lo caro (el ⚠️
del ADR). Se mitiga traduciendo con un agente anclado al glosario y aceptando algo de _lag_
en el inglés. Un detalle práctico: las capturas de los tutoriales de token están con la UI
en español — la versión en inglés necesitaría capturas con la UI en inglés, o una nota de
que son ilustrativas.

## Más adelante

- Probar el review inline (`dai forge review`) contra un **GitLab real** — la asimetría no
  atómica está cubierta por tests pero sin smoke contra un GitLab de verdad ([ADR-0016](docs/adr/0016-review-inline.md)).

> **No en el roadmap, a propósito:** que los reviews salgan con el nombre del humano (su
> token) **es el diseño, no una carencia** — la persona firma y es responsable de lo que
> postea ([Art. 5](docs/MANIFIESTO.md#art-5)). El cuerpo del comentario ya marca que fue
> asistido por IA. Una cuenta bot en autoría iría en contra del ADN de dai: la IA asiste,
> nunca firma.

---

_¿Falta algo que te gustaría ver en dai? Abrí un issue o contá tu caso — el roadmap se
mueve con la comunidad ([CONTRIBUTING.md](CONTRIBUTING.md))._
