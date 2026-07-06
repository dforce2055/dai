# Paso 6 — Code review: el dev primero, después un partner

← vuelve a [`SCRUM-CON-IA.md`](../SCRUM-CON-IA.md)

## En qué consiste en detalle

Dos revisiones distintas:

1. **El dev revisa su propia implementación** — la que produjo la IA, minucioso y con
   criterio (correctitud, casos borde, seguridad, calidad). Es responsable del código, no
   la IA (anti vibe-coding). Recién con eso en orden, y todo **commiteado**, crea la PR.
2. **Un partner revisa la PR** y **firma** aprobación/rechazo. Se apoya en la skill
   `dai-review` para un primer pase consciente de la metodología: corre `dai check` (¿la US
   quedó atrasada?), valida el DoD, revisa el código (🔴 errores / 🟡 mejoras / ✅ bien) y
   deja un **comentario estándar** en la PR/MR — le saca el ruido para que firme lo que importa.

## Herramientas

- Skill [`dai-review`](../../skills/dai-review/SKILL.md) — GitHub y GitLab, postea por
  MCP del forge o por `dai forge comment` (token).
- `dai check` ([ADR-0003](../adr/0003-deteccion-y-estampado-son-comandos.md)).
- Gate de cierre: [`definition-of-done.md`](../../templates/definition-of-done.md).

## Qué firma el humano

El **partner aprueba o rechaza** ([Art. 5](../MANIFIESTO.md#art-5)). La IA comenta y sugiere; **nunca** firma
la aprobación.

## Antipatrones

- **Rubber-stamp** ("LGTM" sin leer) → el review deja de valer.
- **Que la IA "apruebe"** → prohibido; aprueba una persona.
- **Hallazgos abstractos** ("mejorar la calidad") → sin archivo:línea, no es accionable.
- **Aprobar con `dai check` en ⚠️ atrasado** → se implementó una versión vieja del QUÉ.
