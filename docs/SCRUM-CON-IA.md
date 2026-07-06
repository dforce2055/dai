# Scrum con IA — El puente de adopción

> **Para qué sirve este documento.** Es la pieza de *buy-in*: le muestra al equipo
> que **no cambiamos su Scrum**. Los mismos pasos, los mismos roles, las mismas
> ceremonias — solo que en cada paso donde hoy hay fricción o trabajo manual, hay
> una skill de IA que lo hace por ti o te obliga a hacerlo bien.
>
> El protocolo que hay debajo (identidad estable, link QUÉ↔CÓMO, `@version`) vive
> en [`METODOLOGIA.md`](METODOLOGIA.md). Acá contamos **la ceremonia**, paso a paso.

## La frase para el equipo

> **"Es tu mismo Scrum. Donde hoy haces algo a mano y con fricción, ahora invocas
> una skill. El esqueleto es el que ya conoces — la curva de aprendizaje es casi
> cero."**

## Cómo leer la tabla de cada paso

- **Clásico** — qué se hace hoy en Scrum tradicional.
- **Dolor** — qué duele hoy (incluso sin IA).
- **Con IA** — el pequeño ajuste potenciado por IA. No reemplaza el paso: lo mejora.
- **Humano (HITL)** — qué queda en manos de la persona, a propósito, para que el
  equipo se adueñe del proceso y lo entienda.
- **Herramienta** — la skill o pieza que lo habilita.
- **Detalle →** — link al entregable ampliado (uno por paso, para no hacer esto extenso).

---

## Los 10 pasos

```
  ENTRADA DEL SPRINT          DURANTE EL SPRINT (por cada US)        EVENTOS / CIERRE
  ┌──────────────────┐        ┌──────────────────────────┐          ┌──────────────────┐
  │ 1 Refinamiento   │        │ 3 Rama ligada a la US    │          │ 8 Daily (manual) │
  │ 2 Sprint Planning│   →    │ 4 Implementación TDD     │    →     │ 9 Review / Demo  │
  └──────────────────┘        │ 5 Smoke test             │          │ 10 Retro (manual)│
                              │ 6 Code review            │          └──────────────────┘
                              │ 7 Merge + trazabilidad   │
                              └──────────────────────────┘
```

---

### Fase A — Entrada del sprint

#### 1. Refinamiento: de épica a US testeable

| | |
|---|---|
| **Clásico** | El PO parte épicas en Historias de Usuario y les pone criterios de aceptación. |
| **Dolor** | US vagas, no testeables ("el usuario quiere un botón"). El malentendido se descubre tarde, ya implementado. |
| **Con IA** | `grill-intent` (Gate 0: ¿es el problema correcto? veredicto a-spec / reframe / descartar) y luego `grill-user-story` **interrogan** al PO hasta que la US es testeable por construcción (INVEST + Gherkin). La IA no *escribe* la US: la *saca a preguntas*. La US nace con ID estable y criterios hasheables. |
| **Humano (HITL)** | El PO responde y decide. La IA no inventa requerimientos: los pule. |
| **Herramienta** | `grill-intent`, `grill-user-story`, `formato-us.md` |
| **Detalle →** | [`detalle/01-refinamiento.md`](detalle/01-refinamiento.md) |

#### 2. Sprint Planning: comprometer US y derivar tareas

| | |
|---|---|
| **Clásico** | El equipo elige qué US entran al sprint y las rompe en tareas técnicas. |
| **Dolor** | Las tareas las inventa alguien de arriba o no existen; se estima a ciegas. |
| **Con IA** | El dev corre `opsx:explore` → `opsx:propose`: OpenSpec **genera el design y las tareas** desde la US. Las tareas nacen del *cómo*, definidas por quien va a implementar. |
| **Humano (HITL)** | El equipo decide capacidad y prioridad. El dev valida y ajusta el design propuesto. |
| **Herramienta** | `opsx:explore`, `opsx:propose` |
| **Detalle →** | [`detalle/02-planning.md`](detalle/02-planning.md) |

---

### Fase B — Durante el sprint (por cada US)

#### 3. Rama ligada a la US

| | |
|---|---|
| **Clásico** | El dev crea una rama para trabajar la US. |
| **Dolor** | Nombres inconsistentes, ramas que no se sabe a qué US pertenecen → trazabilidad rota desde el commit uno. |
| **Con IA** | `link-us ABC-###` crea la rama **desde el ID de la US, sin tipearlo a mano**, y genera el `implements.yaml`. La rama *es* el link: correcto por construcción. |
| **Humano (HITL)** | El dev elige qué US agarra. |
| **Herramienta** | `link-us` |
| **Detalle →** | [`detalle/03-ramas.md`](detalle/03-ramas.md) |

#### 4. Implementación con TDD

| | |
|---|---|
| **Clásico** | El dev codea. Idealmente con tests. |
| **Dolor** | Se codea primero y se testea "si queda tiempo" (nunca queda). Vibe coding. |
| **Con IA** | La skill `tdd` fuerza test→código en *vertical slices* (un test → una implementación → repetir). La IA escribe el test como spec ejecutable **antes** del código, verificando por la interfaz pública. Anti vibe-coding real. |
| **Humano (HITL)** | El dev decide qué comportamientos importa testear y revisa cada slice. |
| **Herramienta** | `tdd` |
| **Detalle →** | [`detalle/04-tdd.md`](detalle/04-tdd.md) |

#### 5. Smoke test de la US

