# Coding Guidelines

Use this document as the source of truth when generating or reviewing implementation code for this repository.

## Core Principles

- Follow the active spec, approved design, and matching E2E flow before implementing.
- Prefer small, focused changes that satisfy the current task.
- Keep behavior user-visible and testable through Playwright where possible.
- Do not weaken TypeScript strictness to make code pass.

## TypeScript

- Use TypeScript for all new application code.
- Keep `strict`, `noUncheckedIndexedAccess`, and `exactOptionalPropertyTypes` compatible code.
- Prefer explicit domain types for OBS responses, recording state, scene data, and API payloads.
- Use type aliases/interfaces plus `const` functions. Do not introduce classes for domain, application, or adapter code unless an external library requires one.
- Prefer named types for object shapes, dependency bags, return values, and responses. Avoid inline object types except for trivial local values.
- Import runtime values explicitly; do not rely on Node globals when an import is clearer, for example `import { randomUUID } from 'node:crypto';`.
- Use type-only imports for types with `import type` or inline `import { type SomeType }`.
- Prefer concise domain names. Avoid suffixes like `State`, `Command`, and `Model` when a shorter name reads better.
- Avoid `any`; use `unknown` with narrowing when data crosses a boundary.
- Return structured results from server-side helpers instead of throwing raw strings.

## Architecture

- Use SvelteKit configured as an SPA for the frontend.
- Use a separate Node backend with Hono for backend APIs and websocket gateway behavior.
- Keep OBS websocket communication, credentials, and environment access in the Node/Hono backend.
- The SPA should talk to the backend through typed GET endpoints and websocket messages, not directly to OBS.
- Use HTTP GET endpoints only for read models needed to reconstruct the UI after reload.
- Send user commands, such as starting/stopping recordings and switching scenes, over the backend websocket gateway.
- Broadcast realtime backend-to-SPA updates as domain events over websockets.
- Treat HTTP reads and websocket commands/events as separate adapter contracts.
- Structure the backend with a lightweight ports-and-adapters style. Avoid full DDD ceremony, but keep domain behavior independent from Hono, websocket, filesystem, `obs-websocket-js`, and other infrastructure details.
- Gateways and adapters own the technology they wrap. For example, websocket gateways may import websocket server APIs, file adapters may import `node:fs`, and OBS adapters may import `obs-websocket-js`.

```ts
// domain model + port + use case should not import Hono, websocket, filesystem, or OBS SDK modules.
```

## Frontend Structure

- Use `src/routes/` for SPA pages.
- Use `src/lib/` for shared client-safe utilities, components, stores, and API clients.
- Keep UI state derived from backend responses and websocket messages.
- Do not add SvelteKit server routes for OBS control unless the architecture is explicitly changed.
- Fetch initial read models through backend GET endpoints, then keep them current by applying websocket domain event deltas.

## Backend Structure

- Keep the folder structure as flat as practical.
- Use adapter filenames in the `<technology>-<purpose>-<kind>.ts` format.
- Use input adapters for clients, such as `websocket-recording-gateway.ts`.
- Use output adapters for external systems, such as `obs-recording-adapter.ts` or `obs-scene-adapter.ts`.
- Put technology-specific imports in the adapter or gateway that owns that technology.
- Keep OBS connection management isolated from Hono handlers and websocket message parsing.
- Define clear message shapes for SPA-to-backend commands and backend-to-SPA events.
- Do not expose action-based HTTP endpoints such as `POST /recordings/start`, `POST /recordings/stop`, or `POST /scenes/switch`.
- Expose read-only HTTP endpoints such as `GET /recording`, `GET /recordings/latest`, and `GET /scenes` when the SPA needs a view after reload.
- Validate input at backend boundaries before sending commands to OBS.

Prefer a layout like this when the backend is added:

```text
backend/
  src/
    domain/
      recording.ts
      scene.ts
    application/
      obs-control-port.ts
      client-events-port.ts
      start-recording.ts
      switch-scene.ts
    infrastructure/
      obs-recording-adapter.ts
      obs-scene-adapter.ts
      websocket-recording-gateway.ts
      websocket-scene-gateway.ts
```

## Domain Models and Ports

