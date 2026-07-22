# Ejemplo end-to-end — El "golden path"

> **Para qué sirve.** Es la pieza que la gente copia. Una User Story real viajando
> de *idea vaga* a *desplegada*, mostrando **el artefacto concreto que produce cada
> uno de los 10 pasos** de [`SCRUM-CON-IA.md`](SCRUM-CON-IA.md). Si tienes que
> mostrar la metodología en una sola lectura, es esta.
>
> Dominio del ejemplo: **un carrito de compras** (checkout). Los nombres
> (`ABC-482`, `frontend`) son ilustrativos.

## El mapa: qué artefacto sale de cada paso

| Paso | Skill / evento | Artefacto que produce |
|---|---|---|
| 1 Refinamiento | `grill-user-story` → `grill-intent` (Gate 0) | la **US** (`ABC-482`) + `intent.md` |
| 2 Planning | `opsx:propose` | `proposal.md` + `design.md` + `tasks.md` + `specs/` |
| 3 Rama | `link-us` | branch + `implements.yaml` |
| 4 Implementación | `opsx:apply` (con TDD) | test (RED) → código (GREEN), por el agente |
| 5 Smoke | skill de smoke | escenario end-to-end verde |
| 6 Code review | review propio del dev → `dai pr` → partner (con `/dai-review`) | PR (código + spec) + aprobación |
| 7 Merge | `dai stamp` | cobertura estampada en el tracker |
| 8 Daily | — (humano) | sincronización verbal |
| 9 Review/Demo | criterios Gherkin | US aceptada por el PO |
| 10 Retro | — (humano) | 1–2 mejoras |

---

## Paso 1 — Refinamiento: de la idea vaga a la US testeable

### 1a · Cómo empieza (el ticket vago)

El PO crea un ticket en el gestor. Nace con **identidad** (`ABC-482`) y poco más:

```
ABC-482 · "Arreglar lo del carrito que a veces deja comprar de más"
```

Impresentable para implementar. Acá entra la IA.

### 1b · `grill-user-story` produce la US

Acá entra la IA: `grill-user-story` interroga al PO hasta que la US es **testeable por
construcción** ([`formato-us.md`](../templates/formato-us.md)) y la publica en el gestor:

```markdown
# 🔗 Metadata de trazabilidad
| Campo        | Valor                        |
|--------------|------------------------------|
| ID           | ABC-482                      |
| spec_version | v1                           |
| Autor        | J. Pérez (PO)                |
| Estado       | pulida                       |
| Repos esperados | frontend                  |

# Finalizar la compra del carrito

## Historia
Como **comprador**
quiero **finalizar la compra de mi carrito**
para **recibir los productos que elijo sin sorpresas**.

## Casos de uso
- **Happy path** — el comprador finaliza un carrito con productos con stock → se crea la orden.
- **Alternativo** — intenta finalizar con el carrito vacío → el sistema lo frena.
- **Excepción** — un producto del carrito no tiene stock → se rechaza indicando cuál.

## 🔗 Criterios de aceptación
- [ ] **AC-1** —
  - **Dado** un carrito con productos que tienen stock
  - **Cuando** el comprador finaliza la compra
  - **Entonces** se crea la orden y el carrito queda vacío
- [ ] **AC-2** —
  - **Dado** un carrito vacío
  - **Cuando** se intenta finalizar la compra
  - **Entonces** el sistema lo rechaza y NO crea ninguna orden
- [ ] **AC-3** —
  - **Dado** un carrito con un producto sin stock
  - **Cuando** se intenta finalizar la compra
  - **Entonces** se rechaza indicando qué producto no tiene stock

## Fuera de scope
- El pago (pasarela, tarjetas) es otra US.

## Reglas de negocio
- Una orden creada descuenta el stock de cada producto.
```

