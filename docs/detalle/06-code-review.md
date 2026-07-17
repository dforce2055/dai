# Paso 6 — Code review: el dev primero, después un partner

← vuelve a [`SCRUM-CON-IA.md`](../SCRUM-CON-IA.md)

## En qué consiste en detalle

Dos revisiones distintas:

1. **El dev revisa su propia implementación** — la que produjo la IA, minucioso y con
   criterio (correctitud, casos borde, seguridad, calidad). Es responsable del código, no
   la IA (anti vibe-coding). Solo con eso en orden, y todo **commiteado**, crea la PR.
2. **Un partner revisa la PR** y **firma** aprobación/rechazo. Se apoya en la skill
   `dai-review` para un primer pase consciente de la metodología: corre `dai check` (¿la US
   quedó atrasada?), valida el DoD, revisa el código (severidad low/medium/high) y deja un
   **review inline** — un resumen + **un comentario anclado a cada `archivo:línea`**. La
   skill valida cada posición contra el diff (descarta lo que el modelo inventó), te muestra
   el preview y **espera tu OK antes de postear** ([ADR-0016](../adr/0016-review-inline.md)).

## Herramientas

- Skill [`dai-review`](../../skills/dai-review/SKILL.md) — GitHub y GitLab. Postea el review
  inline por el MCP del forge o por `dai forge review <ref> --from <review.json>` (token);
  `dai forge comment` queda como fallback simple sin anclar.
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
