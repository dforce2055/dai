# Reglas de CI — enforcement, no vigilancia

> El método no depende de que la gente "se acuerde". Lo blinda un check: valida el
> link en cada PR y estampa la cobertura al mergear. La disciplina la sostiene la
> máquina, no la buena voluntad.
>
> **El "CI" no es infraestructura obligatoria (ADR-0003).** Todo lo de acá abajo son
> los comandos `dai check` (read-only, gate) y `dai stamp` (write, cobertura),
> corridos por un dev en modo distribuido **o** por el pipeline que la org ya tenga.
> El tracker solo guarda la US; no ejecuta nada. Un equipo sin CI usa los mismos
> comandos a mano (o por git-hook) y tiene la misma trazabilidad.

## Qué valida el CI en cada PR/MR

Las dos primeras filas **las ejecuta un comando**, no la buena voluntad:

```bash
dai check --ci        # salidas: 0 pasa · 1 falta el link · 2 el QUÉ cambió
```

Hay un workflow listo para copiar en [`templates/ci-dai-gate.yml`](../templates/ci-dai-gate.yml).
Si tu CI no es GitHub Actions, el contrato es el mismo: un comando y su código de salida.

| Check | Regla | Quién lo hace | Si falla |
|---|---|---|---|
| **Link presente** | Toda rama de producto (`feature/`) tiene `implements.yaml`. | `dai check --ci` | ❌ bloquea (exit 1) |
| **`ac_hash` al día** | Recalcula el hash de los criterios de la US viva y lo compara. | `dai check --ci` | ❌ bloquea (exit 2) |
| **ID resoluble** | El `id` del link existe en el gestor. | `dai check --ci` | ❌ bloquea (exit 2) |
| **Tests verdes** | La suite de la US pasa. | el CI del repo | ❌ bloquea |
| **Estándares** | Lint + tipos + convenciones del repo. | el CI del repo | ❌ bloquea |

### Qué ramas quedan exentas

Un gate que le exige US a todo se desactiva a la semana, y entonces no protege nada.
Por eso `dai check --ci` decide **leyendo el nombre de la rama** (`branch-naming.md`):

| Prefijo | ¿Exige `implements.yaml`? |
|---|---|
| `feature/`, `feat/` | **Sí, siempre** — es trabajo de producto |
| `chore/`, `docs/`, `ci/`, `build/`, `test/`, `refactor/`, `style/`, `release/`, `hotfix/`, `revert/` | **No** — trabajo sin US |
| `fix/` y cualquier otro prefijo | **Solo si el nombre trae un ID** (`fix/ABC-482-…`). Sin ID, no |
| `main`, `develop` (sin prefijo) | No — no es una rama de trabajo |

> Si tu PR es una corrección o un chore y el gate te lo bloquea, la respuesta **no** es
> inventarle una US: es renombrar la rama con el prefijo que corresponde. El nombre de la
> rama es la declaración de qué tipo de trabajo es.

### Sin credenciales del tracker

`dai check --ci --no-network` valida el link y **no** compara contra la US viva. Es el
default del template: un gate que falla porque un token venció o porque el CI no tiene
salida a internet enseña al equipo a ignorarlo. Con los secrets cargados, sacá el flag y
el gate detecta además las US atrasadas.

## Qué hace el CI al mergear

1. **Lee** el `implements.yaml` de la rama.
2. **Estampa la cobertura inversa** en el gestor: en el ticket `ABC-###`, deja
   "implementado por `<repo>` @ `<version>` (`ac_hash`) ✅". **Nadie lo escribe a
   mano** ([Art. 10](../docs/MANIFIESTO.md#art-10)).

   ```bash
   dai stamp ABC-482       # explícito: lo que corresponde en CI
   dai stamp               # local: deduce la US de la rama; si hay varias, pregunta
   ```

   > En CI **pasá el ID**. `dai stamp` sin argumentos es para el dev en su máquina:
   > deduce la US del nombre de la rama y, si no puede, pregunta en vez de estampar de
   > más. Un comentario en el tracker no se deshace.
3. **Actualiza el índice/router central** de la federación: la fila `ABC-### → { repos }`.

## Qué hace el CD al desplegar (solo N3 · organización grande)

Reporta a qué **ambiente** llegó la versión (`dev` / `test` / `pre` / `prod`), para
armar la matriz **repo × ambiente**. Implementación ≠ despliegue: el CI dice "se
implementó `@v3`", el CD dice "`@v3` está viva en `pre`".

## Cómo se calcula el `ac_hash` (contrato)

> Decisión abierta de la metodología — este es el contrato propuesto, a congelar en un ADR.

1. Tomar el bloque **Criterios de aceptación** de la US vigente.
2. **Normalizar**: colapsar whitespace, orden estable de los AC, quitar marcado
   editorial (viñetas, énfasis). El objetivo: que un typo **no** dispare un falso atraso.
3. Hashear el resultado normalizado (p. ej. SHA-256, truncado para legibilidad).
4. Comparar con el `ac_hash` del `implements.yaml`. Distinto → el repo está atrasado.

## Calibración por nivel

> **N1 / N2 / N3** son los niveles de ceremonia según el tamaño del equipo — **N1**
> un dev solo, **N2** equipo compacto (con tracker), **N3** organización grande
> (federada). Ver el [glosario](../docs/glosario.md) o [METODOLOGIA §3](../docs/METODOLOGIA.md).

- **N1** (dev solo)**:** sin CI. La validación es un comando local (`dai` puede ofrecer un pre-commit).
- **N2** (equipo compacto)**:** CI liviano — valida link + tests, estampa en el gestor si hay adaptador.
- **N3** (organización grande)**:** CI completo + CD reportando ambientes + índice central publicado.
