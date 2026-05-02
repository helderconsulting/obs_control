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
});

export const createStartingRecording = (): RecordingStarting => ({
  status: 'starting',
});

export const createRecording = (currentFilename: string | null): RecordingActive => ({
  status: 'recording',
  currentFilename,
});

export const createStoppingRecording = (): RecordingStopping => ({
  status: 'stopping',
});

export const createRecordingError = (message: string): RecordingError => ({
  status: 'error',
  message,
});

export const canStartRecording = (recording: Recording): boolean =>
  recording.status === 'idle' || recording.status === 'error';

export const canStopRecording = (recording: Recording): boolean =>
  recording.status === 'recording';

export const beginStartingRecording = (recording: Recording): Recording => {
  if (!canStartRecording(recording)) {
    return recording;
  }

  return createStartingRecording();
};

export const beginStoppingRecording = (recording: Recording): Recording => {
  if (!canStopRecording(recording)) {
    return recording;
  }

  return createStoppingRecording();
};

export const applyRecordingStarted = (currentFilename: string | null): Recording =>
  createRecording(currentFilename);

export const applyRecordingStopped = (): Recording => createIdleRecording();

export const applyRecordingFailed = (message: string): Recording => createRecordingError(message);
