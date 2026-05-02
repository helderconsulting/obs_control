# Project Overview

`obs_control` is a minimal TypeScript scaffold for an OBS Studio control web application. The stated target architecture is a SvelteKit SPA frontend with a separate Node/Hono backend that talks to OBS Studio via websocket. The README calls out recording control, scene switching, and current recording filename display as core functionality.

Repository structure today is minimal: root config files, `README.md`, `CODING_GUIDELINES.md`, `playwright.config.ts`, and `e2e/` for Playwright tests. A `spec/` directory is used for specification-first workflow artifacts.