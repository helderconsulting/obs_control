import OBSWebSocket, { type OBSRequestTypes, type OBSResponseTypes } from 'obs-websocket-js';
import type { AppLogger } from './recording-logger.js';
import type { JSONObject } from 'hono/utils/types';

export type StopObsRecordingResult = {
  recordingFilename: string | null;
};
export type ObsRecordingStatus = {
  outputActive: boolean;
};

export type StartRecording = () => Promise<void>;
export type StopRecording = () => Promise<StopObsRecordingResult>;
export type CheckObsConnection = () => Promise<void>;
export type GetObsConnectionStatus = () => ObsConnectionStatus;
export type GetObsRecordingStatus = () => Promise<ObsRecordingStatus>;
export type GetObsScenes = () => Promise<string[]>;
export type GetActiveObsScene = () => Promise<string>;
export type SwitchObsScene = (name: string) => Promise<void>;

export type ObsConnectionStatus =
  | {
      status: 'connected';
      url: string;
      checkedAt: string;
      message: string;
    }
  | {
      status: 'disconnected';
      url: string;
      checkedAt: string | null;
      message: string;
    };

export type ObsRecordingAdapter = {
  checkConnection: CheckObsConnection;
  getStatus: GetObsConnectionStatus;
  getRecordingStatus: GetObsRecordingStatus;
  startRecording: StartRecording;
  stopRecording: StopRecording;
  getScenes: GetObsScenes;
  getActiveScene: GetActiveObsScene;
  switchScene: SwitchObsScene;
};

export type ObsRecordingAdapterConfig = {
  url: string;
  password?: string;
  connectTimeoutMs?: number;
  commandTimeoutMs?: number;
  reconnectIntervalMs?: number;
};

export type ObsRecordingAdapterDeps = {
  config: ObsRecordingAdapterConfig;
  logger: AppLogger;
};

type ManagedObsConnection = {
  connect: () => Promise<void>;
  getStatus: () => ObsConnectionStatus;
  getRecordingStatus: () => Promise<ObsRecordingStatus>;
  call: <RequestType extends keyof OBSRequestTypes>(
    requestType: RequestType,
    requestData?: OBSRequestTypes[RequestType],
  ) => Promise<OBSResponseTypes[RequestType]>;
};

class ObsTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ObsTimeoutError';
  }
}

const defaultConnectTimeoutMs = 5_000;
const defaultCommandTimeoutMs = 10_000;

const withTimeout = async <Result>(
  operation: Promise<Result>,
  timeoutMs: number,
  message: string,
): Promise<Result> => {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      reject(new ObsTimeoutError(message));
    }, timeoutMs);
  });

  try {
    return await Promise.race([operation, timeoutPromise]);
  } finally {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }
  }
};

export const readRecordingFilename = (response: unknown): string | null => {
  if (typeof response !== 'object' || response === null) {
    return null;
  }

  if (!('outputPath' in response)) {
    return null;
  }

  const filename = (response as { outputPath?: unknown }).outputPath;

  return typeof filename === 'string' && filename.length > 0 ? filename : null;
};

export const readSceneNames = (response: { scenes: JSONObject[] }) => {
  return response.scenes.map((s) => s.sceneName as string);
};

