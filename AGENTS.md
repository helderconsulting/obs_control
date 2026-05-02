# Repository Guidelines

## Project Structure & Module Organization

This repository is currently a minimal TypeScript scaffold for an OBS control web application. Root files include `package.json`, `package-lock.json`, `tsconfig.json`, and `README.md`. The `spec/` directory stores assignment material; do not treat it as executable test code.

The intended app uses SvelteKit configured as an SPA, with a separate Node/Hono backend that acts as the API and websocket gateway to OBS Studio. When adding implementation code, prefer `src/routes/` for SPA pages, `src/lib/` for frontend components, stores, and API clients, backend-specific modules for Hono routes and OBS websocket logic, and `static/` for public assets.

## Build, Test, and Development Commands

- `npm install`: install dependencies from `package-lock.json`.
- `npm run format:check`: verify Prettier formatting.
- `npm run lint`: run ESLint with recommended TypeScript rules.
- `npm run typecheck`: run `tsc --noEmit`.
- `npm run test:e2e`: run the Playwright E2E suite in `e2e/`.
- `npm run check`: run formatting, linting, typechecking, and E2E tests.
- `npx playwright show-report`: open the last Playwright HTML report.

If the project is converted to SvelteKit, add and document scripts such as `npm run dev`, `npm run build`, and `npm run preview`.

## Coding Style & Naming Conventions

Use `CODING_GUIDELINES.md` as the source of truth when generating or reviewing implementation code.

Use TypeScript for new code. The current `tsconfig.json` enables `strict`, `noUncheckedIndexedAccess`, and `exactOptionalPropertyTypes`; satisfy these checks instead of weakening them.

Use Prettier for formatting and ESLint for linting. Prefer camelCase for variables/functions, PascalCase for components/classes, and kebab-case for route or asset filenames. Keep OBS communication isolated in the Node/Hono backend rather than UI components or client-side Svelte code.

## Testing Guidelines

This project follows a spec-first, BDD-oriented workflow. For each approved spec, define at least one Playwright E2E test that describes the user flow before implementation begins, for example starting a recording, switching scenes, and seeing the current recording filename update.

Playwright is configured in `playwright.config.ts` with tests under `e2e/`. Prioritize E2E flow coverage first, then add focused tests for OBS command mapping, error handling, API route behavior, and UI state changes. Name tests close to the flow or code they cover, for example `e2e/recording-flow.spec.ts`, `src/lib/server/obs-client.test.ts`, or `src/routes/api/recording/+server.test.ts`.

At minimum, run `npm run check` before submitting TypeScript changes. If E2E tests cannot run because the app/server is not implemented yet, state that limitation clearly.

## Commit & Pull Request Guidelines

Git history shows both a plain initial commit and a Conventional Commit style entry (`chore: init basic repository`). Prefer Conventional Commits going forward, such as `feat: add scene selector`, `fix: handle OBS connection failures`, or `test: cover recording API`.

Pull requests should include a short description, validation steps, linked issues when applicable, and screenshots or recordings for UI changes. Mention OBS setup assumptions, including websocket host, port, password configuration, and environment variables.

## Security & Configuration Tips

Never commit OBS passwords, local `.env` files, or stream-related secrets. Keep OBS credentials out of client-side Svelte code and access them only through the Node/Hono backend.
