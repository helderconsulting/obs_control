# Design: Recording Control

## Architecture Overview

The recording feature is split into a browser client and a server backend.

- The client is a SvelteKit SPA that renders recording status and start/stop controls.
- The server is a Node/Hono backend that owns OBS communication, state projection, and websocket broadcasting.
- The client reads the current recording state from the server on load.
- The client sends recording commands to the server over a websocket gateway.
- The server validates commands, talks to OBS, updates its recording projection, and broadcasts state changes back to connected clients.
- The server exposes an application service for reading the recording state from the repository and another application service for issuing recording commands.

### Folder Structure

The implementation should use two top-level application folders:

```text
client/
  src/
    routes/
    lib/
      components/
      stores/
      api/
      types/
  static/

server/
  src/
    domain/
      recording.ts
    application/
      recording-control.ts
    infrastructure/
      recording-controller.ts
      recording-websocket-gateway.ts
      obs-recording-adapter.ts
      sqlite-recording-repository.ts
      recording-logger.ts
```

- `client/src/routes` contains the SPA pages.
- `client/src/lib` contains reusable client-safe UI code, stores, and API helpers.
- `server/src/domain` contains pure recording state and transition logic.
- `server/src/application` contains the recording control services, validation, and command/event contracts grouped by feature.
- `server/src/infrastructure` contains controllers, websocket wiring, OBS transport, repository/storage, and logging adapters.

## Technology Stack Decisions

- Use TypeScript throughout.
- Use SvelteKit in SPA mode for the frontend.
- Use Hono for backend HTTP endpoints and controller wiring.
- Use a websocket gateway for recording commands and realtime updates.
- Keep OBS access isolated to a backend adapter such as `obs-websocket-js`.
- Use Playwright for the end-to-end recording flow.

## Data Model and Schema

### Recording model

Use a compact recording state model with explicit states:

```ts
export type RecordingIdle = {
  status: 'idle';
};

export type RecordingStarting = {
  status: 'starting';
};

export type RecordingActive = {
  status: 'recording';
  currentFilename: string | null;
};

export type RecordingStopping = {
  status: 'stopping';
};

export type RecordingError = {
  status: 'error';
  message: string;
};

export type Recording = RecordingIdle | RecordingStarting | RecordingActive | RecordingStopping | RecordingError;
```

### Command model

Recording commands are sent from the client to the server over websocket messages:

```ts
export type StartRecordingCommand = {
  type: 'recording.start';
};

export type StopRecordingCommand = {
  type: 'recording.stop';
};

export type RecordingCommand = StartRecordingCommand | StopRecordingCommand;
```

### Event model

The server broadcasts explicit events with state deltas:

```ts
export type RecordingStartedEvent = {
  type: 'recording.started';
  aggregate: 'recording';
  occurredAt: string;
  delta: {
    status: 'recording';
    currentFilename: string | null;
  };
};

export type RecordingStoppedEvent = {
  type: 'recording.stopped';
  aggregate: 'recording';
  occurredAt: string;
  delta: {
    status: 'idle';
  };
};

export type RecordingFailedEvent = {
  type: 'recording.failed';
  aggregate: 'recording';
  occurredAt: string;
  delta: {
    status: 'error';
    message: string;
  };
};
```

## API Design

### HTTP

- Use GET endpoints only for bootstrap/read models.
- The controller must call an application service to load the recording state.
- The application service reads from the repository and returns the read model to the controller.

- `GET /recording` returns the current recording read model.

### Websocket

Use websocket messages for commands and realtime updates.

- Client -> server:
  - `recording.start`
  - `recording.stop`
- Server -> client:
  - `recording.started`
  - `recording.stopped`
  - `recording.failed`

### Controller responsibility

The controller layer should only handle HTTP request/response wiring and websocket message entry points. It should not contain OBS logic, recording rules, or direct repository access.

### Repository responsibility

- The repository stores or reconstructs the latest recording read model.
- The GET endpoint reads from the repository to serve the bootstrap state.
- The application layer depends on a repository port, not on Hono or OBS directly.
- The infrastructure layer provides the repository implementation, which may be in-memory at first and later backed by durable storage if needed.

### Application service responsibility

- The application service is the only layer allowed to read from the repository on behalf of the controller.
- The controller calls the application service for `GET /recording`.
- The controller also calls the application service for command validation and OBS operations through the use-case boundary.

## Security Considerations

- OBS credentials stay on the server and never reach the browser.
- The browser talks only to the backend API and websocket gateway.
- Validate websocket payloads at the server boundary before dispatching use cases.
- Reject invalid duplicate commands before calling OBS.

## Performance Considerations

- Keep the recording repository in memory or in a lightweight backend store so the bootstrap read remains fast.
- Broadcast only small recording delta events rather than large full-state snapshots.
- Avoid polling while websocket updates are available.

## Deployment Architecture

- The frontend is served as an SPA.
- The backend runs as a separate Node process.
- The backend must be able to reach OBS Studio over the configured websocket connection.
- The deployment should allow configuring OBS host, port, and password through environment variables.

## Technical Risks and Mitigations

- OBS state may change outside the app.
  - Mitigation: bootstrap from the server read model and keep the client synchronized with websocket events.
- Recording commands may be asynchronous.
  - Mitigation: represent transitional states such as `starting` and `stopping`.
- The OBS connection may fail.
  - Mitigation: return structured error states and keep the UI recoverable without a page reload.
- The client may send duplicate commands while a transition is in progress.
  - Mitigation: validate command eligibility in the domain/application layer before issuing OBS calls.
