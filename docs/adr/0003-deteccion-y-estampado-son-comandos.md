# ADR-0003 — La detección y el estampado son comandos, no infraestructura

- **Estado:** aceptado
- **Fecha:** 2026-07-03
- **Decide:** lead / arquitecto de la metodología

## Contexto

El ADR-0001 dice que la **autoridad** de la detección de atrasos es "el CI, que
re-deriva el `ac_hash` de la US viva y compara". Leído literal, suena a que hace
falta **montar un CI que corra del lado de Jira/ClickUp** antes de poder usar la
metodología — infraestructura pesada, y una barrera de entrada que contradice el
[Art. 14](../MANIFIESTO.md#art-14) (*no adelantar complejidad*).

Además, un equipo que ya está en escala N3 (organización grande federada; los niveles
N1/N2/N3 están en el [glosario](../glosario.md)) puede **no tener** todavía esa
automatización. La trazabilidad federada tiene que funcionar igual, de forma
**distribuida**, sin depender de que exista un pipeline corriendo.

El malentendido está en la palabra "CI". Jira/ClickUp **no ejecutan** nada: solo
**guardan** la US. La detección es comparar dos hashes — eso es un **comando**, no
un servidor.

## Decisión

La trazabilidad se expone como **comandos del CLI `dai`**, invocables por un humano
o por un CI indistintamente (mismo binario, mismo output — ADR-0002):

| Comando | Naturaleza | Qué hace |
|---|---|---|
| `dai ac-hash <us>` | puro | calcula el hash de los criterios (ADR-0001). |
| `dai check` | **read-only** | lee el `implements.yaml` del repo + la US viva, re-deriva el hash y **compara**. Reporta al día / ⚠️ atrasado. Exit code ≠ 0 si hay atraso → sirve de **gate de PR**. **No escribe nada.** |
| `dai stamp` | **write** | calcula la cobertura derivada y la **escribe en el tracker** (la trazabilidad inversa del Art. 10: "`<repo>` @ `<version>` ✅/⚠️"). Requiere token de escritura. |

**El tracker solo almacena y sirve la US.** La lógica corre donde se invoca el
comando: la máquina del dev, un git-hook, o un pipeline.

### Modo distribuido (sin infraestructura) vs automático

- **Distribuido (default, N1–N2 y N3 sin CI):** el dev corre `dai check` cuando
  quiere saber si está atrasado, y `dai stamp` después de mergear para publicar su
  cobertura. **Cero infraestructura nueva.** Depende de disciplina (alguien tiene
  que correr `dai stamp`), mitigable con un git-hook local.
- **Automático (N3 maduro):** el CI que la organización **ya tiene** corre
  `dai check` como gate y `dai stamp` al mergear. La automatización es, literalmente,
  *"correr los mismos comandos en un hook"* — no hay un código distinto.

Pasar de distribuido a automático es mover la invocación, no reescribir nada.

## Consecuencias

- ✅ **No hace falta ningún CI para empezar.** La metodología arranca con un dev
  tipeando `dai check` / `dai stamp`. El Art. 14 queda respetado.
- ✅ **Rampa de adopción continua:** manual → git-hook → CI, siempre el mismo comando.
- ✅ **Honra el Art. 10:** el humano *dispara* la derivación; no *escribe a mano* el
  contenido (eso sigue prohibido). Un `dai stamp` corrido por una persona escribe lo
  mismo que uno corrido por el CI.
- ✅ Un equipo N3 sin pipeline tiene trazabilidad federada **distribuida** ya mismo.
- ⚠️ En modo distribuido, `dai stamp` depende de que alguien lo corra. `dai check`
  como git-hook o gate de PR reduce el riesgo de olvido.
- ⚠️ Ambos comandos necesitan **leer** la US viva (y `dai stamp`, escribir): eso es el
  adaptador de PM (Jira/ClickUp/`.md`), que sigue siendo decisión abierta (§7). Pero
  es un token + llamadas HTTP, **no** un CI.

## Alternativas consideradas

- **Exigir un CI corriendo en Jira/ClickUp** — descartado: barrera de entrada que
  contradice el Art. 14 y que además es un fantasma (el tracker no ejecuta nada).
- **Estampar la cobertura a mano en el tracker** — descartado: viola el Art. 10 (el
  contenido debe derivarse, no escribirse a mano) y se desincroniza.
- **Un solo comando que compare y escriba a la vez** — descartado: separar `check`
  (read-only, gate) de `stamp` (write) permite usar `check` como gate de PR sin
  permisos de escritura, y correr `stamp` solo cuando corresponde.