const createManagedObsConnection = (deps: ObsRecordingAdapterDeps): ManagedObsConnection => {
  const connectTimeoutMs = deps.config.connectTimeoutMs ?? defaultConnectTimeoutMs;
  const commandTimeoutMs = deps.config.commandTimeoutMs ?? defaultCommandTimeoutMs;
  const reconnectIntervalMs = deps.config.reconnectIntervalMs ?? 5_000;
  let client: OBSWebSocket | null = null;
  let connectPromise: Promise<OBSWebSocket> | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let status: ObsConnectionStatus = {
    status: 'disconnected',
    url: deps.config.url,
    checkedAt: null,
    message: 'OBS connection has not been checked yet.',
  };

  const markConnected = (message: string): void => {
    status = {
      status: 'connected',
      url: deps.config.url,
      checkedAt: new Date().toISOString(),
      message,
    };
  };

  const markDisconnected = (message: string): void => {
    status = {
      status: 'disconnected',
      url: deps.config.url,
      checkedAt: new Date().toISOString(),
      message,
    };
  };

  const clearReconnectTimer = (): void => {
    if (reconnectTimer === null) {
      return;
    }

    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  };

  const scheduleReconnect = (): void => {
    if (reconnectTimer !== null || connectPromise !== null || client?.identified === true) {
      return;
    }

    deps.logger.warn(
      { url: deps.config.url, reconnectIntervalMs },
      'Scheduling OBS websocket reconnect attempt.',
    );

    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;

      void connect().catch((error: unknown) => {
        deps.logger.error({ error }, 'OBS websocket reconnect attempt failed.');
        scheduleReconnect();
      });
    }, reconnectIntervalMs);

    reconnectTimer.unref?.();
  };

  const clearClient = (obsClient: OBSWebSocket): void => {
    if (client === obsClient) {
      client = null;
    }
  };

  const disconnectClient = async (obsClient: OBSWebSocket): Promise<void> => {
    try {
      await obsClient.disconnect();
    } catch (error: unknown) {
      deps.logger.warn({ error }, 'Failed to disconnect OBS websocket client cleanly.');
    }
  };

  const attachConnectionHandlers = (obsClient: OBSWebSocket): void => {
    obsClient.on('ConnectionClosed', (error) => {
      clearClient(obsClient);
      markDisconnected(
        error instanceof Error && error.message.length > 0
          ? error.message
          : 'OBS websocket connection closed.',
      );
      deps.logger.warn({ error }, 'OBS websocket connection closed.');
      scheduleReconnect();
    });

    obsClient.on('ConnectionError', (error) => {
      clearClient(obsClient);
      markDisconnected(
        error instanceof Error && error.message.length > 0
          ? error.message
          : 'OBS websocket connection failed.',
      );
      deps.logger.warn({ error }, 'OBS websocket connection failed.');
      scheduleReconnect();
    });
  };

  const connect = async (): Promise<OBSWebSocket> => {
    if (client?.identified === true) {
      return client;
    }

    if (connectPromise !== null) {
      return connectPromise;
    }

    const nextClient = new OBSWebSocket();
    attachConnectionHandlers(nextClient);

    deps.logger.info(
      {
        url: deps.config.url,
        hasPassword: deps.config.password !== undefined,
        connectTimeoutMs,
      },
      'Connecting to OBS websocket.',
    );
    const connection =
      deps.config.password === undefined
        ? nextClient.connect(deps.config.url)
        : nextClient.connect(deps.config.url, deps.config.password);

    connectPromise = withTimeout(
      connection,
      connectTimeoutMs,
      'Timed out while connecting to OBS websocket.',
    )
      .then(() => {
        clearReconnectTimer();
        client = nextClient;
        markConnected('Connected to OBS websocket.');
        deps.logger.info({ url: deps.config.url }, 'Connected to OBS websocket.');
        return nextClient;
      })
      .catch(async (error: unknown) => {
        clearClient(nextClient);
        markDisconnected(error instanceof Error ? error.message : 'Failed to connect to OBS.');
        deps.logger.error({ error }, 'Failed to connect to OBS websocket.');
        await disconnectClient(nextClient);
        scheduleReconnect();
        throw error;
      })
      .finally(() => {
        connectPromise = null;
      });

    return connectPromise;
  };

  const resetClient = async (obsClient: OBSWebSocket): Promise<void> => {
    clearClient(obsClient);
    await disconnectClient(obsClient);
  };

  const call = async <RequestType extends keyof OBSRequestTypes>(
    requestType: RequestType,
    requestData?: OBSRequestTypes[RequestType],
  ): Promise<OBSResponseTypes[RequestType]> => {
    const obsClient = await connect();

    try {
      deps.logger.info({ requestType }, 'Sending OBS websocket command.');

      const response = await withTimeout(
        obsClient.call(requestType, requestData),
        commandTimeoutMs,
        `Timed out while sending ${String(requestType)} to OBS.`,
      );

      markConnected(`OBS command ${String(requestType)} completed.`);
      return response;
    } catch (error: unknown) {
      if (error instanceof ObsTimeoutError) {
        markDisconnected(error.message);
        await resetClient(obsClient);
        scheduleReconnect();
      }

      deps.logger.warn({ error, requestType }, 'OBS websocket command failed.');
      throw error;
    }
  };

  return {
    connect: async () => {
      await connect();
    },
    getStatus: () => status,
    getRecordingStatus: async () => {
      const response = await call('GetRecordStatus');

      return {
        outputActive: response.outputActive,
      };
    },
    call,
  };
};

