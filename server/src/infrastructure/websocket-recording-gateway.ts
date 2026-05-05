import { upgradeWebSocket } from '@hono/node-server';
import { Hono } from 'hono';
import type { WSContext } from 'hono/ws';
import { z } from 'zod';
import type {
  Recording,
  RecordingCommand,
  RecordingEvent,
  RecordingFailedEvent,
  RecordingSceneSwitchedEvent,
  RecordingStartedEvent,
  RecordingStoppedEvent,
} from '../../../shared/recording.js';
import type { IssueRecordingCommandService } from '../application/recording-control.js';
import { mapRecordingErrorToResponse } from './recording-error-response.js';
import type { AppLogger } from './recording-logger.js';

const recordingCommandMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('recording.start'),
  }),
  z.object({
    type: z.literal('recording.stop'),
  }),
  z.object({
    type: z.literal('recording.switch-scene'),
    sceneName: z.string(),
  }),
]);

type RecordingGatewayCommandMessage = z.infer<typeof recordingCommandMessageSchema>;

type RecordingGatewayErrorMessage = {
  type: 'recording.error';
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

const createInvalidRequestMessage = (details: unknown): RecordingGatewayErrorMessage => {
  return {
    type: 'recording.error',
    error: {
      code: 'invalid-request',
      message: 'The request is invalid.',
      details,
    },
  };
};

export type RecordingWebSocketGatewayEnv = {
  Bindings: Record<string, never>;
  Variables: {
    trace_id: string;
  };
};

export type RecordingWebSocketGatewayDeps = {
  issueRecordingCommand: IssueRecordingCommandService;
  logger: AppLogger;
};

export type RecordingWebSocketGateway = {
  app: Hono<RecordingWebSocketGatewayEnv>;
  broadcastRecordingEvent: (event: RecordingEvent) => void;
};

const parseGatewayMessage = (
  data: string | ArrayBuffer | Uint8Array,
): RecordingGatewayCommandMessage => {
  const text = typeof data === 'string' ? data : new TextDecoder().decode(data);
  const payload = JSON.parse(text) as unknown;

  return recordingCommandMessageSchema.parse(payload);
};

const createRecordingStartedEvent = (
  recording: Extract<Recording, { status: 'recording' }>,
): RecordingStartedEvent => {
  const occurredAt = new Date().toISOString();

  return {
    type: 'recording.started',
    aggregate: 'recording',
    occurredAt,
    delta: {
      status: 'recording',
      sceneName: recording.sceneName,
      lastRecordingFilename: recording.lastRecordingFilename,
    },
  };
};

const createRecordingStoppedEvent = (
  recording: Extract<Recording, { status: 'idle' }>,
): RecordingStoppedEvent => {
  const occurredAt = new Date().toISOString();

  return {
    type: 'recording.stopped',
    aggregate: 'recording',
    occurredAt,
    delta: {
      status: 'idle',
      sceneName: recording.sceneName,
      lastRecordingFilename: recording.lastRecordingFilename,
    },
  };
};

const createRecordingSceneSwitchedEvent = (
  recording: Extract<Recording, { status: 'switching-scene' }>,
): RecordingSceneSwitchedEvent => {
  const occurredAt = new Date().toISOString();

  return {
    type: 'recording.scene-switched',
    aggregate: 'recording',
    occurredAt,
    delta: {
      status: 'switching-scene',
      sceneName: recording.sceneName,
    },
  };
};

const createRecordingFailedEvent = (
  recording: Extract<Recording, { status: 'error' }>,
): RecordingFailedEvent => {
  const occurredAt = new Date().toISOString();
  const message = recording.message;

  return {
    type: 'recording.failed',
    aggregate: 'recording',
    occurredAt,
    delta: {
      status: 'error',
      message,
      sceneName: recording.sceneName,
      lastRecordingFilename: recording.lastRecordingFilename,
    },
  };
};

const createRecordingEvent = (recording: Recording): RecordingEvent | null => {
  if (recording.status === 'recording') {
    return createRecordingStartedEvent(recording);
  }

  if (recording.status === 'switching-scene') {
    return createRecordingSceneSwitchedEvent(recording);
  }

  if (recording.status === 'error') {
    return createRecordingFailedEvent(recording);
  }

  if (recording.status === 'idle') {
    return createRecordingStoppedEvent(recording);
  }

  return null;
};

const createGatewayErrorMessage = (error: unknown): RecordingGatewayErrorMessage => {
  const response = mapRecordingErrorToResponse(error);
  const errorBody = response.body.error;

  return {
    type: 'recording.error',
    error: {
      code: errorBody.code,
      message: errorBody.message,
      details: errorBody.details,
    },
  };
};

const createCommandRejectedMessage = (message: string): RecordingGatewayErrorMessage => {
  return {
    type: 'recording.error',
    error: {
      code: 'recording.command_rejected',
      message,
    },
  };
};

const sendJsonMessage = (
  socket: WSContext,
  payload: RecordingEvent | RecordingGatewayErrorMessage,
): void => {
  const message = JSON.stringify(payload);
  socket.send(message);
};

const broadcastJsonMessage = (
  sockets: Set<WSContext>,
  payload: RecordingEvent | RecordingGatewayErrorMessage,
): void => {
  const message = JSON.stringify(payload);

  for (const socket of sockets) {
    socket.send(message);
  }
};

const handleRecordingCommand = async (
  deps: RecordingWebSocketGatewayDeps,
  sockets: Set<WSContext>,
  socket: WSContext,
  command: RecordingCommand,
): Promise<void> => {
  deps.logger.info({ commandType: command.type }, 'Received recording websocket command.');

  try {
    const result = await deps.issueRecordingCommand(command);

    deps.logger.info(
      { commandType: command.type, changed: result.changed, status: result.recording.status },
      'Processed recording websocket command.',
    );

    if (result.rejectedMessage !== null) {
      sendJsonMessage(socket, createCommandRejectedMessage(result.rejectedMessage));
      return;
    }

    const event = createRecordingEvent(result.recording);

    if (event === null) {
      deps.logger.debug(
        { status: result.recording.status },
        'Skipping websocket broadcast for transitional recording state.',
      );
      return;
    }

    broadcastJsonMessage(sockets, event);
  } catch (error: unknown) {
    deps.logger.error({ error, commandType: command.type }, 'Recording websocket command failed.');

    const errorMessage = createGatewayErrorMessage(error);
    sendJsonMessage(socket, errorMessage);
  }
};

const handleMessage = async (
  deps: RecordingWebSocketGatewayDeps,
  sockets: Set<WSContext>,
  socket: WSContext,
  data: string | ArrayBuffer | Uint8Array,
): Promise<void> => {
  try {
    const command = parseGatewayMessage(data);
    await handleRecordingCommand(deps, sockets, socket, command);
  } catch (error: unknown) {
    deps.logger.warn({ error }, 'Rejected invalid recording websocket message.');

    const errorMessage =
      error instanceof z.ZodError
        ? createInvalidRequestMessage(error.flatten())
        : createGatewayErrorMessage(error);

    sendJsonMessage(socket, errorMessage);
  }
};

export const createWebsocketRecordingGateway = (
  deps: RecordingWebSocketGatewayDeps,
): RecordingWebSocketGateway => {
  const app = new Hono<RecordingWebSocketGatewayEnv>();
  const sockets = new Set<WSContext>();

  const broadcastRecordingEvent = (event: RecordingEvent): void => {
    deps.logger.debug({ eventType: event.type }, 'Broadcasting recording websocket event.');
    broadcastJsonMessage(sockets, event);
  };

  app.get(
    '/ws/recording',
    upgradeWebSocket(() => ({
      onOpen(_event, socket) {
        sockets.add(socket);
        deps.logger.info({ clients: sockets.size }, 'Recording websocket client connected.');
      },
      onMessage(event, socket) {
        const data = event.data;

        if (typeof data === 'string' || data instanceof ArrayBuffer || data instanceof Uint8Array) {
          void handleMessage(deps, sockets, socket, data);
          return;
        }

        deps.logger.warn('Rejected websocket message with unsupported payload type.');

        const errorMessage = createGatewayErrorMessage(new Error('Unsupported websocket payload.'));
        sendJsonMessage(socket, errorMessage);
      },
      onClose(_event, socket) {
        sockets.delete(socket);
        deps.logger.info({ clients: sockets.size }, 'Recording websocket client disconnected.');
      },
      onError() {
        deps.logger.error('Recording websocket client error.');
      },
    })),
  );

  return {
    app,
    broadcastRecordingEvent,
  };
};