> Nota que la US **no dice** tablas, endpoints ni framework — solo el QUÉ. Y cada
> AC es un test en potencia ([Art. 3](./MANIFIESTO.md#art-3) del manifiesto).

### 1c · Gate 0 — `grill-intent` desafía el problema

Con la US ya formada, **antes** de invertir en el spec, el Gate 0 cuestiona el *problema*
detrás (contra el [`MANIFIESTO.md`](MANIFIESTO.md)):

```
IA:  ¿Qué duele HOY, concretamente? "Comprar de más" es un síntoma.
PO:  Un cliente finalizó la compra de un producto que ya no tenía stock, y quedó
     una orden que no podemos cumplir. También pasa que finalizan con el carrito
     vacío y se genera una orden fantasma.
IA:  ¿Quién siente el dolor? "El sistema" no es un usuario.
PO:  El comprador (recibe un error después de comprar) y depósito, que recibe
     órdenes que no puede despachar.
IA:  ¿Y si no lo hacemos? (costo de no actuar)
PO:  Órdenes que se cancelan a mano, clientes enojados. Pasó bastante el último mes.
IA:  La solución implícita es "validar el carrito al finalizar". ¿Es el salto correcto,
     o el problema real es que el stock que muestra el carrito no es confiable?
PO:  No, validar al finalizar es lo correcto: el stock ya existe, falta chequearlo
     en el momento de la compra.

Veredicto: a-spec  ✅  (problema real, usuario concreto, costo claro, sin solution-lock)
```

→ produce `openspec/intents/20260703-checkout-invalido/intent.md` con ese veredicto. Si
hubiera dado *reframe* o *don't build*, la US volvería al PO **antes** de gastar un solo
artefacto de spec — ese es el punto del Gate 0.

---

## Paso 2 — Planning: `opsx:propose` deriva el CÓMO

El dev corre `opsx:explore` → `opsx:propose` sobre la US. OpenSpec genera el design
y las tareas. El dev valida y ajusta:

```markdown
# design.md (extracto)
## Enfoque
Guard de validación en el caso de uso `FinalizarCompra`. El carrito se valida ANTES
de crear la orden: no vacío, y todos sus productos con stock.

## Reglas de la transición
  carrito con stock   ──finalizar──► orden creada, carrito vacío   (permitido)
  carrito vacío       ──finalizar──► ✗ CarritoVacioError
  producto sin stock  ──finalizar──► ✗ SinStockError(producto)
```

```markdown
# tasks.md (extracto)
- [ ] T1. Test: finalizar carrito con stock → orden creada, carrito vacío (AC-1)
- [ ] T2. Test: finalizar carrito vacío → CarritoVacioError, sin orden (AC-2)
- [ ] T3. Test: producto sin stock → SinStockError con el producto (AC-3)
- [ ] T4. Guard de validación en FinalizarCompra
- [ ] T5. Smoke end-to-end del flujo
```

> Las tareas **nacen del cómo**, definidas por quien va a implementar — no bajadas
> desde arriba (Art. 1).

---

## Paso 3 — Rama: `link-us` ata el código al QUÉ

```bash
$ dai link-us ABC-482 --us us.md --change finalizar-compra
✓ branch:  feature/ABC-482-finalizar-la-compra-del-carrito
✓ archivo: openspec/changes/finalizar-compra/implements.yaml  (ac_hash 7f3a9c2e)
```

```yaml
# implements.yaml — el ÚNICO link autorado a mano (schema ADR-0004)
change: finalizar-compra
repo:   frontend

implements:
  - id: ABC-482
    version: v1
    ac_hash: 7f3a9c2e          # lo calculó `dai ac-hash` sobre los criterios de la US v1

introduces:
  - guard-carrito-vacio

autor: D. Force (dev)
```

> El key `ABC-482` **no se tipeó**: salió del argumento. La rama y el link son
> correctos por construcción (Art. 8, Art. 9).

---

## Paso 4 — Implementación: el agente construye con TDD (`/opsx:apply`)

`/opsx:apply` implementa las tareas del change, un test a la vez. Vertical slice del AC-2
(el guard del carrito vacío). **Primero el test (RED):**

```typescript
test("un carrito vacío no se puede finalizar", async () => {
  const carrito = await nuevoCarrito({ items: [] });

  const accion = finalizarCompra(carrito.id);

  await expect(accion).rejects.toThrow(CarritoVacioError);
  expect(await ordenesDe(carrito.id)).toHaveLength(0); // NO se creó ninguna orden
});
// ▶ FALLA: finalizarCompra todavía no valida el carrito.
```

**Después el código mínimo (GREEN):**

```typescript
export async function finalizarCompra(id: CarritoId) {
  const carrito = await repo.obtener(id);
  if (carrito.items.length === 0) throw new CarritoVacioError(id);
  const sinStock = carrito.items.filter((i) => !hayStock(i));
  if (sinStock.length > 0) throw new SinStockError(sinStock);
  const orden = await crearOrden(carrito);
  return repo.vaciar(carrito, orden);
}
// ▶ VERDE. Repetir el ciclo para AC-1 y AC-3.
```

> El test (que escribió el agente) verifica por la **interfaz pública**
> (`finalizarCompra`, `ordenesDe`), no espía lo interno. Sobrevive a un refactor
> (Art. 7 + skill `tdd`). El dev revisa cada slice: es responsable del código.

---

## Paso 5 — Smoke: el flujo entero, verde

```
$ smoke checkout
✓ carrito con stock → orden creada, carrito vacío
✓ carrito vacío → rechazado, sin orden
✓ producto sin stock → rechazado indicando el producto
SMOKE OK (3/3)
```

---

## Paso 6 — Code review: el dev primero, después un partner

**Primero el dev revisa la implementación de la IA** — minucioso y con criterio
(correctitud, casos borde, seguridad, calidad). El dev es responsable del código, no la IA
(anti vibe-coding). Ajusta y **commitea** lo que haga falta.

Con el smoke verde y **todo commiteado** (lo que quede suelto no entra en la PR), crea la
PR con `dai pr` — precargada con la US, el estado del check y los links (los **dos activos**:
código + spec trazable) — y la asigna a un partner:

```
$ dai check
✅ ABC-482 al día (v1)
$ dai pr --assignee mgomez
✓ PR #123 creada → …/pull/123   (base: main · US: ABC-482 @ v1 · dai check ✅)
```

El **partner** revisa la PR. Se apoya en la skill `/dai-review` para un primer pase: deja
un **review inline** (resumen + un comentario anclado por línea, low/medium/high). La skill
le muestra el preview y **espera su OK antes de postear**; después el partner **firma**
aprobación o rechazo:

```
🤖 /dai-review — resumen
  US: ABC-482 @ v1 · dai check: ✅ al día · DoD: 5/5
  1 comentario en línea: 1 🔵 Low.

🔵 Low — src/checkout/errors.ts:12
  CarritoVacioError y SinStockError podrían extender un DomainError común,
  como el resto del módulo.

👤 M. Gómez (partner): reviso el preview, lo posteo, y apruebo tras el ajuste.
```

> El dev revisa su propio código; un partner distinto revisa la PR y **firma** (Art. 5).
> El review sale con el nombre y el token del partner (nunca `APPROVE` automático): la
> skill asiste, la persona firma.

---

## Paso 7 — Merge: la trazabilidad se estampa sola

Al mergear, se corre `dai stamp` (el dev, o el CI si está automatizado — ADR-0003).
Deduce que la US de esta rama es `ABC-482`, lee el `implements.yaml` y **estampa la
cobertura inversa** en el ticket, con links a la implementación:

```
ABC-482 · implementado por  (lo estampó dai stamp)
┌──────────┬───────────────────┬─────────┬──────────┬───────────┐
│ repo     │ change            │ versión │ ac_hash  │ estado    │
├──────────┼───────────────────┼─────────┼──────────┼───────────┤
│ frontend │ finalizar-compra  │ v1      │ 7f3a9c2e │ ✅ al día │
└──────────┴───────────────────┴─────────┴──────────┴───────────┘
  branch → …/tree/feature/ABC-482-finalizar-la-compra-del-carrito
  commit → …/commit/abc123   (ancla durable)
```

> El estado se **deriva**, no se reporta (Art. 10). El link (branch + commit) hace
> que el ticket sea un router hacia la implementación real (§2.5).

---

## Paso 8 — Daily *(humano, a propósito)*

> *"Ayer cerré ABC-482, la validación del checkout con el guard de carrito. Hoy
> tomo ABC-490. Sin trabas."* — La IA no genera esto; el equipo se sincroniza (Art. 6).

## Paso 9 — Review / Demo

El PO valida contra los **mismos criterios que ya eran tests**. Finaliza un carrito,
prueba con uno vacío, prueba con un producto sin stock, ve los rechazos. AC-1, AC-2,
AC-3 verdes → **US aceptada**. Cero sorpresas: si el QUÉ hubiera cambiado, el
`@version` lo habría gritado antes.

## Paso 10 — Retro *(humano)*

> *"El Gate 0 nos ahorró rediseñar el stock, que no hacía falta. Mejora para el
> próximo sprint: sumar el smoke al pipeline y no correrlo a mano."* La matriz de
> trazabilidad aportó el dato; la decisión la tomó el equipo (Art. 6).

---

## Epílogo — Y cuando el QUÉ cambia (el `@version` gritando solo)

Dos sprints después, el PO agrega un criterio a `ABC-482` (ahora exige **avisar al
comprador qué productos quedaron sin stock, sin cancelar el resto del carrito**).

Lo hace con `dai edit-us ABC-482`: la baja del tracker, la abre en su editor, valida el
formato cuando guarda, y le pregunta si el cambio es material o editorial.

```
  ── formato de la US (.dai/us/ABC-482.md) ────────────
  ✓ formato válido — 4 criterio(s), 4 en Gherkin completo

  Cambiaron los criterios (ac_hash 7f3a9c2e → b81d40f5).
    s = cambio material: subo spec_version a v2 y los repos con v1 se marcan ATRASADOS
    n = cambio editorial (typo, redacción): se queda en v1
  ¿Subo spec_version a v2? (S/n) s

  ── ABC-482 · qué cambia en jira ────────────
  título:     Finalizar la compra del carrito  (sin cambios)
  criterios:  4
  version:    v1 → v2
  ac_hash:    7f3a9c2e → b81d40f5
  ──────────────────────────────────────
  Esto PISA la US ABC-482 en jira. ¿Guardo? (s/N) s
✓ ABC-482 actualizada en jira  →  https://acme.atlassian.net/browse/ABC-482
```

La US sube a **v2** → cambia el `ac_hash`.

```
ABC-482 · implementado por
┌──────────┬───────────────────┬─────────┬──────────┬────────────────────────────┐
│ repo     │ change            │ versión │ ac_hash  │ estado                     │
├──────────┼───────────────────┼─────────┼──────────┼────────────────────────────┤
│ frontend │ finalizar-compra  │ v1      │ 7f3a9c2e │ ⚠️  ATRASADO (la US es v2)  │
└──────────┴───────────────────┴─────────┴──────────┴────────────────────────────┘
```

Nadie le avisó al dev: `dai check` lo marcó solo al re-derivar el hash de la US viva
y compararlo con el estampado (Art. 11). El dev abre una nueva iteración —mismo
`ABC-482`, ahora contra v2— y el ciclo vuelve a empezar desde el paso 3.

---

## Qué demuestra este recorrido

- **Los 10 pasos son tu Scrum de siempre** — solo que en cada uno hay una skill.
- **El link nunca se escribió dos veces**: `implements.yaml` una vez, la cobertura
  se derivó.
- **Nada llegó a producción sin ser testeable y trazable** (Arts. 3, 9, 10).
- **Los rituales humanos siguieron siendo humanos** (Art. 6).
- Y cuando el negocio cambió, **el desajuste se hizo visible solo** (Art. 11).
