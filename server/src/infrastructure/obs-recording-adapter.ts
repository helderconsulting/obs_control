import OBSWebSocket from 'obs-websocket-js';

export type StartObsRecordingResult = {
  currentFilename: string | null;
};

export type StartRecording = () => Promise<StartObsRecordingResult>;
export type StopRecording = () => Promise<void>;

export type ObsRecordingAdapter = {
  startRecording: StartRecording;
  stopRecording: StopRecording;
};

export type ObsRecordingAdapterConfig = {
  url: string;
  password?: string;
};

export type ObsRecordingAdapterDeps = {
  config: ObsRecordingAdapterConfig;
};

export const createObsClient = async (
  config: ObsRecordingAdapterConfig,
): Promise<OBSWebSocket> => {
  const client = new OBSWebSocket();

  if (config.password === undefined) {
    await client.connect(config.url);
    return client;
  }

  await client.connect(config.url, config.password);
  return client;
};

export const readCurrentFilename = (response: unknown): string | null => {
  if (typeof response !== 'object' || response === null) {
    return null;
  }

  if (!('recordingFilename' in response)) {
    return null;
  }

  const filename = (response as { recordingFilename?: unknown }).recordingFilename;

  return typeof filename === 'string' ? filename : null;
};

export const createStartRecording = (deps: ObsRecordingAdapterDeps): StartRecording => {
  return async () => {
    const client = await createObsClient(deps.config);

    try {
      const response = await client.call('StartRecord');
      const currentFilename = readCurrentFilename(response);

      return {
        currentFilename,
      };
    } finally {
      client.disconnect();
    }
  };
};

export const createStopRecording = (deps: ObsRecordingAdapterDeps): StopRecording => {
  return async () => {
    const client = await createObsClient(deps.config);

    try {
      await client.call('StopRecord');
    } finally {
      client.disconnect();
    }
  };
};

export const createObsRecordingAdapter = (
  deps: ObsRecordingAdapterDeps,
): ObsRecordingAdapter => {
  const startRecording = createStartRecording(deps);
  const stopRecording = createStopRecording(deps);

  return {
    startRecording,
    stopRecording,
  };
};
