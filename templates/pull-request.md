<!--
  TEMPLATE DE PULL / MERGE REQUEST · dai
  ─────────────────────────────────────────────────────────────────
  El PR es donde el CÓMO se hace revisable y donde se valida el link.
  Copiar como .github/pull_request_template.md (o el equivalente del repo).
  Lo puede pre-llenar `dai`/una skill a partir del implements.yaml y el diff.
-->

## 🔗 Implementa

- **US:** `ABC-###` @ `vX`  ·  ac_hash: `<hash>`  ·  verificado con `dai check` ✅
- **Link:** este PR está atado a la US vía `implements.yaml`.

> Si este PR no implementa una US (chore/fix sin ticket), borra esta sección y
> aclara el motivo — no se le exige link.

## Descripción

<!-- Breve propósito de este PR, en términos de negocio (2–4 líneas). -->

## Cambios realizados

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

<!-- US en el tracker, commit ancla, docs, issues. -->

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
