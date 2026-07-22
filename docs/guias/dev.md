# Guía del dev / ingeniero

> Tu trabajo en una frase: **defines e implementas el CÓMO, y autoras el link al QUÉ.**
> El QUÉ ya viene definido y testeable — tú no lo re-discutes, lo implementas.

## Lo que eres dueño

- El **CÓMO**: diseño técnico, modelo de datos, arquitectura de la solución.
- Las **tareas técnicas** (las derivas tú, desde la US, con OpenSpec).
- El **link** (`implements.yaml`): es el **único** que se autora a mano ([Art. 9](../MANIFIESTO.md#art-9)).
- El **código** y su **spec técnica**.

## Lo que NO tocas

- El contenido funcional de la US ni sus criterios → eso es del PO (Art. 1).
- Si te parece que el QUÉ está mal, **no lo corrijas por tu cuenta**: devuelve la US
  al PO (reframe). No decidas negocio desde el código.

## Tu día a día

1. **Tomas una US** que cumple el [DoR](../../templates/definition-of-ready.md) → `/link-us ABC-###`. Crea la rama y el
   `implements.yaml` **desde el ID, sin que tipees el key a mano** (Art. 8, Art. 9).
2. **Armas el CÓMO** → `opsx:explore` → `opsx:propose`. OpenSpec genera
   `design.md`/`tasks.md`; tú validas y ajustas. Las tareas nacen del cómo.
3. **El agente implementa el CÓMO** → `/opsx:apply`. Aplica las tareas escribiendo
   test-primero (TDD, vertical slices: RED → GREEN → refactor), por la **interfaz
   pública** (Art. 7). Tú decides qué comportamientos importa testear; el agente los
   construye.
4. **Smoke** → ejecutas el escenario end-to-end del flujo.
5. **Revisas la implementación de la IA** (code review propio) → minucioso y con criterio:
   correctitud, casos borde, seguridad, calidad. **Eres responsable del código, no la IA**
   (anti vibe-coding). Ajustas y **commiteas** lo que haga falta.
6. **Creas la PR** → con el smoke verde y **todo commiteado** (lo que quede sin commitear
   **no entra** en la PR), corres `dai check` (gate: ¿al día con la US?) y en verde `dai pr`
   arma la PR **precargada** (US + estado del check + links; los **dos activos**: código +
   spec trazable) y la asignas a un partner.
7. **Review de un partner** → un compañero revisa tu PR y **firma** aprobación/rechazo
   (Art. 5). Se apoya en la skill `/dai-review` para un primer pase: un **review inline**
   (resumen + un comentario por línea), que le muestra el preview y espera su OK antes de postear.
   *(Tu PR la revisas tú en el paso 5; la de un compañero, lo ayudas con la skill.)*
8. **Verificas el DoD** → [`definition-of-done.md`](../../templates/definition-of-done.md) antes de mergear.
9. **Merge → se estampa la cobertura** con `dai stamp` (lo corres tú tras mergear, o el CI
   si la org lo tiene automatizado — mismo comando, ADR-0003). El estado se **deriva** (Art. 10).
   `dai stamp` deduce **qué US** estampar del nombre de tu rama; si el repo tiene varias
   vivas y no puede saberlo, te pregunta antes de escribir en el tracker. En un pipeline
   pasa el ID: `dai stamp ABC-482` ([ADR-0018](../adr/0018-alcance-de-stamp-y-gate-de-ci.md)).
10. **(Opcional) Limpias la rama** → `dai done` te devuelve a la base (default `main`, o
   `--base develop`), hace `fetch --prune` + `pull` y borra la rama local **solo si está
   mergeada**. Higiene del repo tras el merge, sin riesgo de perder trabajo sin integrar.

## La trampa a evitar

**Vibe coding.** Nada de codear sobre una idea vaga o "improvisar y después vemos".
Si no hay US con criterios testeables, no empieces: falta el [DoR](../../templates/definition-of-ready.md). La disciplina
—US clara → design → test → código— es lo que separa esto de pedirle cosas a un chat.

## Cuando el QUÉ cambia

Si el PO sube la US a `v2`, tu `implements.yaml` (que apunta a `v1`) se marca
**atrasado** solo. Abres una nueva iteración contra `v2` y vuelves al paso 3. Nadie
te avisa: el link versionado lo hace [Art. 11](../MANIFIESTO.md#art-11).

### Cuando el que cambia el QUÉ eres tú

Implementando aparece un criterio que la US no decía, y lo escribes en el `us.md` del
change. Ahí el tracker queda viejo y tu `ac_hash` deja de coincidir con nada:

```bash
dai update-us ABC-482        # empuja tu us.md al tracker + re-estampa el ac_hash local
```

Te muestra qué va a cambiar allá arriba y **pide confirmación** antes de pisar la US
(`--dry-run` para solo mirar, `--yes` para saltar la pregunta). Sin `--us` toma el `us.md`
que está junto a tu `implements.yaml`.

> Que un criterio nuevo pase por el tracker no es burocracia: es lo que hace que el
> **PO se entere** de que la historia creció. Editar solo el `us.md` local deja el QUÉ
> partido en dos versiones y ninguna es la buena.

## Tus herramientas

- `/link-us`
- `/opsx:explore`
- `/opsx:propose`
- `/opsx:apply` — el agente implementa las tareas (con TDD)
- `/tdd` — la disciplina TDD que aplica el paso anterior
- `/dai-review`
- `dai check` · `dai pr` · `dai stamp` · `dai done` (limpieza, opcional)
- `dai update-us` — empuja al tracker una US que refinaste implementando
- `definition-of-done.md`
