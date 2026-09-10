# Contribuir a dai

Gracias por querer mejorar `dai`. Es **software libre (GPLv3)** y la comunidad es
bienvenida — al contribuir, aceptas que tu aporte se distribuya bajo la misma
licencia (ver [`LICENSE`](LICENSE)).

`dai` **usa su propia metodología** (dogfooding). Contribuir es una buena forma de
verla funcionar.

## Setup

Cero dependencias. Solo hace falta **Node ≥ 18**:

```bash
git clone <tu-fork> dai && cd dai
npm test        # 48 tests, sin `npm install` (no hay deps)
```

Opcional, para que los hooks del repo te avisen antes de commitear (cero
dependencias, sin husky):

```bash
git config core.hooksPath .githooks   # valida convención de commits + autoría humana
```

## Reglas de oro

1. **Cero dependencias de runtime.** El CLI corre en redes cerradas sin `npm install`
   (ADR-0006). No agregues paquetes a `dependencies`. Si algo parece necesitar una
   dep, abre un issue a discutir antes.
2. **Test primero (TDD).** Toda lógica nueva del CLI va con su test en `cli/test/`
   (`node --test`). La parte pura y determinista es la que se testea; la red (fetch)
   no se unit-testea, se aísla.
3. **El contrato no se rompe en silencio.** Cambiar el algoritmo del `ac_hash`, el
   schema del `implements.yaml` o la superficie de comandos es un cambio **mayor** y
   necesita un ADR (ver abajo).
4. **Secretos nunca en el repo.** Tokens solo en `.env` (gitignored) o el secret
   store del CI. git usa **SSH**, las APIs usan **tokens scopeados** (ADR-0007).
5. **Autoría humana.** El código de `dai` lo **autora y revisa una persona**. No se
   aceptan commits cuyo *author*, *committer* o `Co-authored-by` sea un agente o bot
   (Cursor, Copilot, Claude, …). Un agente puede ayudarte, pero el cambio lo firmas
   tú: con tu identidad y sin el trailer del agente. Un check de CI lo bloquea en cada
   PR (ver [`governance/human-authorship.md`](governance/human-authorship.md)).
6. **Código en inglés, comentarios en español.** Los identificadores —variables,
   funciones, constantes, claves de objeto— van en **inglés**; los comentarios y la
   documentación, en **español**. Y todo lo que sale por una interfaz de máquina
   (`--json`, el payload de un webhook, los códigos de estado internos) va en inglés
   también: es una API, la lee un script, y traducirla después rompe a quien la consume.

   ```js
   // El endpoint ES la credencial: quien lo tiene, postea.   ← comentario en español
   export function describeTarget(cfg) {                      ← código en inglés
     const target = new URL(cfg.endpoint).host;
   ```

   **La excepción, y es una sola:** los nombres de campo del `implements.yaml` son
   parte del contrato del método, no del código. `autor:` se llama así en el schema
   (ADR-0004) y en todos los repos que ya lo usan; renombrarlo sería romper el
   contrato para ganar consistencia interna, que es el peor cambio posible.

   Lo que **todavía no** cumple esta regla son los **mensajes al usuario**, que hoy son
   literales en español repartidos por todo el CLI. Eso no es un descuido: es el
   refactor que [ADR-0008](docs/adr/0008-estrategia-de-i18n.md) tiene planificado como
   fase 3 (`DAI_LANG` + un catálogo `t(key)` sin dependencias). Mientras tanto, escribí
   los mensajes en español y **no inventes un mecanismo de traducción propio**.

## Flujo (la propia metodología)

1. **Rama** desde `main`: `feature/<slug>` o `fix/<slug>`.
2. **Implementa con tests.** `npm test` en verde antes de abrir el PR.
3. **PR** siguiendo [`templates/pull-request.md`](templates/pull-request.md):
   descripción, testing, y el checklist de Dev + Aprobador.
4. Un **mantenedor revisa y firma** la aprobación (la IA puede dar el primer pase,
   pero aprueba una persona — Art. 5 del [manifiesto](docs/MANIFIESTO.md)).

## Decisiones estructurales → ADR

Si tu cambio toca una decisión de fondo (un contrato, un modelo, la distribución),
escribe un **ADR** con [`templates/adr.md`](templates/adr.md), numerado, en
[`docs/adr/`](docs/adr/). Los ADR son inmutables: si algo cambia, se escribe uno
nuevo que supersede al viejo.

## Convención de commits

`tipo(scope): resumen` — `feat` · `fix` · `docs` · `chore` · `refactor` · `test`.
Ejemplo: `feat(cli): dai stamp reporta el ambiente`. La convención completa (tipos,
reglas, breaking changes) y un hook `commit-msg` que la valida están en
[`governance/commit-convention.md`](governance/commit-convention.md).

## Reportar / proponer

- **Bug** → issue con: qué esperabas, qué pasó, cómo reproducir, versión (`dai --version`).
- **Idea** → issue de discusión antes de un PR grande, para acordar el enfoque.

## Qué hace que un PR entre rápido

- Tests verdes y acotado a una cosa.
- Sin dependencias nuevas.
- Si toca comportamiento, el `README`/docs quedan al día.
- Si toca un contrato, viene con su ADR.
