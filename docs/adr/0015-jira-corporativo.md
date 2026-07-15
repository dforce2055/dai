# ADR-0015 — `dai publish` en un Jira corporativo (campos propios, épicas, TLS)

- **Estado:** aceptado
- **Fecha:** 2026-07-15
- **Decide:** lead / arquitecto de la metodología

## Contexto

`dai publish` funcionaba contra un Jira limpio y fallaba contra uno real. Lo vimos en
vivo: un analista funcional intentó publicar su primera US en el Jira de su empresa y
`createUS` mandaba solo `project`, `issuetype`, `summary` y `description`. El proyecto
exigía un campo propio (`Tipo de trabajo`, `customfield_10042`) → **400 en todos
los intentos**. Además el proxy corporativo intercepta TLS con su propia CA, y Node no
usa el trust store del sistema → `fetch` reventaba antes de llegar.

**Lo que pasó después es el verdadero motivo de esta ADR.** El asistente, bloqueado por
el CLI, improvisó: leyó el schema del campo por su cuenta, armó la llamada a la API de
Jira con `node -e`, y para pasar el proxy corrió `NODE_TLS_REJECT_UNAUTHORIZED=0` —
apagando la verificación de certificado **mientras mandaba el token de Jira**. Lo
reportó como *"nota técnica resuelta en el camino"*. Su propio razonamiento fue:
*"bypassing dai's limitation entirely"*.

Publicó bien, de casualidad. Pero eso es exactamente lo que la capa 2 de la
[ADR-0002](0002-agnostico-del-asistente.md) existe para evitar: *"el output es idéntico
con Claude, con Copilot, o sin ningún asistente"*. **Cuando el CLI no llega, el agente
inventa** — y el improviso siguiente puede no respetar el contrato del `ac_hash`, y ahí
la trazabilidad se rompe en silencio.

La lección: **un CLI que no cubre el caso real no es neutral, es una invitación a
puentearlo.** Cada hueco de la capa 2 se llena con inteligencia no determinista.

## Decisión

**1. Los campos propios se declaran, con nombre humano y opciones válidas.**
`.dai/jira-fields.json` (o `DAI_JIRA_FIELDS_FILE`), por issuetype:

```json
{
  "Story": {
    "clasificacion": {
      "field": "customfield_10042",
      "shape": "select",
      "default": "Mejora",
      "options": ["Mejora", "Corrección"]
    }
  }
}
```

- **Por issuetype**, porque en Jira corporativo los campos obligatorios de una Epic y de
  una Story casi nunca son los mismos.
- **`default` + `--field alias=valor`**, porque el valor **no es config fija**: la
  clasificación es Mejora o Corrección *según la US*. Un default fijo publicaría todas
  iguales — un dato incorrecto en Jira, en silencio, que es peor que fallar.
- **`options` valida ANTES de la red.** Un typo da `'Mejraa' no es opción de
  'clasificacion' — válidas: Mejora | Corrección`, no un 400 críptico.
- **Un campo declarado tiene que resolver** (default u override): se declara porque Jira
  lo exige. Si es opcional, no se declara.
- **`shape`** cubre las formas de Jira (`select` `{value:X}` · `text` X · `multi`
  `[{value:X}]`), con **`raw`** como escape hatch para cualquier cosa rara: dai no
  necesita entender todo Jira para no estorbar.
- **Sin archivo → `{}`.** Un Jira sin campos obligatorios publica igual que siempre.

**2. `--parent` y `--issuetype`.** `--parent` cuelga la US de su épica (`createUS` nunca
mandaba `parent`); `--issuetype Epic` permite que **`grill-epic` publique épicas por
CLI**, que hasta hoy no tenían fallback y quedaban como un `.md` para pegar a mano.

**3. Un fallo de TLS enseña el camino correcto, y desaconseja el peligroso.** `daiFetch`
traduce los códigos de certificado a un error que manda a **`NODE_EXTRA_CA_CERTS`** y
dice explícitamente por qué `NODE_TLS_REJECT_UNAUTHORIZED=0` no es una alternativa. dai
**nunca** baja la verificación por su cuenta.

**4. `DAI_JIRA_PROJECT` se valida.** `PROJ-42` es un ticket, no un proyecto — el
error de config más común. El mensaje da los dos caminos: `DAI_JIRA_PROJECT=PROJ`, o
`--parent PROJ-42` si lo que querías era colgarla de esa épica.

**5. La constitución prohíbe las dos maniobras**, para todos los asistentes:

> - **No bajes la seguridad para avanzar:** si una llamada falla por el certificado,
>   declara la CA. Nunca `NODE_TLS_REJECT_UNAUTHORIZED=0`, `verify=False`, `-k`.
> - **Si el CLI no llega, para y dilo:** no improvises una llamada a la API por fuera.

## Consecuencias

- **`dai publish` sirve en un Jira corporativo**, que es donde vive el usuario real.
- **`grill-epic` gana un fallback CLI**: MCP → `dai publish --issuetype Epic` → `.md`.
- **El caso que motivó el bypass ahora está cubierto**, que es la única forma honesta de
  pedirle a un agente que no improvise: no dejarle el hueco.
- **`dai doctor`** valida la clave de proyecto y que el archivo de campos parsee. Sigue
  **sin** verificar que el token sirva — eso es red, y lo dice `dai publish`. El chequeo
  ahora lo admite en voz alta en vez de dar un ✓ engañoso.
- **ClickUp queda con el mismo hueco de TLS.** `daiFetch` está listo para adoptarse allá
  con un import; no lo hicimos ahora por alcance.

## Alternativas descartadas

- **Una sola variable `DAI_JIRA_FIELDS={"customfield_10042":{"value":"Mejora"}}`.**
  Una línea ilegible, sin distinguir Story de Epic, sin validación, y con el valor fijo
  — el problema original.
- **Resolver los nombres de campo contra `createmeta` de Jira.** Menos config, pero pide
  red para armar el payload, y falla distinto según permisos. Un archivo explícito se lee
  y se versiona.
- **Que dai reintente sin verificar TLS si el certificado falla.** Es exactamente lo que
  hizo el agente. Automatizarlo sería institucionalizar el bug.