- Create light domain models for concepts such as recording state, scene, OBS connection status, and command results.
- Model important state with discriminated unions so TypeScript drives valid behavior and exhaustive handling.
- Name each discriminated union variant as its own type, then compose the union from those variants.
- Put behavior next to the domain types as small pure `const` functions.
- Prefer explicit transitions over mutating loosely shaped objects.
- Keep domain models small and practical; introduce repositories when the feature needs persistence, such as saving and looking up recording file metadata.
- Define ports as capability-specific function types in the application layer.
- Implement ports in infrastructure adapters.
- Let use cases depend on ports, not concrete adapters.
- Implement use cases as exported `const` functions with dependencies passed in explicitly.
- Define repository persistence as focused function ports such as `SaveRecording` and `FindLatestRecording`.
- Avoid repository classes and avoid object-shaped repositories unless grouping functions materially improves readability.

```ts
export type StartObsRecording = () => Promise<RecordingCommandResult>;
export type StopObsRecording = () => Promise<RecordingCommandResult>;
export type SwitchObsScene = (sceneName: string) => Promise<SceneCommandResult>;
```

```ts
export type RecordingIdle = {
  status: 'idle';
};

export type RecordingActive = {
  status: 'recording';
  currentFilename: string;
};

export type RecordingStopping = {
  status: 'stopping';
  currentFilename: string;
};

export type RecordingError = {
  status: 'error';
  message: string;
};

export type Recording = RecordingIdle | RecordingActive | RecordingStopping | RecordingError;
```

```ts
export type StartRecordingCommand = {
  type: 'start-recording';
};

export type StopRecordingCommand = {
  type: 'stop-recording';
};

export type RecordingCommand = StartRecordingCommand | StopRecordingCommand;
```

```ts
export const canStopRecording = (recording: Recording) =>
  recording.status === 'recording' || recording.status === 'stopping';
```

```ts
export type RecordingStarted = {
  type: 'recording.started';
  aggregate: 'recording';
  aggregateId: string;
  occurredAt: Date;
  delta: {
    status: 'recording';
    currentFilename: string;
  };
};

export type RecordingEvent = RecordingStarted;
```

```ts
export type RecordingSession = {
  recording: Recording;
  events: RecordingEvent[];
};

export const createRecordingSession = (recording: Recording): RecordingSession => ({
  recording,
  events: [],
});

export const addRecordingEvent = (
  session: RecordingSession,
  event: RecordingEvent,
): RecordingSession => ({
  ...session,
  events: [...session.events, event],
});

export const flushRecordingEvents = (
  session: RecordingSession,
): [RecordingSession, RecordingEvent[]] => [
  {
    ...session,
    events: [],
  },
  session.events,
];
```

```ts
export type SaveRecording = (recording: RecordingFile) => Promise<void>;
export type FindLatestRecording = () => Promise<RecordingFile | null>;
export type BroadcastRecordingEvents = (events: RecordingEvent[]) => Promise<void>;
```

```ts
export type RecordingFile = {
  id: string;
  filename: string;
  createdAt: Date;
};
```

```ts
export type StartRecordingDeps = {
  startObsRecording: StartObsRecording;
  saveRecording: SaveRecording;
  broadcastRecordingEvents: BroadcastRecordingEvents;
  logger: AppLogger;
};

export const startRecording = async (deps: StartRecordingDeps) => {
  deps.logger.debug('Recording command validated, starting OBS recording.');
  const file = await deps.startObsRecording();

  const session = addRecordingEvent(
    createRecordingSession({
      status: 'recording',
      currentFilename: file.filename,
    }),
    {
      type: 'recording.started',
      aggregate: 'recording',
      aggregateId: file.id,
      occurredAt: new Date(),
      delta: {
        status: 'recording',
        currentFilename: file.filename,
      },
    },
  );

  await deps.saveRecording(file);
  const [flushedSession, events] = flushRecordingEvents(session);
  await deps.broadcastRecordingEvents(events);

  deps.logger.debug({ recordingId: file.id }, 'OBS recording started, saving metadata.');
  deps.logger.info('Start recording flow completed.');

  return flushedSession;
};
```

```ts
export type GetLatestRecordingDeps = {
  findLatestRecording: FindLatestRecording;
  logger: AppLogger;
};

export const getLatestRecording = async (deps: GetLatestRecordingDeps) => {
  const recording = await deps.findLatestRecording();

  if (!recording) {
    deps.logger.warn('No latest recording found.');
    return null;
  }

  deps.logger.info({ recordingId: recording.id }, 'Latest recording flow completed.');
  return recording;
};
```

## Dependency Injection

- Wire dependencies at the application edge, not inside domain or use case modules.
- Create a dedicated context file per module, such as `recording-context.ts`, for wiring that module's dependencies.
- In Hono, attach composed dependencies to the request context so handlers and websocket gateways can call use cases without importing concrete adapters directly.
- Keep dependency names capability-based, for example `startObsRecording`, `saveRecording`, and `findLatestRecording`.
- Tests can pass fake functions directly to use cases without a container or class hierarchy.

