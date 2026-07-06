# Guía del dev / ingeniero

> Tu trabajo en una frase: **defines e implementas el CÓMO, y autoras el link al QUÉ.**
> El QUÉ ya viene definido y testeable — tú no lo re-discutes, lo implementas.

## Lo que eres dueño

- El **CÓMO**: diseño técnico, modelo de datos, arquitectura de la solución.
- Las **tareas técnicas** (las derivas tú, desde la US, con OpenSpec).
- El **link** (`implements.yaml`): es el **único** que se autora a mano (Art. 9).
- El **código** y su **spec técnica**.

## Lo que NO tocas

- El contenido funcional de la US ni sus criterios → eso es del PO (Art. 1).
- Si te parece que el QUÉ está mal, **no lo corrijas por tu cuenta**: devuelve la US
  al PO (reframe). No decidas negocio desde el código.

## Tu día a día

1. **Agarras una US** que cumple el DoR → `/link-us ABC-###`. Crea la rama y el
   `implements.yaml` **desde el ID, sin que tipees el key a mano** (Art. 8, Art. 9).
2. **Armas el CÓMO** → `opsx:explore` → `opsx:propose`. OpenSpec genera
   `design.md`/`tasks.md`; tú validas y ajustas. Las tareas nacen del cómo.
3. **Implementas con TDD** → `/tdd`. Un test a la vez, vertical slices: RED → GREEN
   → refactor. Verificas por la **interfaz pública**, no espías lo interno (Art. 7).
4. **Smoke** → ejecutas el escenario end-to-end del flujo.
5. **Review** → `/code-review` hace el primer pase; después un partner aprueba.
6. **Merge** → se estampa la cobertura en el gestor con `dai stamp` (lo ejecutas tú
   tras mergear, o el CI si la org lo tiene automatizado — mismo comando, ADR-0003).
   Antes, `dai check` te dice si estás atrasado respecto de la US. Tú nunca reportas
   estado **a mano**: lo deriva el comando.
7. **Verificas el DoD** → `definition-of-done.md` antes de dar por terminado.

## La trampa a evitar

**Vibe coding.** Nada de codear sobre una idea vaga o "improvisar y después vemos".
Si no hay US con criterios testeables, no arranques: falta el DoR. La disciplina
—US clara → design → test → código— es lo que separa esto de pedirle cosas a un chat.

## Cuando el QUÉ cambia

Si el PO sube la US a `v2`, tu `implements.yaml` (que apunta a `v1`) se marca
**atrasado** solo. Abres una nueva iteración contra `v2` y vuelves al paso 3. Nadie
te avisa: el link versionado lo hace (Art. 11).

## Tus herramientas

`/link-us` · `opsx:explore` · `opsx:propose` · `opsx:apply` · `/tdd` · `/code-review` · `definition-of-done.md`
