---
allowed-tools: Bash(cat:*), Bash(test:*), Bash(ls:*), Write
description: Create Playwright E2E flow tests from an approved specification
---

## Context

Current spec: !`cat spec/.current-spec 2>/dev/null`
Design approved: !`test -f spec/$(cat spec/.current-spec)/.design-approved && echo "Yes" || echo "No"`
Current E2E tests: !`ls -la e2e/ 2>/dev/null`

## Your Task

Create or update the Playwright E2E test suite for the current active specification.

1. Verify `design.md` exists and `.design-approved` is present.
2. If the design is not approved, inform the user to complete and approve design first.
3. Use one E2E suite per spec: `1 suite : 1 spec`.
4. Name the E2E file after the spec directory so it is easy to trace, for example:
   - Spec: `spec/001-recording-control/`
   - E2E: `e2e/001-recording-control.spec.ts`
5. Write tests before implementation starts. These tests should describe the intended user behavior and may fail until the feature is implemented.
6. Include at least:
   - A happy flow covering the main user journey.
   - Edge cases for validation, unavailable OBS connection, failed commands, empty states, or other error handling described by the spec.
7. Keep tests user-focused: assert visible UI states, accessible roles, feedback messages, and navigation rather than implementation details.
8. Reuse Playwright from `@playwright/test` and follow the existing `playwright.config.ts` setup.
9. After creating the suite, tell the user to approve the E2E phase before task planning begins.

Use the Write tool to create or update the matching file in `e2e/`.
