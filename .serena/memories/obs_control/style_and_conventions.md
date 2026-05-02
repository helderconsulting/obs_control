# Style and Conventions

- Use TypeScript for new code.
- Keep code compatible with `strict`, `noUncheckedIndexedAccess`, and `exactOptionalPropertyTypes`.
- Follow `CODING_GUIDELINES.md` as the source of truth.
- Prefer small, focused changes and spec-first development.
- Use SvelteKit SPA patterns for frontend code and a separate Node/Hono backend for OBS integration.
- Use camelCase for variables/functions, PascalCase for components/classes, and kebab-case for routes/assets.
- Prefer explicit domain types, type-only imports where appropriate, and avoid `any`.
- Prefer creating named variables for intermediate values instead of inlining complex expressions, especially in server-side code, response mapping, and adapter setup.