export const createCheckConnection = (
  connection: ManagedObsConnection,
  logger: AppLogger,
): CheckObsConnection => {
  return async () => {
    logger.info('Checking OBS websocket connection.');
    await connection.connect();
    logger.info('OBS websocket connection check completed.');
  };
};

export const createGetStatus = (connection: ManagedObsConnection): GetObsConnectionStatus => {
  return () => connection.getStatus();
};

export const createGetRecordingStatus = (
  connection: ManagedObsConnection,
  logger: AppLogger,
): GetObsRecordingStatus => {
  return async () => {
    logger.info('Fetching OBS recording status.');
    return connection.getRecordingStatus();
  };
};

export const createStartRecording = (
  connection: ManagedObsConnection,
  logger: AppLogger,
): StartRecording => {
  return async () => {
    logger.info('Sending OBS start recording command.');
    await connection.call('StartRecord');
    logger.info('OBS start recording command completed.');
  };
};

export const createStopRecording = (
  connection: ManagedObsConnection,
  logger: AppLogger,
): StopRecording => {
  return async () => {
    logger.info('Sending OBS stop recording command.');
    const response = await connection.call('StopRecord');
    const recordingFilename = readRecordingFilename(response);
    logger.info({ recordingFilename }, 'OBS stop recording command completed.');

    return { recordingFilename };
  };
};

export const createGetActiveScene = (
  connection: ManagedObsConnection,
  logger: AppLogger,
): GetActiveObsScene => {
  return async () => {
    logger.info('Fetching the active scene');
    const response = await connection.call('GetCurrentProgramScene');
    logger.info({ sceneName: response.sceneName }, 'Active scene fetched');
    return response.sceneName;
  };
};

export const createGetScenes = (
  connection: ManagedObsConnection,
  logger: AppLogger,
): GetObsScenes => {
  return async () => {
    logger.info('Fetching OBS scenes');
    const response = await connection.call('GetSceneList');
    const scenes = readSceneNames(response);
    logger.info({ scenes }, 'OBS scenes fetched.');
    return scenes;
  };
};

export const createSwitchScene = (
  connection: ManagedObsConnection,
  logger: AppLogger,
): SwitchObsScene => {
  return async (name: string) => {
    logger.info({ name }, 'Switching OBS scene');
    if (!name) {
      logger.warn('OBS scene switched with empty name');
      return;
    }
    await connection.call('SetCurrentProgramScene', {
      sceneName: name,
    });
    logger.info('OBS scene switched.');
  };
};

export const createObsRecordingAdapter = (deps: ObsRecordingAdapterDeps): ObsRecordingAdapter => {
  const connection = createManagedObsConnection(deps);
  const checkConnection = createCheckConnection(connection, deps.logger);
  const getStatus = createGetStatus(connection);
  const getRecordingStatus = createGetRecordingStatus(connection, deps.logger);
  const startRecording = createStartRecording(connection, deps.logger);
  const stopRecording = createStopRecording(connection, deps.logger);
  const getScenes = createGetScenes(connection, deps.logger);
  const switchScene = createSwitchScene(connection, deps.logger);
  const getActiveScene = createGetActiveScene(connection, deps.logger);

  return {
    checkConnection,
    getStatus,
    getRecordingStatus,
    startRecording,
    stopRecording,
    getScenes,
    getActiveScene,
    switchScene,
  };
};
