<!--
  TEMPLATE DE PULL / MERGE REQUEST · dai
  ─────────────────────────────────────────────────────────────────
  Copiar como .github/pull_request_template.md (o el equivalente del repo).
  Lo puede pre-llenar `dai`/una skill a partir del implements.yaml y el diff.
-->

## 🔗 Implementa

- **US:** `ABC-###` @ `vX`  ·  ac_hash: `<hash>`  ·  verificado con `dai check` ✅

<!--
  Un PR en dai entrega DOS activos, y el review cubre los dos: la implementación (el código
  que resuelve la US) y el spec trazable (el `implements.yaml` con el link a la US y el
  `@version`/`ac_hash` verificado). Sin el link, el código no sabe a qué QUÉ responde y el
  CI bloquea el PR — ver `governance/ci-rules.md`.

  ¿Chore o fix sin ticket? No hay nada que borrar: `dai pr` lo detecta por el nombre de la
  branch y escribe "Sin US" con el motivo. No se le exige link.

  Esto es un comentario a propósito: es doctrina del método, igual en las 500 PRs del repo.
  Repetirla a la vista en cada una entrena a saltear el principio del cuerpo, que es
  justamente donde va la descripción.
-->

## Descripción

<!--
  Breve propósito de este PR, en términos de negocio (2–4 líneas).
  Lo precarga `dai pr --description "…"` (o `--description-file <archivo.md>`).
  dai NO lo inventa: si esta sección queda sin llenar, `dai pr` no publica la PR.
-->

## Cambios realizados

<!--
  Lo precarga `dai pr` con los commits de la branch; `--changes` / `--changes-file`
  lo reemplazan por el detalle que quieras contar.
-->

- [ ] Cambio 1
- [ ] Cambio 2

## Testing

- [ ] Tests unitarios pasando
- [ ] Tests de integración pasando
- [ ] Smoke end-to-end (`dai`/skill) pasando
- [ ] Probado manualmente

## Documentación

- [ ] README/docs actualizados (si aplica)
- [ ] Comentarios en código agregados donde hacía falta

## Enlaces relacionados

<!--
  La US, la branch y el commit ancla los precarga `dai pr` en el bloque `dai:links`
  de abajo: NO los escribas a mano ni reescribas ese bloque (se regenera y te lo pisa).
  Acá abajo sumá solo lo que dai no sabe: docs, issues, PRs relacionadas, dependencias.
-->

---

## Checklist del Desarrollador (Definition of Done)

- [ ] `implements.yaml` presente y `dai check` en **verde** (no atrasado).
- [ ] Mi código sigue los estándares y está cubierto por tests (interfaz pública).
- [ ] La funcionalidad satisface los **criterios de aceptación** de la US.
- [ ] Documenté los cambios y revisé posibles vulnerabilidades de seguridad.

_(Checklist completo: `templates/definition-of-done.md`.)_

## Checklist del Aprobador

- [ ] Revisé los cambios y entiendo su propósito e impacto.
- [ ] Verifiqué la calidad del código y la cobertura de tests.
- [ ] Me comprometo a dar soporte en caso de problemas post-implementación.
