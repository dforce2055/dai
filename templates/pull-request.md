<!--
  TEMPLATE DE PULL / MERGE REQUEST · dai
  ─────────────────────────────────────────────────────────────────
  Copiar como .github/pull_request_template.md (o el equivalente del repo).
  Lo puede pre-llenar `dai`/una skill a partir del implements.yaml y el diff.
-->

> **Un PR en dai entrega dos activos, y el review cubre los dos:**
> 1. **La implementación** — el código que resuelve la US.
> 2. **El spec trazable** — el `implements.yaml` con el link a la US y el `@version`
>    (`ac_hash`) verificado con `dai check` ✅. Sin esto, el código no sabe *a qué QUÉ*
>    responde, y el CI bloquea el PR (ver `governance/ci-rules.md`).

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
