# Tasks: Recording Control

## Overview

Estimated effort: 1-2 implementation sessions.

The work is organized to keep dependencies clean:

1. Foundation and shared types
2. Server domain and application services
3. Server infrastructure adapters and controller wiring
4. Client UI and websocket integration
5. Verification and polish

## Phase 1: Foundation

- [x] Set up the `client/` and `server/` folder structure described in the design.
- [x] Add shared TypeScript types for recording state, commands, and events if they need to be reused across client and server.
- [ ] Confirm the client SPA entry route renders a basic recording page shell.

## Phase 2: Server Domain and Application

- [ ] Implement the recording domain model with explicit idle, starting, recording, stopping, and error states.
- [ ] Add recording state transition helpers and duplicate-command guards in the domain layer.
- [ ] Define the recording repository port used by the application service.
- [ ] Implement the recording read application service that loads state through the repository.
- [ ] Implement the recording command application service that validates commands and coordinates OBS operations.

Dependencies:

- The domain model must exist before the application services.
- The repository port must exist before the read service and command service can be completed.

## Phase 3: Server Infrastructure

- [ ] Implement the recording repository infrastructure adapter.
- [ ] Implement the OBS recording adapter that starts and stops recording.
- [ ] Implement the Hono controller for `GET /recording` so it calls the application read service.
- [ ] Implement the websocket gateway for recording commands and broadcast events.
- [ ] Wire controller, application services, repository, and OBS adapter together in the server composition root.
- [ ] Add backend logging around command attempts, success, and failure.

Dependencies:

- The application services must exist before the controller and gateway can call them.
- The repository adapter must exist before the read service can return data.
- The OBS adapter must exist before the command service can complete start/stop flows.

## Phase 4: Client UI

- [ ] Build the recording page UI in `client/src/routes`.
- [ ] Fetch the bootstrap recording state from `GET /recording` on page load.
- [ ] Render start and stop controls based on the current recording state.
- [ ] Display the current recording status and filename when available.
- [ ] Connect the client to the websocket gateway and apply incoming recording events.
- [ ] Show success and error feedback in the UI using visible accessible states.

Dependencies:

- The server read endpoint must exist before the client bootstrap fetch can work.
- The websocket event contract must exist before the client can subscribe and update state.

## Phase 5: Verification and Polish

- [ ] Run the Playwright recording flow against the implemented UI.
- [ ] Fix any state mismatch between bootstrap data and websocket updates.
- [ ] Verify invalid duplicate commands are blocked and surfaced cleanly.
- [ ] Verify the unavailable OBS case shows a user-readable error.
- [ ] Run formatting, linting, and typechecking before completion.

## Risk Mitigation Tasks

- [ ] Add explicit handling for transitional `starting` and `stopping` states so the UI does not allow duplicate commands.
- [ ] Add a fallback error path for OBS connection failures and failed command responses.
- [ ] Keep repository reads behind the application service so the controller never accesses storage directly.
- [ ] Ensure the client never depends on OBS details or server-internal transport types.
