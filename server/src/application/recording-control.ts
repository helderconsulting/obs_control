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
import {
  RecordingNotFoundError,
  RecordingReadError,
} from './recording-control-errors.js';
import type { AppLogger } from '../infrastructure/recording-logger.js';

export type FindRecording = () => Promise<Recording | undefined>;

export type SaveRecording = (recording: Recording) => Promise<void>;

export type RecordingRepository = {
  findRecording: FindRecording;
  saveRecording: SaveRecording;
};

export type ReadRecordingServiceDeps = {
  recordingRepository: RecordingRepository;
  logger: AppLogger;
};

export type ReadRecordingService = () => Promise<Recording>;

export const createReadRecordingService = (
  deps: ReadRecordingServiceDeps,
): ReadRecordingService => {
  return async () => {
    try {
      const recording = await deps.recordingRepository.findRecording();

      if (recording === undefined) {
        deps.logger.warn('Recording read model was missing.');
        throw new RecordingNotFoundError();
      }

      deps.logger.debug('Recording read model loaded.');
      return recording;
    } catch (error: unknown) {
      if (error instanceof RecordingNotFoundError) {
        throw error;
      }

      deps.logger.error({ error }, 'Failed to fetch recording.');
      throw new RecordingReadError(
        error instanceof Error ? error.message : 'Failed to fetch recording.',
        { cause: error },
      );
    }
  };
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
  logger: AppLogger;
};

const issueStartCommand = async (
  deps: IssueRecordingCommandServiceDeps,
): Promise<IssueRecordingCommandResult> => {
  deps.logger.debug('Loading recording state before start command.');
  const currentRecording = await deps.recordingRepository.findRecording();

  if (currentRecording === undefined) {
    deps.logger.warn('Start command failed because recording state was missing.');
    throw new RecordingNotFoundError();
  }

  if (!canStartRecording(currentRecording)) {
    deps.logger.warn('Start command rejected because recording is already active.');
    const recording = applyRecordingFailed('Recording is already active.');
    await deps.recordingRepository.saveRecording(recording);

    return {
      recording,
      changed: false,
    };
  }

  const startingRecording = beginStartingRecording(currentRecording);
  deps.logger.debug('Persisting starting recording state.');
  await deps.recordingRepository.saveRecording(startingRecording);

  try {
    deps.logger.debug('Sending start recording command to OBS.');
    const { currentFilename } = await deps.startObsRecording();
    const recording = applyRecordingStarted(currentFilename);

    deps.logger.info({ currentFilename }, 'OBS recording started.');
    await deps.recordingRepository.saveRecording(recording);

    return {
      recording,
      changed: true,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to start recording.';
    const recording = applyRecordingFailed(message);

    deps.logger.error({ error }, 'OBS start recording command failed.');
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
  deps.logger.debug('Loading recording state before stop command.');
  const currentRecording = await deps.recordingRepository.findRecording();

  if (currentRecording === undefined) {
    deps.logger.warn('Stop command failed because recording state was missing.');
    throw new RecordingNotFoundError();
  }

  if (!canStopRecording(currentRecording)) {
    deps.logger.warn('Stop command rejected because recording is not active.');
    const recording = applyRecordingFailed('Recording is not active.');
    await deps.recordingRepository.saveRecording(recording);

    return {
      recording,
      changed: false,
    };
  }

  const stoppingRecording = beginStoppingRecording(currentRecording);
  deps.logger.debug('Persisting stopping recording state.');
  await deps.recordingRepository.saveRecording(stoppingRecording);

  try {
    deps.logger.debug('Sending stop recording command to OBS.');
    await deps.stopObsRecording();
    const recording = applyRecordingStopped();

    deps.logger.info('OBS recording stopped.');
    await deps.recordingRepository.saveRecording(recording);

    return {
      recording,
      changed: true,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to stop recording.';
    const recording = applyRecordingFailed(message);

    deps.logger.error({ error }, 'OBS stop recording command failed.');
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
