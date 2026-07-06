# Guía del dev / ingeniero

> Tu trabajo en una frase: **definís e implementás el CÓMO, y autorás el link al QUÉ.**
> El QUÉ ya viene definido y testeable — vos no lo re-discutís, lo implementás.

## Lo que sos dueño

- El **CÓMO**: diseño técnico, modelo de datos, arquitectura de la solución.
- Las **tareas técnicas** (las derivás vos, desde la US, con OpenSpec).
- El **link** (`implements.yaml`): es el **único** que se autora a mano (Art. 9).
- El **código** y su **spec técnica**.

## Lo que NO tocás

- El contenido funcional de la US ni sus criterios → eso es del PO (Art. 1).
- Si te parece que el QUÉ está mal, **no lo corrijas por tu cuenta**: devolvé la US
  al PO (reframe). No decidas negocio desde el código.

## Tu día a día

1. **Agarrás una US** que cumple el DoR → `/link-us ABC-###`. Crea la rama y el
   `implements.yaml` **desde el ID, sin que tipees el key a mano** (Art. 8, Art. 9).
2. **Armás el CÓMO** → `opsx:explore` → `opsx:propose`. OpenSpec genera
   `design.md`/`tasks.md`; vos validás y ajustás. Las tareas nacen del cómo.
3. **Implementás con TDD** → `/tdd`. Un test a la vez, vertical slices: RED → GREEN
   → refactor. Verificás por la **interfaz pública**, no espiás lo interno (Art. 7).
4. **Smoke** → corrés el escenario end-to-end del flujo.
5. **Review** → `/code-review` hace el primer pase; después un partner aprueba.
6. **Merge** → se estampa la cobertura en el gestor con `dai stamp` (lo corrés vos
   tras mergear, o el CI si la org lo tiene automatizado — mismo comando, ADR-0003).
   Antes, `dai check` te dice si estás atrasado respecto de la US. Vos nunca reportás
   estado **a mano**: lo deriva el comando.
7. **Verificás el DoD** → `definition-of-done.md` antes de dar por terminado.

## La trampa a evitar

**Vibe coding.** Nada de codear sobre una idea vaga o "improvisar y después vemos".
Si no hay US con criterios testeables, no arranques: falta el DoR. La disciplina
—US clara → design → test → código— es lo que separa esto de pedirle cosas a un chat.

## Cuando el QUÉ cambia

Si el PO sube la US a `v2`, tu `implements.yaml` (que apunta a `v1`) se marca
**atrasado** solo. Abrís una nueva iteración contra `v2` y volvés al paso 3. Nadie
te avisa: el link versionado lo hace (Art. 11).

## Tus herramientas

`/link-us` · `opsx:explore` · `opsx:propose` · `opsx:apply` · `/tdd` · `/code-review` · `definition-of-done.md`