```ts
export type RecordingContext = {
  startObsRecording: StartObsRecording;
  saveRecording: SaveRecording;
  findLatestRecording: FindLatestRecording;
  broadcastRecordingEvents: BroadcastRecordingEvents;
};
```

```ts
export type AppBindings = {
  Variables: {
    logging: LoggingContext;
    recording: RecordingContext;
  };
};
```

```ts
export const createRecordingContext = (): RecordingContext => ({
  startObsRecording: obsStartRecordingAdapter,
  saveRecording: fileSaveRecordingAdapter,
  findLatestRecording: fileFindLatestRecordingAdapter,
  broadcastRecordingEvents: websocketRecordingEventBroadcaster,
});
```

```ts
app.use(async (c, next) => {
  c.set('recording', createRecordingContext());
  await next();
});
```

```ts
app.get('/recordings/latest', async (c) => {
  const recording = c.get('recording');
  const { logger } = c.get('logging');
  const result = await getLatestRecording({ ...recording, logger });

  return c.json(result);
});
```

Action commands belong in websocket gateways instead of HTTP routes:

```ts
// websocket-recording-gateway.ts
import { WebSocketServer } from 'ws';

const handleRecordingMessage = async (
  raw: string,
  deps: {
    startRecording: typeof startRecording;
    stopRecording: typeof stopRecording;
    logging: LoggingContext;
    recording: RecordingContext;
  },
) => {
  const command = recordingCommandMessageSchema.parse(JSON.parse(raw));

  if (command.type === 'start-recording') {
    await deps.startRecording({ ...deps.recording, logger: deps.logging.logger });
    return;
  }

  await deps.stopRecording({ ...deps.recording, logger: deps.logging.logger });
};

const handleRecordingConnection = (
  socket: WebSocket,
  deps: {
    startRecording: typeof startRecording;
    stopRecording: typeof stopRecording;
    logging: LoggingContext;
    recording: RecordingContext;
  },
) => {
  socket.on('message', async (raw) => {
    await handleRecordingMessage(String(raw), deps);
  });
};

export const createRecordingGateway = (deps: {
  server: WebSocketServer;
  startRecording: typeof startRecording;
  stopRecording: typeof stopRecording;
  logging: LoggingContext;
  recording: RecordingContext;
}) => {
  deps.server.on('connection', (socket) => {
    handleRecordingConnection(socket, deps);
  });
};
```

## Adapter Rules

- Hono composes the Node server and may expose health or setup endpoints, but feature adapters should still follow the adapter naming rule.
- HTTP feature routes expose read-only GET endpoints for reload/bootstrap views.
- Websocket gateways translate client command messages into use case calls and broadcast resulting domain events.
- The OBS adapter translates application port calls into OBS websocket commands.
- Adapters and gateways own their external libraries and platform APIs. They may directly import Hono, websocket libraries, `node:fs`, `node:path`, `obs-websocket-js`, and similar infrastructure dependencies when that technology is their responsibility.
- Domain and application code should not import infrastructure libraries; they should express needs as ports and plain TypeScript types.
- Do not use vague adapter names such as `hono-routes.ts` or `obs-adapter.ts`; name files by technology, purpose, and kind.
- Every domain event sent to clients must include the aggregate name, aggregate ID, occurrence timestamp, and a `delta` object containing only the aggregate fields that changed.

```ts
// obs-recording-adapter.ts
import OBSWebSocket from 'obs-websocket-js';

const startObsRecording = async (client: OBSWebSocket) => {
  const result = await client.call('StartRecord');
  return {
    id: result.recordingId,
    filename: result.fileName,
    createdAt: new Date(),
  };
};

export const createObsRecordingAdapter = (client: OBSWebSocket) => ({
  startObsRecording: () => startObsRecording(client),
});

// file-recording-adapter.ts
import { readFile, writeFile } from 'node:fs/promises';

const saveRecording = async (path: string, recording: RecordingFile) => {
  await writeFile(path, JSON.stringify(recording), 'utf8');
};

const findLatestRecording = async (path: string) => {
  const raw = await readFile(path, 'utf8');
  return JSON.parse(raw) as RecordingFile;
};

export const createFileRecordingAdapter = (path: string) => ({
  saveRecording: (recording: RecordingFile) => saveRecording(path, recording),
  findLatestRecording: () => findLatestRecording(path),
});
```

