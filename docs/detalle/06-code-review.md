# Paso 6 — Code review: IA primero, partner después

← vuelve a [`SCRUM-CON-IA.md`](../SCRUM-CON-IA.md)

## El paso al 100%

Dos pasadas:

1. **IA** (`dai-review`) — primer pase consciente de la metodología: corre
   `dai check` (¿la US quedó atrasada?), valida el DoD, revisa el código
   (🔴 errores / 🟡 mejoras / ✅ bien) y deja un **comentario estándar** en la PR/MR.
2. **Partner humano** — revisa lo que importa (sin el ruido que ya barrió la IA) y
   **firma** la aprobación.

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
