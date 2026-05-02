import type { Recording, RecordingCommand } from '../../../shared/recording.js';
import {
  applyRecordingFailed,
  applyRecordingSceneSwitch,
  applyRecordingStarted,
  applyRecordingStopped,
  beginStartingRecording,
  beginStoppingRecording,
  canStartRecording,
  canStopRecording,
  canSwitchScene,
  createIdleRecordingWithFilename,
  createRecording,
} from '../domain/recording.js';
import {
  RecordingNotFoundError,
  RecordingReadError,
  RecordingUnknownCommandError,
} from './recording-control-errors.js';
import type { AppLogger } from '../infrastructure/recording-logger.js';
import type { GetActiveObsScene, SwitchObsScene } from '../infrastructure/obs-recording-adapter.js';

export type FindRecording = () => Promise<Recording | undefined>;

export type SaveRecording = (recording: Recording) => Promise<void>;

export type RecordingRepository = {
  findRecording: FindRecording;
  saveRecording: SaveRecording;
};

export type ReadRecordingServiceDeps = {
  recordingRepository: RecordingRepository;
  getObsRecordingStatus: () => Promise<{ outputActive: boolean }>;
  logger: AppLogger;
};

export type ReadRecordingService = () => Promise<Recording>;

export const createReadRecordingService = (
  deps: ReadRecordingServiceDeps,
): ReadRecordingService => {
  return async () => {
    try {
      const storedRecording = await deps.recordingRepository.findRecording();

      if (storedRecording === undefined) {
        deps.logger.warn('Recording read model was missing.');
        throw new RecordingNotFoundError();
      }

      let recording = storedRecording;

      try {
        const obsRecordingStatus = await deps.getObsRecordingStatus();
        const normalizedRecording = obsRecordingStatus.outputActive
          ? createRecording(storedRecording.sceneName, storedRecording.lastRecordingFilename)
          : createIdleRecordingWithFilename(
              storedRecording.sceneName,
              storedRecording.lastRecordingFilename,
            );

        recording =
          storedRecording.status === normalizedRecording.status
            ? storedRecording
            : normalizedRecording;

        if (recording !== storedRecording) {
          deps.logger.info(
            {
              persistedStatus: storedRecording.status,
              normalizedStatus: recording.status,
            },
            'Normalized persisted recording state against OBS.',
          );
          await deps.recordingRepository.saveRecording(recording);
        }
      } catch (error: unknown) {
        deps.logger.warn(
          { error, persistedStatus: storedRecording.status },
          'Unable to reconcile persisted recording state against OBS. Returning stored state.',
        );
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

export type StartObsRecording = () => Promise<void>;

export type StopObsRecording = () => Promise<{ recordingFilename: string | null }>;

export type IssueRecordingCommandResult = {
  recording: Recording;
  changed: boolean;
  rejectedMessage: string | null;
};

export type IssueRecordingCommandService = (
  command: RecordingCommand,
) => Promise<IssueRecordingCommandResult>;

export type IssueRecordingCommandServiceDeps = {
  recordingRepository: RecordingRepository;
  startObsRecording: StartObsRecording;
  stopObsRecording: StopObsRecording;
  switchObsScene: SwitchObsScene;
  getActiveObsScene: GetActiveObsScene;
  logger: AppLogger;
};

const mapStartRecordingFailureMessage = (): string => {
  return 'Unable to start recording because OBS is unavailable.';
};

const mapStopRecordingFailureMessage = (): string => {
  return 'Unable to stop recording because OBS is unavailable.';
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

    return {
      recording: currentRecording,
      changed: false,
      rejectedMessage: 'Recording is already active.',
    };
  }

  const activeScene = await deps.getActiveObsScene();
  currentRecording.sceneName = activeScene;
  const startingRecording = beginStartingRecording(currentRecording);
  deps.logger.debug('Persisting starting recording state.');
  await deps.recordingRepository.saveRecording(startingRecording);

  try {
    deps.logger.debug('Sending start recording command to OBS.');
    await deps.startObsRecording();
    const recording = applyRecordingStarted(startingRecording);

    deps.logger.info('OBS recording started.');
    await deps.recordingRepository.saveRecording(recording);

    return {
      recording,
      changed: true,
      rejectedMessage: null,
    };
  } catch (error: unknown) {
    const message = mapStartRecordingFailureMessage();
    const recording = applyRecordingFailed(message, startingRecording);

    deps.logger.error({ error }, 'OBS start recording command failed.');
    await deps.recordingRepository.saveRecording(recording);

    return {
      recording,
      changed: false,
      rejectedMessage: null,
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

    return {
      recording: currentRecording,
      changed: false,
      rejectedMessage: 'Recording is not active.',
    };
  }

  const stoppingRecording = beginStoppingRecording(currentRecording);
  deps.logger.debug('Persisting stopping recording state.');
  await deps.recordingRepository.saveRecording(stoppingRecording);

  try {
    deps.logger.debug('Sending stop recording command to OBS.');
    const { recordingFilename } = await deps.stopObsRecording();
    const recording = applyRecordingStopped(stoppingRecording.sceneName, recordingFilename);

    deps.logger.info('OBS recording stopped.');
    await deps.recordingRepository.saveRecording(recording);

    return {
      recording,
      changed: true,
      rejectedMessage: null,
    };
  } catch (error: unknown) {
    const message = mapStopRecordingFailureMessage();
    const recording = applyRecordingFailed(message, stoppingRecording);

    deps.logger.error({ error }, 'OBS stop recording command failed.');
    await deps.recordingRepository.saveRecording(recording);

    return {
      recording,
      changed: false,
      rejectedMessage: null,
    };
  }
};

const issueSwitchSceneCommand = async (
  deps: IssueRecordingCommandServiceDeps,
  sceneName: string,
): Promise<IssueRecordingCommandResult> => {
  deps.logger.debug('Loading recording state before switching scene command.');
  const currentRecording = await deps.recordingRepository.findRecording();
  if (currentRecording === undefined) {
    deps.logger.warn('Switching scene command failed because recording state was missing.');
    throw new RecordingNotFoundError();
  }

  if (!canSwitchScene(currentRecording)) {
    deps.logger.warn('switch scene command rejected because recording is not idle.');

    return {
      recording: currentRecording,
      changed: false,
      rejectedMessage: 'Recording is not idle.',
    };
  }

  try {
    deps.logger.debug('Sending switching scene command to OBS.');
    await deps.switchObsScene(sceneName);
    const recording = applyRecordingSceneSwitch(sceneName, currentRecording.lastRecordingFilename);

    deps.logger.info('OBS scene switched.');
    await deps.recordingRepository.saveRecording(recording);

    return {
      recording,
      changed: true,
      rejectedMessage: null,
    };
  } catch (error: unknown) {
    const message = mapStopRecordingFailureMessage();
    const recording = applyRecordingFailed(message, currentRecording);

    deps.logger.error({ error }, 'OBS switching scene command failed.');
    await deps.recordingRepository.saveRecording(recording);

    return {
      recording,
      changed: false,
      rejectedMessage: null,
    };
  }
};

export const createIssueRecordingCommandService = (
  deps: IssueRecordingCommandServiceDeps,
): IssueRecordingCommandService => {
  return async (command) => {
    switch (command.type) {
      case 'recording.start': {
        return issueStartCommand(deps);
      }
      case 'recording.stop': {
        return issueStopCommand(deps);
      }
      case 'recording.switch-scene': {
        return issueSwitchSceneCommand(deps, command.sceneName);
      }
      default: {
        throw new RecordingUnknownCommandError();
      }
    }
  };
};
