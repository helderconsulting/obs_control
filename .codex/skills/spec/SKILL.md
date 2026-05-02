---
name: spec
description: Use this skill for specification-driven development workflows in this repository, including creating and switching specs, drafting requirements/design/tasks, approving phases, reviewing spec progress, starting implementation from approved tasks, and marking spec tasks complete.
---

# Spec Workflow

This skill uses the command files in this folder for skill behavior. Use it when the user asks to manage a feature specification, mentions `/spec:*`, or asks for requirements, design, task planning, approvals, implementation phases, status, review, or task completion under `spec/`.

## Repository Layout

- Active spec pointer: `spec/.current-spec`
- Spec directories: `spec/[ID]-[feature-name]/`
- Phase files: `requirements.md`, `design.md`, `tasks.md`
- E2E files: `e2e/[spec-directory-name].spec.ts`
- Approval markers: `.requirements-approved`, `.design-approved`, `.e2e-approved`, `.tasks-approved`

## Workflow

1. Create or select a spec.
2. Draft `requirements.md`.
3. Approve requirements by creating `.requirements-approved`.
4. Draft `design.md`.
5. Approve design by creating `.design-approved`.
6. Create the matching Playwright E2E suite for the spec.
7. Approve E2E coverage by creating `.e2e-approved`.
8. Draft `tasks.md`.
9. Approve tasks by creating `.tasks-approved`.
10. Implement tasks sequentially and update checkboxes in `tasks.md`.

Do not skip an approval gate unless the user explicitly asks to override the workflow.

## Intent Mapping

Use the command files as reference procedures when the matching intent appears:

- New spec: read `new.md`.
- Requirements: read `requirements.md`.
- Design: read `design.md`.
- E2E flow tests: read `e2e.md`.
- Task planning: read `task.md`.
- Approvals: read `approve.md`.
- Implementation: read `implement.md`.
- Status report: read `status.md`.
- Switch active spec: read `switch.md`.
- Review current phase: read `review.md`.
- Mark task complete: read `update-task.md`.

These files were originally command prompts. Treat `$ARGUMENTS` as the user-provided feature name, phase, spec ID, phase number, or task identifier. Treat embedded shell snippets as context-gathering guidance, not text to copy verbatim into final answers.

## Operating Rules

- Inspect `spec/.current-spec` before modifying an existing spec.
- Create missing directories and files only inside `spec/`.
- Preserve user edits in existing spec documents; update only the relevant section or task line.
- Use Markdown checkboxes for implementation tasks: `- [ ]` and `- [x]`.
- Keep generated spec documents concrete and implementation-oriented.
- When reporting status, include the active spec, phase approvals, task counts, and the next recommended action.
- After completing a phase, suggest the next step and ask for a yes/no decision before starting it, for example: `Next step is to create the E2E flow suite. Do you want me to start that now?`
