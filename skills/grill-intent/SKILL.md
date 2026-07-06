---
name: grill-intent
description: Gate 0 of the SDD workflow — challenge the *problem* behind a clean user story before any spec is generated. Interrogates whether this is the right problem, for the right user, within constraints, and whether the story's implied solution is a premature jump. Produces intent.md and a verdict that can be "go to spec", "reframe", or "don't build". In the spirit of grill-me, specialized for problem-challenge. Invoke as /grill-intent on a user story (the output of grill-user-story). Use after grill-user-story and before openspec propose.
---

# grill-intent — Gate 0, challenge the problem

The highest-ROI gate in the cycle: catch the wrong feature *before* a single spec artifact is written. This challenges the problem behind a user story — it does not construct the story (`grill-user-story` did that) and does not design the solution (`openspec propose` / `design.md` does that).

A valid outcome is "don't build this" or "the real problem is different". That is the point of Gate 0, not a failure of it.

Fill [templates/intent.md](templates/intent.md). That template is the single source of truth for the shape — never restate it inline.

## Input

- The clean user story (output of `grill-user-story`).
- The constitution: `openspec/project.md`, `CLAUDE.md`, and the team's AI-native manifesto — the immutable constraints the problem must live within.

## The challenge (five axes)

Pull *up* from the story's "I want Y" to the problem underneath, and pressure-test it:

1. **Right problem** — what actually hurts today, in the user's terms? Is the story solving that, or a symptom?
2. **Right user** — who genuinely has this pain? Reject a generic actor; name the one who feels it.
3. **Why now / cost of inaction** — what happens if we don't do this? If "nothing much", that's a signal to stop.
4. **Constraints** — does the problem collide with anything in the constitution (security, stack, roles, performance, branding, hard limits)?
5. **Solution-lock** — the story says "I want Y". Is Y a premature jump? Is there a cheaper or different way to solve the *same* problem? Could we solve it by *not building*?

## Two hard cuts (non-negotiable)

1. **Cut on solutioning.** If the conversation slides into how to build it, or even into shaping the feature's behaviour, stop it: "we're testing the problem, not designing the solution." Design is later.
2. **Cut on rubber-stamping.** Do not emit the intent until the problem has actually survived a challenge — at minimum axes 1, 3 and 5 answered with something real. Approving the story's implicit problem unexamined is the exact failure this gate exists to prevent.

## Process

1. **Read** the user story and the constitution.
2. **Challenge, one axis at a time.** grill-me discipline: ask, listen, push, move on. Don't dump the five questions at once.
3. **Reach a verdict** — `a-spec` (problem survived, go to propose), `reframe` (the real problem is different, back to `grill-user-story`), or `descartar` (not worth solving now, stop and record why).
4. **Emit** the filled `intent.md` (default location `openspec/intents/<YYYYMMDD-slug>/intent.md`; adjust to where the manifesto puts intents). Embed the tracker ID (the issue/task key — Jira or ClickUp, per `DAI_PM` in the repo's `.env`) and the source story.

## Hand-off

If the verdict is `a-spec`, the validated `intent.md` plus the user story together are the description you hand to `/openspec:proposal` — propose explores the specs and codebase itself and generates `proposal.md`, `design.md`, `tasks.md` and the `specs/` deltas. If `reframe`, return to the story. If `descartar`, stop — that is the gate doing its highest-value work.
