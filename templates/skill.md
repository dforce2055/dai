<!--
  MOLDE DE SKILL · dai
  ─────────────────────────────────────────────────────────────────
  Formato: Agent Skills (SKILL.md) — un estándar abierto que leen Claude, Copilot y
  Cursor. dai lo INGIERE y lo distribuye a los 3 (Claude y Copilot copia cruda · Cursor
  `skillToCursor`), con `dai skills install --from <repo|path>` (ADR-0013 · ADR-0014).

  Estructura del repo/dir fuente:
      skills/
        <nombre-de-la-skill>/
          SKILL.md            ← este archivo (renombrado a SKILL.md, en MAYÚSCULAS)
          <recursos...>       ← opcional: scripts, plantillas, refs que la skill use

  CONTRATO MÍNIMO que dai valida (si falta, la salta con un warn):
    - frontmatter con `name` y `description` (ambos obligatorios, en una línea).
    - `name`: slug en kebab-case, IGUAL al nombre del directorio.
    - `description`: una frase — con esto el agente decide CUÁNDO usar la skill.
    - ambos, YAML VÁLIDO. Ojo: los asistentes parsean el frontmatter con YAML de
      verdad, y un `: ` (dos puntos + espacio) suelto en la descripción hace que YAML
      la lea como un mapa y DESCARTE LA SKILL ENTERA. Por eso la descripción va
      SIEMPRE entre comillas dobles: te deja escribir la frase que quieras.

  dai NO valida el CONTENIDO (qué dice la skill, qué hacen sus scripts): eso es
  criterio del equipo. Las instalás bajo tu propio riesgo.
-->
---
name: mi-skill
description: "Qué hace la skill y cuándo conviene invocarla: concreto y orientado al disparador. Las comillas dobles no son decorativas — sin ellas, un ': ' rompe el YAML."
---

# <Título de la skill>

Instrucciones para el agente: qué hacer, paso a paso. El **cuerpo es el mismo** para
Claude, Cursor y Copilot — dai solo ajusta el frontmatter por asistente.

## Cuándo usarla

El disparador concreto (qué pide el usuario, o qué situación la activa).

## Pasos

1. …
2. …
3. …

## Notas

Convenciones del stack, ejemplos, o límites de la skill. Si necesita archivos de
apoyo, ponelos junto al `SKILL.md` y referencialos por ruta relativa.
