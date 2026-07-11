# Convención de commits — el CÓMO, en pasos legibles

> Un commit es el **paso atómico del CÓMO**. Si el historial se lee, la implementación
> se entiende sin abrir el diff. Esta convención lo vuelve mecánico — y un hook la
> blinda, sin depender de que nadie "se acuerde" (mismo espíritu que [`ci-rules.md`](ci-rules.md)).

## Formato

```
<tipo>(<scope>)!: <resumen>

<cuerpo opcional>
```

- **tipo** — obligatorio (ver tabla).
- **scope** — opcional, en minúscula: el módulo o área (`cart`, `auth`, `cli`).
- **`!`** — opcional, marca un **breaking change** (rompe un contrato).
- **resumen** — en **imperativo**, minúscula, **sin punto final**, hasta **72** caracteres.
  "rechaza el carrito vacío", no "Rechazado" ni "se rechaza el carrito".
- **cuerpo** — opcional: el *por qué*, no el *qué* (el diff ya dice el qué).

| Tipo | Cuándo |
|---|---|
| `feat` | nueva funcionalidad |
| `fix` | corrección de un bug |
| `docs` | solo documentación |
| `style` | formato (espacios, comas) sin cambio de comportamiento |
| `refactor` | reescritura sin feature ni fix |
| `perf` | mejora de rendimiento |
| `test` | agrega o corrige tests |
| `build` | sistema de build o dependencias |
| `ci` | pipeline de CI/CD |
| `chore` | mantenimiento (nada de lo anterior) |
| `revert` | revierte un commit previo |

Se dejan pasar sin validar: `Merge …`, `Revert …`, `fixup!`/`squash!` y commits de bots (`🤖…`).

> Esto es solo la validación de **formato**. La **autoría** es otra regla: en el repo
> de dai no se aceptan commits autorados ni co-autorados por un agente
> (ver [`human-authorship.md`](human-authorship.md)).

## Relación con la trazabilidad

El link formal QUÉ↔CÓMO vive en el `implements.yaml` (no en el mensaje del commit). Pero si
el commit implementa una US, **mencionarla en el cuerpo** hace el historial legible:

```
feat(cart): rechaza finalizar un carrito vacío

Cubre el criterio AC-2. US: ABC-482.
```

No es obligatorio y **no** reemplaza al `implements.yaml` — es una ayuda de lectura.

## Cómo instalar el hook

El template [`templates/commit-msg`](../templates/commit-msg) es POSIX sh **sin dependencias**
(no necesita dai, node ni commitlint). Elige según tu repo:

**Con [husky](https://typicode.github.io/husky/) (si ya lo usas):**
```bash
cp templates/commit-msg .husky/commit-msg && chmod +x .husky/commit-msg
```

**Git hook pelado (sin herramientas):**
```bash
cp templates/commit-msg .git/hooks/commit-msg && chmod +x .git/hooks/commit-msg
```

Para compartirlo con el equipo sin husky, versiona los hooks en el repo y apunta git ahí:
```bash
mkdir -p .githooks && cp templates/commit-msg .githooks/ && chmod +x .githooks/commit-msg
git config core.hooksPath .githooks
```

## Opt-in ([Art. 14](../docs/MANIFIESTO.md#art-14) — no adelantar complejidad)

El hook es **opcional**. Un equipo chico puede seguir la convención a mano; uno grande la
blinda con el hook y/o el CI. La convención es la misma en cualquier nivel de ceremonia
(N1/N2/N3 — ver [glosario](../docs/glosario.md)); solo cambia cuánto se automatiza.