## UI Code

- Build minimal, accessible controls for the OBS workflow.
- Prefer semantic buttons, labels, status regions, and form controls.
- Show clear loading, success, and error states for recording and scene actions.
- Keep components small; extract shared logic only when duplication becomes meaningful.

## Testing

- Add or update the Playwright E2E suite that matches the active spec before implementation.
- Cover the happy path and edge/error cases described by the spec.
- Prefer user-facing assertions: roles, labels, visible status text, and navigation state.
- Add lower-level tests only after E2E flow coverage exists.

## Logging

- Use structured logging with Pino.
- Every request, websocket connection, and function flow should carry a tracing ID.
- Add Hono middleware that creates or reads the tracing ID, creates a child logger, and stores it on context.
- Pass the logger through module context/dependencies; do not import a global logger inside domain or use case modules.
- Use `debug` for each meaningful step with data, for example "Recording command validated, starting OBS recording".
- Use `warn` when expected data is missing or undefined, for example a repository lookup returning no recording.
- Use `error` when catching or mapping failures, including the error object and tracing ID.
- Use `info` when a function flow completes successfully.
- Never log OBS passwords, stream keys, tokens, or raw secrets.

```ts
import pino, { type Logger } from 'pino';

export const rootLogger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
});

export type AppLogger = Logger;
```

```ts
export type LoggingContext = {
  traceId: string;
  logger: AppLogger;
};
```

```ts
import { randomUUID } from 'node:crypto';

app.use(async (c, next) => {
  const traceId = c.req.header('x-trace-id') ?? randomUUID();
  const logger = rootLogger.child({ traceId });

  c.set('logging', { traceId, logger });
  c.header('x-trace-id', traceId);

  await next();
});
```

## Error Handling

- Treat OBS connection failures, unavailable scenes, failed recording commands, and empty states as expected cases.
- Validate HTTP query params, route params, and websocket messages with Zod at the adapter boundary.
- Do not define HTTP body schemas for OBS action commands; those commands should be websocket message schemas.
- Define domain/application errors as custom classes extending built-in `Error`.
- Every custom error must expose a stable `code` that is easy to map to a status code.
- Map `error.code -> statusCode` with a simple `Map`, not a growing switch statement.
- Map validation and domain errors to frontend-safe responses with a stable `code`, `message`, and optional `details`.
- Keep error mapping in dedicated functions, for example `recording-error-response.ts`.
- Return safe error messages to the UI; keep sensitive details server-side.
- Log errors with structured data and the active tracing ID, without exposing passwords or stream secrets.

```ts
import { z } from 'zod';

export const recordingCommandMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('start-recording'),
  }),
  z.object({
    type: z.literal('stop-recording'),
  }),
]);

export type RecordingCommandMessage = z.infer<typeof recordingCommandMessageSchema>;
```

```ts
export const scenesQuerySchema = z.object({
  includeHidden: z.coerce.boolean().optional(),
});

export type ScenesQuery = z.infer<typeof scenesQuerySchema>;
```

```ts
export class RecordingAlreadyActiveError extends Error {
  readonly code = 'recording.already_active';

  constructor(readonly currentFilename: string) {
    super('A recording is already active.');
  }
}
```

```ts
export class ObsUnavailableError extends Error {
  readonly code = 'obs.unavailable';

  constructor(message = 'OBS is unavailable.') {
    super(message);
  }
}
```

```ts
export type AppError = Error & {
  code?: string;
  details?: unknown;
};
```

```ts
export type ErrorResponse = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};
```

```ts
export const errorStatusByCode = new Map<string, number>([
  ['invalid-request', 400],
  ['recording.already_active', 409],
  ['obs.unavailable', 503],
  ['recording.file_save_failed', 500],
]);
```

```ts
export type ErrorResponseResult = {
  status: number;
  body: ErrorResponse;
};

export const mapErrorToResponse = (error: AppError): ErrorResponseResult => {
  const code = error.code ?? 'internal-error';

  return {
    status: errorStatusByCode.get(code) ?? 500,
    body: {
      error: {
        code,
        message: error.message || 'An unexpected error occurred.',
        details: error.details,
      },
    },
  };
};
```

```ts
export type ValidationErrorResponseResult = {
  status: 400;
  body: ErrorResponse;
};

export const mapZodErrorToResponse = (error: z.ZodError): ValidationErrorResponseResult => ({
  status: 400,
  body: {
    error: {
      code: 'invalid-request',
      message: 'The request is invalid.',
      details: error.flatten(),
    },
  },
});
```
