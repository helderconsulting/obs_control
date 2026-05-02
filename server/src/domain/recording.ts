import type {
  Recording,
  RecordingActive,
  RecordingError,
  RecordingIdle,
  RecordingStarting,
  RecordingStopping,
} from '../../../shared/recording.js';

export const createIdleRecording = (): RecordingIdle => ({
  status: 'idle',
  lastRecordingFilename: null,
});

export const createIdleRecordingWithFilename = (
  lastRecordingFilename: string | null,
): RecordingIdle => ({
  status: 'idle',
  lastRecordingFilename,
});

export const createStartingRecording = (
  lastRecordingFilename: string | null,
): RecordingStarting => ({
  status: 'starting',
  lastRecordingFilename,
});

export const createRecording = (lastRecordingFilename: string | null): RecordingActive => ({
  status: 'recording',
  lastRecordingFilename,
});

export const createStoppingRecording = (
  lastRecordingFilename: string | null,
): RecordingStopping => ({
  status: 'stopping',
  lastRecordingFilename,
});

export const createRecordingError = (
  message: string,
  lastRecordingFilename: string | null,
): RecordingError => ({
  status: 'error',
  message,
  lastRecordingFilename,
});

export const canStartRecording = (recording: Recording): boolean =>
  recording.status === 'idle' || recording.status === 'error';

export const canStopRecording = (recording: Recording): boolean => recording.status === 'recording';

export const beginStartingRecording = (recording: Recording): Recording => {
  if (!canStartRecording(recording)) {
    return recording;
  }

  return createStartingRecording(recording.lastRecordingFilename);
};

export const beginStoppingRecording = (recording: Recording): Recording => {
  if (!canStopRecording(recording)) {
    return recording;
  }

  return createStoppingRecording(recording.lastRecordingFilename);
};

export const applyRecordingStarted = (recording: Recording): Recording =>
  createRecording(recording.lastRecordingFilename);

export const applyRecordingStopped = (lastRecordingFilename: string | null): Recording =>
  createIdleRecordingWithFilename(lastRecordingFilename);

export const applyRecordingFailed = (message: string, recording: Recording): Recording =>
  createRecordingError(message, recording.lastRecordingFilename);
