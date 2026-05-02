import type {
  RecordingCommand,
  RecordingEvent,
  RecordingFailedEvent,
  RecordingStartedEvent,
  RecordingStoppedEvent,
} from '../../../../shared/recording.js';

export type RecordingGatewayError = {
  code: string;
  message: string;
  details?: unknown;
};

export type RecordingGatewayErrorMessage = {
  type: 'recording.error';
  error: RecordingGatewayError;
};

export type RecordingGatewayMessage =
  | RecordingStartedEvent
  | RecordingStoppedEvent
  | RecordingFailedEvent
  | RecordingGatewayErrorMessage;

export type RecordingWebSocketHandlers = {
  onEvent: (event: RecordingEvent) => void;
  onError: (error: RecordingGatewayError) => void;
  onOpen: () => void;
  onClose: () => void;
};

export type RecordingWebSocketConnection = {
  disconnect: () => void;
  sendCommand: (command: RecordingCommand) => void;
};

const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const isRecordingGatewayErrorMessage = (
  message: unknown,
): message is RecordingGatewayErrorMessage => {
  if (!isObject(message)) {
    return false;
  }

  if (message.type !== 'recording.error') {
    return false;
  }

  return isObject(message.error);
};

const isRecordingStartedEvent = (message: unknown): message is RecordingStartedEvent => {
  return isObject(message) && message.type === 'recording.started';
};

const isRecordingStoppedEvent = (message: unknown): message is RecordingStoppedEvent => {
  return isObject(message) && message.type === 'recording.stopped';
};

const isRecordingFailedEvent = (message: unknown): message is RecordingFailedEvent => {
  return isObject(message) && message.type === 'recording.failed';
};

const parseRecordingGatewayMessage = (data: string): RecordingGatewayMessage | null => {
  const payload = JSON.parse(data) as unknown;

  if (isRecordingGatewayErrorMessage(payload)) {
    return payload;
  }

  if (isRecordingStartedEvent(payload)) {
    return payload;
  }

  if (isRecordingStoppedEvent(payload)) {
    return payload;
  }

  if (isRecordingFailedEvent(payload)) {
    return payload;
  }

  return null;
};

const createWebSocketUrl = (): string => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;

  return `${protocol}//${host}/ws/recording`;
};

export const connectRecordingWebSocket = (
  handlers: RecordingWebSocketHandlers,
): RecordingWebSocketConnection => {
  const socket = new WebSocket(createWebSocketUrl());
  const pendingCommands: RecordingCommand[] = [];

  const flushPendingCommands = (): void => {
    while (pendingCommands.length > 0) {
      const command = pendingCommands.shift();

      if (command === undefined) {
        return;
      }

      const payload = JSON.stringify(command);
      socket.send(payload);
    }
  };

  socket.addEventListener('open', () => {
    handlers.onOpen();
    flushPendingCommands();
  });

  socket.addEventListener('message', (event) => {
    if (typeof event.data !== 'string') {
      return;
    }

    const message = parseRecordingGatewayMessage(event.data);

    if (message === null) {
      return;
    }

    if (message.type === 'recording.error') {
      handlers.onError(message.error);
      return;
    }

    handlers.onEvent(message);
  });

  socket.addEventListener('error', () => {
    handlers.onError({
      code: 'websocket.error',
      message: 'WebSocket connection failed.',
    });
  });

  socket.addEventListener('close', () => {
    handlers.onClose();
  });

  const disconnect = (): void => {
    socket.close();
  };

  const sendCommand = (command: RecordingCommand): void => {
    if (socket.readyState === WebSocket.CONNECTING) {
      pendingCommands.push(command);
      return;
    }

    if (socket.readyState !== WebSocket.OPEN) {
      handlers.onError({
        code: 'websocket.closed',
        message: 'WebSocket connection is not available.',
      });
      return;
    }

    const payload = JSON.stringify(command);
    socket.send(payload);
  };

  return {
    disconnect,
    sendCommand,
  };
};