| | |
|---|---|
| **Clásico** | Antes de cerrar se verifica que no se rompió nada grueso. |
| **Dolor** | Smoke manual, se olvida, o no existe. |
| **Con IA** | La IA arma y corre un smoke del flujo end-to-end como paso de cierre de la US. |
| **Humano (HITL)** | El dev confirma que el escenario refleja el uso real. |
| **Herramienta** | skills de smoke por dominio (p. ej. `smoke-*`) |
| **Detalle →** | [`detalle/05-smoke.md`](detalle/05-smoke.md) |

#### 6. Code review

| | |
|---|---|
| **Clásico** | Un compañero revisa el PR/MR antes de mergear. |
| **Dolor** | Depende de que el partner tenga tiempo y ganas; reviews superficiales que dejan pasar lo importante. |
| **Con IA** | La IA hace el **primer pase** (correctitud + estándares del repo) antes del humano. El partner revisa lo que importa, no el ruido. |
| **Humano (HITL)** | El partner aprueba o rechaza. La IA sugiere; la persona decide y firma. |
| **Herramienta** | `code-review`, `review-with-specs` |
| **Detalle →** | [`detalle/06-code-review.md`](detalle/06-code-review.md) |

#### 7. Merge + trazabilidad automática

| | |
|---|---|
| **Clásico** | Se mergea y (a veces) alguien actualiza el estado en el tracker. |
| **Dolor** | El estado del tracker queda desactualizado; se llena a mano o no se llena. |
| **Con IA** | Al mergear, el CI **estampa la cobertura inversa** en el tracker: qué repo implementó qué US, contra qué `@version`. El estado se *deriva*, no se reporta. El `@version`/`ac_hash` marca solo si el QUÉ cambió y el código quedó atrás. |
| **Humano (HITL)** | Nadie mantiene la matriz a mano — ese es el punto. |
| **Herramienta** | CI + `implements.yaml` + índice/router |
| **Detalle →** | [`detalle/07-merge-trazabilidad.md`](detalle/07-merge-trazabilidad.md) |

---

### Fase C — Eventos y cierre

#### 8. Daily standup — **manual (HITL)**

| | |
|---|---|
| **Clásico** | 15 min: qué hice, qué voy a hacer, qué me traba. |
| **Dolor** | A veces se vuelve reporte de estado en vez de sincronización. |
| **Con IA** | **Ninguno, a propósito.** Se deja manual para mantener el *human-in-the-loop*: es donde el equipo se apropia del proceso, lo entiende y se coordina de verdad. La IA podría auto-generar el "qué se hizo" desde git, pero eso le sacaría al equipo la propiedad del ritual. |
| **Humano (HITL)** | Todo. La conversación es el valor. |
| **Herramienta** | — |
| **Detalle →** | [`detalle/08-daily.md`](detalle/08-daily.md) |

#### 9. Sprint Review / Demo

| | |
|---|---|
| **Clásico** | Se muestra lo terminado al PO y stakeholders; se acepta o rechaza contra criterios. |
| **Dolor** | "Esto no era lo que pedí". El QUÉ y el CÓMO se desincronizaron sin que nadie lo notara. |
| **Con IA** | Se valida contra criterios de aceptación que **ya eran tests**. Si el QUÉ evolucionó, el `@version` lo gritó antes de la demo — no hay sorpresas. |
| **Humano (HITL)** | El PO acepta o rechaza. La demo la corre una persona. |
| **Herramienta** | criterios Gherkin de la US + `@version` |
| **Detalle →** | [`detalle/09-review.md`](detalle/09-review.md) |

#### 10. Retrospective — **manual (HITL)**

| | |
|---|---|
| **Clásico** | El equipo mira *cómo trabajó* y elige 1–2 mejoras. |
| **Dolor** | Se mejora "la sensación", sin datos. |
| **Con IA** | **Ninguno directo, a propósito** — el ritual es humano. Pero la matriz de trazabilidad y las métricas de las US aportan **datos reales** de dónde se trabó el flujo, para que la conversación humana no sea a ciegas. |
| **Humano (HITL)** | Todo el análisis y las decisiones de mejora. |
| **Herramienta** | matriz de trazabilidad (input, no reemplazo) |
| **Detalle →** | [`detalle/10-retro.md`](detalle/10-retro.md) |

---

## Resumen: dónde entra la IA y dónde no

| Paso | IA | Por qué |
|---|---|---|
| 1 Refinamiento | ●●● | La US testeable es la base de todo. |
| 2 Planning | ●● | El design y las tareas se derivan de la US. |
| 3 Rama | ●●● | El link correcto por construcción. |
| 4 TDD | ●●● | El corazón del anti vibe-coding. |
| 5 Smoke | ●● | Cierre verificable de la US. |
| 6 Code review | ●● | Primer pase automático, humano decide. |
| 7 Merge + trazabilidad | ●●● | La matriz se deriva sola. |
| 8 Daily | ○ | **Manual a propósito** — apropiación del proceso. |
| 9 Review / Demo | ● | Validación contra criterios que ya eran tests. |
| 10 Retro | ○ | **Manual a propósito** — la IA solo aporta datos. |

`●●● = la IA hace el trabajo pesado` · `●● = asiste fuerte` · `● = aporta` · `○ = humano puro (HITL)`

---

## El detalle de cada paso

Cada paso `1–10` está ampliado en su propio doc bajo [`detalle/`](detalle/) — para
que este maestro quede corto y repartible. Cada uno incluye: el paso al 100%, la
herramienta con ejemplos, qué firma la persona (HITL) y los antipatrones a evitar.
Ver el índice en [`detalle/README.md`](detalle/README.md).
