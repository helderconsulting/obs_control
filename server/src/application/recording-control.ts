import type {
  Recording,
  RecordingCommand,
} from '../../../shared/recording.js';
import {
  applyRecordingFailed,
  applyRecordingStarted,
  applyRecordingStopped,
  beginStartingRecording,
  beginStoppingRecording,
  canStartRecording,
  canStopRecording,
} from '../domain/recording.js';

export type FindRecording = () => Promise<Recording>;

export type SaveRecording = (recording: Recording) => Promise<void>;

export type RecordingRepository = {
  findRecording: FindRecording;
  saveRecording: SaveRecording;
};

export type ReadRecordingService = () => Promise<Recording>;

export type ReadRecordingServiceDeps = {
  recordingRepository: RecordingRepository;
};

export const createReadRecordingService = (
  deps: ReadRecordingServiceDeps,
): ReadRecordingService => {
  return async () => deps.recordingRepository.findRecording();
};

export type StartObsRecording = () => Promise<{ currentFilename: string | null }>;

export type StopObsRecording = () => Promise<void>;

export type IssueRecordingCommandResult = {
  recording: Recording;
  changed: boolean;
};

export type IssueRecordingCommandService = (
  command: RecordingCommand,
) => Promise<IssueRecordingCommandResult>;

export type IssueRecordingCommandServiceDeps = {
  recordingRepository: RecordingRepository;
  startObsRecording: StartObsRecording;
  stopObsRecording: StopObsRecording;
};

const issueStartCommand = async (
  deps: IssueRecordingCommandServiceDeps,
): Promise<IssueRecordingCommandResult> => {
  const currentRecording = await deps.recordingRepository.findRecording();

  if (!canStartRecording(currentRecording)) {
    const recording = applyRecordingFailed('Recording is already active.');
    await deps.recordingRepository.saveRecording(recording);
    return {
      recording,
      changed: false,
    };
  }

  const startingRecording = beginStartingRecording(currentRecording);
  await deps.recordingRepository.saveRecording(startingRecording);

  try {
    const { currentFilename } = await deps.startObsRecording();
    const recording = applyRecordingStarted(currentFilename);
    await deps.recordingRepository.saveRecording(recording);

    return {
      recording,
      changed: true,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to start recording.';
    const recording = applyRecordingFailed(message);
    await deps.recordingRepository.saveRecording(recording);

    return {
      recording,
      changed: false,
    };
  }
};

const issueStopCommand = async (
  deps: IssueRecordingCommandServiceDeps,
): Promise<IssueRecordingCommandResult> => {
  const currentRecording = await deps.recordingRepository.findRecording();

  if (!canStopRecording(currentRecording)) {
    const recording = applyRecordingFailed('Recording is not active.');
    await deps.recordingRepository.saveRecording(recording);
    return {
      recording,
      changed: false,
    };
  }

  const stoppingRecording = beginStoppingRecording(currentRecording);
  await deps.recordingRepository.saveRecording(stoppingRecording);

  try {
    await deps.stopObsRecording();
    const recording = applyRecordingStopped();
    await deps.recordingRepository.saveRecording(recording);

    return {
      recording,
      changed: true,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to stop recording.';
    const recording = applyRecordingFailed(message);
    await deps.recordingRepository.saveRecording(recording);

    return {
      recording,
      changed: false,
    };
  }
};

export const createIssueRecordingCommandService = (
  deps: IssueRecordingCommandServiceDeps,
): IssueRecordingCommandService => {
  return async (command) => {
    if (command.type === 'recording.start') {
      return issueStartCommand(deps);
    }

    return issueStopCommand(deps);
  };
};
