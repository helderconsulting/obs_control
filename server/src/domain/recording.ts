import type {
  Recording,
  RecordingActive,
  RecordingError,
  RecordingIdle,
  RecordingStarting,
  RecordingStopping,
  RecordingSceneSwitching,
} from '../../../shared/recording.js';

export const createIdleRecording = (sceneName: string): RecordingIdle => ({
  status: 'idle',
  sceneName,
  lastRecordingFilename: null,
});

export const createIdleRecordingWithFilename = (
  sceneName: string,
  lastRecordingFilename: string | null,
): RecordingIdle => ({
  status: 'idle',
  sceneName,
  lastRecordingFilename,
});

export const createStartingRecording = (
  sceneName: string,
  lastRecordingFilename: string | null,
): RecordingStarting => ({
  status: 'starting',
  sceneName,
  lastRecordingFilename,
});

export const createRecording = (
  sceneName: string,
  lastRecordingFilename: string | null,
): RecordingActive => ({
  status: 'recording',
  sceneName,
  lastRecordingFilename,
});

export const createStoppingRecording = (
  sceneName: string,
  lastRecordingFilename: string | null,
): RecordingStopping => ({
  status: 'stopping',
  sceneName,
  lastRecordingFilename,
});

export const createSwitchingSceneRecording = (
  sceneName: string,
  lastRecordingFilename: string | null,
): RecordingSceneSwitching => ({
  status: 'switching-scene',
  sceneName,
  lastRecordingFilename,
});

export const createRecordingError = (
  message: string,
  sceneName: string,
  lastRecordingFilename: string | null,
): RecordingError => ({
  status: 'error',
  message,
  sceneName,
  lastRecordingFilename,
});

export const canStartRecording = (recording: Recording): boolean =>
  recording.status === 'idle' || recording.status === 'error';

export const canStopRecording = (recording: Recording): boolean => recording.status === 'recording';

export const canSwitchScene = (recording: Recording): boolean => recording.status === 'idle';

export const beginStartingRecording = (recording: Recording): Recording => {
  if (!canStartRecording(recording)) {
    return recording;
  }

  return createStartingRecording(recording.sceneName, recording.lastRecordingFilename);
};

export const beginStoppingRecording = (recording: Recording): Recording => {
  if (!canStopRecording(recording)) {
    return recording;
  }

  return createStoppingRecording(recording.sceneName, recording.lastRecordingFilename);
};

export const applyRecordingStarted = (recording: Recording): Recording =>
  createRecording(recording.sceneName, recording.lastRecordingFilename);

export const applyRecordingStopped = (
  sceneName: string,
  lastRecordingFilename: string | null,
): Recording => createIdleRecordingWithFilename(sceneName, lastRecordingFilename);

export const applyRecordingSceneSwitch = (
  sceneName: string,
  lastRecordingFilename: string | null,
): Recording => createSwitchingSceneRecording(sceneName, lastRecordingFilename);

export const applyRecordingFailed = (message: string, recording: Recording): Recording =>
  createRecordingError(message, recording.sceneName, recording.lastRecordingFilename);

export type FindRecording = () => Promise<Recording | undefined>;

export type SaveRecording = (recording: Recording) => Promise<void>;

export type RecordingRepository = {
  findRecording: FindRecording;
  saveRecording: SaveRecording;
};
