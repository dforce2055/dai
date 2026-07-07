# ADR-0009 — Adaptador nativo para Cursor

- **Estado:** propuesto
- **Fecha:** 2026-07-07
- **Decide:** lead / arquitecto de la metodología

## Contexto

ADR-0002 consolidó la estrategia agnóstica por asistente con tres capas: contenido
portable, CLI determinista y adaptadores delgados/generados por asistente. La
implementación actual cubre Claude y Copilot, pero no Cursor de forma nativa.

En la práctica, equipos que usan Cursor quedan con una experiencia incompleta: no
hay scaffolding en `.cursor/skills/`, no existe constitución always-on en rules, y
`dai doctor` / `dai install` no diagnostican ni instalan superficies de Cursor.

Cursor soporta skills (`.cursor/skills/<name>/SKILL.md`) y rules
(`.cursor/rules/*.mdc`) de forma nativa, y OpenSpec soporta `cursor` en `--tools`.
Eso permite agregar soporte sin romper el contrato existente ni duplicar lógica.

## Decisión

Incorporamos Cursor como tercer adaptador generado en la capa 3:

1. `dai init --for` acepta `cursor` y `all`, además de `claude`, `copilot`, `both`.
2. El default de `dai init` pasa a `all` (Claude + Copilot + Cursor).
3. `both` mantiene su significado histórico (Claude + Copilot), para compatibilidad
   semántica.
4. Las skills de Cursor se generan en `.cursor/skills/` desde la misma fuente
   (`skills/*/SKILL.md`) con `skillToCursor()`.
5. El transformador de Cursor conserva `name`, `description` y cuerpo, y no agrega
   `disable-model-invocation` (se permite auto-invocación por descripción).
6. La constitución de Cursor se genera como rule `.mdc` en
   `.cursor/rules/dai-constitution.mdc` con `alwaysApply: true`.
7. `dai doctor` reporta skills y constitución en rutas locales/globales de Cursor.
8. `dai install` soporta Cursor vía `--for claude|cursor|all` (default `all`).
9. OpenSpec mapea `--for all` a `claude,github-copilot,cursor`.

## Consecuencias

- ✅ La metodología mantiene su principio agnóstico también para Cursor, sin bifurcar
  contenido de skills.
- ✅ Equipos mixtos pueden coexistir en un repo con Claude, Copilot y Cursor sin
  pisarse (carpetas separadas).
- ✅ El runtime mecánico sigue centralizado en CLI (`dai`), sin mover lógica
  determinista a prompts.
- ✅ Cursor recibe constitución always-on alineada a Claude/Copilot.
- ⚠️ Cambia el comportamiento por defecto de `dai init` (de `both` a `all`); requiere
  documentación clara para evitar sorpresa.
- ⚠️ `dai install` ahora maneja más de un target de asistente y aumenta la superficie
  de mantenimiento.

## Alternativas consideradas

- **Depender de `.claude/skills/` por compatibilidad de Cursor** — descartado: no da
  soporte profesional de rules/doctor/install y contradice la idea de adaptador
  nativo generado.
- **Redefinir `both` para incluir Cursor** — descartado: rompe semántica histórica del
  valor; se prefiere agregar `all`.
- **Forzar `disable-model-invocation: true` en Cursor** — descartado para este repo:
  se busca paridad de auto-invocación con Claude.
- **Constitución de Cursor en `AGENTS.md`** — descartado: la superficie nativa always-on
  de Cursor son `.cursor/rules/*.mdc`.
