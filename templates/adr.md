<!--
  ARCHITECTURE DECISION RECORD (ADR) · dai
  ─────────────────────────────────────────────────────────────────
  Registra UNA decisión de fondo, con su contexto y sus consecuencias.
  Es inmutable una vez aceptada: si la decisión cambia, se escribe un
  ADR NUEVO que "supersede" a este (no se edita el viejo).

  Los ADR son la forma de enmendar el MANIFIESTO y de cerrar las
  decisiones abiertas de la metodología. Numerar secuencial: 0001, 0002…
  Nombre de archivo: NNNN-slug-corto.md
-->

# ADR-NNNN — <título de la decisión>

- **Estado:** propuesto | aceptado | supersedido por `ADR-XXXX`
- **Fecha:** YYYY-MM-DD
- **Decide:** <rol/persona con autoridad para la decisión>

## Contexto

Qué situación obliga a decidir. Las fuerzas en juego (restricciones, dolores,
requisitos). Lo suficiente para que alguien que cae de nuevo entienda por qué esto
no era obvio. Sin todavía elegir.

## Decisión

Lo que decidimos, en presente afirmativo: *"Usamos X."* Clara y sin ambigüedad.

## Consecuencias

Qué se vuelve más fácil y qué más difícil por haber decidido esto. Lo bueno **y**
lo que aceptamos pagar. Incluye las obligaciones nuevas (p. ej. "el CI ahora debe…").

## Alternativas consideradas

- **<Opción B>** — por qué se descartó.
- **<Opción C>** — por qué se descartó.

<!--
  Un buen ADR se lee en 2 minutos. Si necesita más, probablemente son varias
  decisiones: pártelo. La sección más valiosa es "Consecuencias" — es lo que el
  yo-del-futuro va a agradecer cuando se pregunte "¿por qué hicimos esto?".
-->
