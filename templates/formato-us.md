<!--
  FORMATO CANÓNICO DE USER STORY · Modelo de Trazabilidad QUÉ↔CÓMO
  ─────────────────────────────────────────────────────────────────
  Este es "el mejor formato que se adapta al flujo": una US completa con
  mejores prácticas (INVEST + Gherkin) MÁS las adaptaciones que el modelo
  de trazabilidad necesita para linkear ida y vuelta.

  Lo produce la skill grill-intent → grill-user-story.
  Es funcional y de alto nivel: define el QUÉ, nunca el CÓMO (sin tablas,
  endpoints, ni implementación).

  Las secciones marcadas con 🔗 son las ADAPTACIONES del modelo.
  El resto son mejores prácticas estándar de user stories.
-->

# 🔗 Metadata de trazabilidad

> Esta cabecera es la que hace la US **linkeable**. Es lo que el `implements.yaml`
> del repo referencia y lo que el CI lee para estampar cobertura.

| Campo | Valor | Quién lo mantiene |
|-------|-------|-------------------|
| **ID** | `ABC-123` | Jira (identidad estable del QUÉ) |
| **spec_version** | `v1` | PO / `grill-user-story` — sube al cambiar criterios |
| **ac_hash** | _(autogenerado)_ | CI — hash del bloque *Criterios de aceptación* |
| **Autor** | `J. Pérez (PO)` | quien la definió |
| **Estado** | `borrador` \| `pulida` \| `en implementación` \| `implementada` | flujo |
| **Repos esperados** | `frontend`, `bff`, `backend` _(hint, opcional)_ | PO / arquitectura |

---

# <Título de la historia>

**Corto — 3 a 6 palabras.** Nombra la capacidad, no la explica (el detalle va en la
descripción y los criterios). De él sale el nombre de la branch, así que cuanto más
conciso, mejor.
- ✅ "Confirmar acciones con consecuencias" · "Finalizar la compra del carrito"
- ❌ "Confirmación deliberada antes de ejecutar acciones con consecuencias" (es una frase,
  no un título) · "Como usuario quiero un botón" (eso es la historia, no el título)

## Historia

> Formato Connextra (la user story clásica de *rol / quiero / para*). El rol debe ser un
> tipo de usuario **concreto**, nunca "el usuario".

Como **<rol concreto>**
quiero **<capacidad o resultado>**
para **<valor / por qué>**.

## Contexto / Problema

Por qué esto importa ahora. Qué duele hoy sin esta funcionalidad. 2–4 líneas que
le den sentido a la historia para alguien que cae de nuevo.

## Casos de uso

Flujos a nivel usuario — qué hace la persona y qué responde el sistema. Sin tecnología.

- **Happy path** — <el usuario hace X, obtiene Y>
- **Alternativo** — <variación esperada del flujo>
- **Excepción** — <qué pasa cuando algo no es válido, no está permitido, o está vacío>

## 🔗 Criterios de aceptación

> **Este bloque es el corazón del modelo.** Es lo que se hashea (`ac_hash`) y lo que
> hace que un cambio del QUÉ marque solo a los repos atrasados. Por eso:
> - Formato **Gherkin** (`Dado / Cuando / Entonces`): estructurado, estable, testeable.
> - Cada criterio tiene que poder convertirse en **un test**.
> - Funcionales pero verificables. Sin mencionar tablas, endpoints ni implementación.
> - Orden estable — no reordenar por gusto; cada línea es material para el hash.

- [ ] **AC-1** —
  - **Dado** <estado / precondición>
  - **Cuando** <acción del usuario / evento>
  - **Entonces** <resultado observable y verificable>
- [ ] **AC-2** —
  - **Dado** <...>
  - **Cuando** <...>
  - **Entonces** <...>

## Reglas de negocio

Invariantes que aplican transversalmente a los criterios (no un flujo puntual).

- <regla de dominio, límite, restricción>

## Fuera de scope

Lo que esta historia explícitamente NO hace. Corta el scope creep más adelante.

- <...>

## Dependencias

Otras US, sistemas o decisiones que tienen que existir antes o en paralelo.

- <ABC-### / sistema externo / decisión pendiente>

## Métricas de éxito

Cómo sabremos que esto agregó valor (no cómo se construyó).

- <métrica observable / indicador de negocio>

## Preguntas abiertas

Lo que quedó sin resolver y necesita una decisión antes de pasar a implementación.

- <...>

---

<!--
  CHECKLIST INVEST (la skill lo valida antes de dar la US por "pulida"):
  - Independent  — se puede implementar sin depender de otra US a medias.
  - Negotiable   — describe el QUÉ, deja espacio al CÓMO.
  - Valuable     — el "para <valor>" es real y claro.
  - Estimable    — el equipo técnico puede dimensionarla.
  - Small        — cabe en un sprint; si no, se parte.
  - Testable     — cada criterio de aceptación es un test en potencia.

  REGLA DEL ac_hash:
  - ac_hash = hash del bloque "Criterios de aceptación" normalizado
    (whitespace colapsado, viñetas y marcado estable).
  - Cambio MATERIAL de los AC  → cambia el hash → el CI re-marca repos como atrasados.
  - Cambio editorial (typo, formato) → normalizar para que NO dispare un falso atraso.
  - spec_version (número legible) lo sube el PO/skill para comunicar; ac_hash lo
    calcula el CI para detectar. El número comunica, el hash detecta.
-->

---

<!--
  ══════════════════════════════════════════════════════════════════════════════
  EJEMPLO LISTO PARA PROBAR — copiá desde el título de abajo hasta el final.
  Es lo MÍNIMO que funciona (una US real necesita más secciones, ver arriba),
  pero alcanza para ver el flujo:

    • Sin tracker:  guardalo como .dai/us/EJ-1.md  y corré:
        dai ac-hash .dai/us/EJ-1.md          # imprime el ac_hash
        dai link-us EJ-1 --us .dai/us/EJ-1.md --dry-run   # muestra branch + implements.yaml
    • Con tracker:  pegalo como una US nueva y corré  dai link-us <ID>.

  La clave es la sección "Criterios de aceptación": es lo que se hashea. Sin ella,
  dai no linkea (por diseño: no hay link sin criterios testeables).
  ══════════════════════════════════════════════════════════════════════════════
-->

# Marcar una tarea como completada

## Historia

Como **usuario de la lista de tareas**
quiero **marcar una tarea como completada**
para **distinguir de un vistazo lo que ya hice de lo que me falta**.

## Criterios de aceptación

- [ ] **AC-1** —
  - **Dado** una tarea pendiente en mi lista
  - **Cuando** la marco como completada
  - **Entonces** queda diferenciada como hecha y deja de contar en el total de pendientes.
- [ ] **AC-2** —
  - **Dado** una tarea ya completada
  - **Cuando** la vuelvo a marcar
  - **Entonces** vuelve al estado pendiente y se recuenta en el total.
- [ ] **AC-3** —
  - **Dado** que recargo la página
  - **Cuando** vuelve a cargar mi lista
  - **Entonces** cada tarea conserva el estado (completada o pendiente) que tenía.
