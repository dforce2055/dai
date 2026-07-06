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

| Check | Regla | Si falla |
|---|---|---|
| **Link presente** | Toda rama de producto (`feature/ABC-###-*`) tiene `implements.yaml`. | ❌ bloquea el PR |
| **ID válido** | El `id` matchea el formato del gestor (`ABC-\d+`) y el ID existe. | ❌ bloquea |
| **`ac_hash` calculado** | El CI (re)calcula el hash de los criterios de la US y lo compara. | ⚠️ marca atrasado si no coincide |
| **Tests verdes** | La suite de la US pasa. | ❌ bloquea |
| **Estándares** | Lint + tipos + convenciones del repo. | ❌ bloquea |

> Ramas `chore/`/`fix/` sin US no requieren `implements.yaml` (ver `branch-naming.md`).

## Qué hace el CI al mergear

1. **Lee** el `implements.yaml` de la rama.
2. **Estampa la cobertura inversa** en el gestor: en el ticket `ABC-###`, deja
   "implementado por `<repo>` @ `<version>` (`ac_hash`) ✅". **Nadie lo escribe a
   mano** ([Art. 10](../docs/MANIFIESTO.md#art-10)).
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
