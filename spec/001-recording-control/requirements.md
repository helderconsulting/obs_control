# Requirements: Recording Control

## Feature Overview

Build the recording portion of an OBS control application. The user must be able to start and stop OBS Studio recording from the app, see the current recording state, and receive feedback when a command succeeds or fails. The feature must use a separate backend to communicate with OBS rather than connecting directly from the browser.

## User Stories

### 1. Start recording

As an operator, I want to start OBS recording from the app so I can begin capturing content without opening OBS directly.

Acceptance criteria:

- A visible control allows the user to request "start recording".
- The app sends the start command through the backend.
- The UI shows that recording is active after the command succeeds.
- If recording is already active, the user sees a clear disabled state or message instead of sending a duplicate command.

### 2. Stop recording

As an operator, I want to stop OBS recording from the app so I can end capture from the same control surface.

Acceptance criteria:

- A visible control allows the user to request "stop recording".
- The app sends the stop command through the backend.
- The UI shows that recording is no longer active after the command succeeds.
- If recording is not active, the user sees a clear disabled state or message instead of sending an invalid command.

### 3. See current recording status

As an operator, I want to see whether OBS is currently recording so I know which action is available.

Acceptance criteria:

- The app loads initial recording state from a backend read endpoint.
- The UI reflects idle, recording, and transitional/error states if the backend provides them.
- The current state updates after the user issues a command and the backend confirms the change.

### 4. See recording feedback

As an operator, I want command success and failure feedback so I can tell whether OBS accepted my request.

Acceptance criteria:

- Success feedback is shown when the recording state changes.
- Error feedback is shown when OBS cannot be reached, rejects the command, or returns an unexpected result.
- Error messages are human-readable and do not expose raw transport details by default.

## Functional Requirements

### P0

- Provide a UI for starting and stopping OBS recording.
- Route recording commands through the backend websocket gateway.
- Expose a read-only backend endpoint for reconstructing recording state after reload.
- Keep recording credentials and OBS websocket access on the backend only.
- Prevent invalid duplicate actions when the current state already makes the request impossible.
- Show clear success and error feedback in the UI.

### P1

- Keep the UI synchronized with backend-driven realtime updates after a command succeeds.
- Represent recording state with a small, explicit domain model.
- Handle temporary connection failures with retry-safe UI behavior and actionable error feedback.
- Preserve the last known recording filename or other metadata if the backend exposes it.

### P2

- Include lightweight loading or pending indicators while a recording command is in flight.
- Provide telemetry or structured logging on the backend for recording command attempts and failures.
- Support richer status display if OBS exposes extra recording metadata.

## Non-Functional Requirements

- The implementation must use TypeScript and remain compatible with the repository's strict compiler settings.
- The feature must follow the repo architecture: SvelteKit SPA frontend, Node/Hono backend, OBS integration isolated to backend adapters.
- The UX must be simple and understandable on desktop and mobile widths.
- The implementation must avoid exposing OBS credentials or websocket details to the client.
- Error states must be recoverable without a page reload whenever possible.

## Constraints and Assumptions

- OBS Studio is available and configured with websocket access on the user's machine or target host.
- The backend can reach OBS over the websocket connection.
- The project will continue to use a spec-first workflow with Playwright E2E coverage before implementation.
- The frontend should not call OBS directly.
- This feature only covers recording control, not scene switching or stream start/stop behavior.

## Out of Scope

- Switching scenes.
- Starting or stopping live streaming.
- Managing OBS profiles, collections, or scene collections.
- Advanced recording configuration, such as output path selection or codec settings.
- Authentication or multi-user permissions beyond local app access assumptions.

## Success Metrics

- A user can start recording from the app and see the UI update to the active state.
- A user can stop recording from the app and see the UI update to the inactive state.
- The app shows a clear error message when OBS is unavailable or rejects a command.
- The recording workflow can be exercised through an automated Playwright E2E test.
