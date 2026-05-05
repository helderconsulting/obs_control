import type {
  Recording,
  RecordingCommand,
  RecordingEvent,
  RecordingFailedEvent,
  RecordingSceneSwitchedEvent,
  RecordingStartedEvent,
  RecordingStoppedEvent,
} from '../../../shared/recording.js';
import {
  applyRecordingFailed,
  applyRecordingSceneSwitch,
  applyRecordingStarted,
  applyRecordingStopped,
  beginStartingRecording,
  beginStoppingRecording,
  beginSwitchingScene,
  canStartRecording,
  canStopRecording,
  canSwitchScene,
  createIdleRecordingWithFilename,
  createRecording,
  type RecordingRepository,
} from '../domain/recording.js';
import {
  RecordingNotFoundError,
  RecordingReadError,
  RecordingUnknownCommandError,
} from './recording-control-errors.js';
import type { AppLogger } from '../infrastructure/recording-logger.js';

export type RemoteStopRecordingResult = {
  recordingFilename: string | null;
};

export type RemoteRecordingStatus = {
  outputActive: boolean;
};

export type StartRemoteRecording = () => Promise<void>;
export type StopRemoteRecording = () => Promise<RemoteStopRecordingResult>;
export type GetRemoteRecordingStatus = () => Promise<RemoteRecordingStatus>;
export type GetRemoteScenes = () => Promise<string[]>;
export type GetActiveRemoteScene = () => Promise<string>;
export type SwitchRemoteScene = (name: string) => Promise<void>;
export type CheckRemoteConnection = () => Promise<void>;

export type RemoteConnectionStatus =
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

export type GetRemoteConnectionStatus = () => RemoteConnectionStatus;

export type RemoteRecording = {
  getRecordingStatus: GetRemoteRecordingStatus;
  startRecording: StartRemoteRecording;
  stopRecording: StopRemoteRecording;
  getScenes: GetRemoteScenes;
  getActiveScene: GetActiveRemoteScene;
  switchScene: SwitchRemoteScene;
  getStatus: GetRemoteConnectionStatus;
  checkConnection: CheckRemoteConnection;
};

export type ReadRecordingServiceDeps = {
  recordingRepository: RecordingRepository;
  remoteRecording: RemoteRecording;
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
        const remoteRecordingStatus = await deps.remoteRecording.getRecordingStatus();
        const normalizedRecording = remoteRecordingStatus.outputActive
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
            'Normalized persisted recording state against remote system.',
          );
          await deps.recordingRepository.saveRecording(recording);
        }
      } catch (error: unknown) {
        deps.logger.warn(
          { error, persistedStatus: storedRecording.status },
          'Unable to reconcile persisted recording state against remote system. Returning stored state.',
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

export type IssueRecordingCommandResult = {
  recording: Recording;
  changed: boolean;
  rejectedMessage: string | null;
  event: RecordingEvent | null;
};

export type IssueRecordingCommandService = (
  command: RecordingCommand,
) => Promise<IssueRecordingCommandResult>;

export type IssueRecordingCommandServiceDeps = {
  recordingRepository: RecordingRepository;
  remoteRecording: RemoteRecording;
  logger: AppLogger;
};

const mapStartRecordingFailureMessage = (): string => {
  return 'Unable to start recording because remote system is unavailable.';
};

const mapStopRecordingFailureMessage = (): string => {
  return 'Unable to stop recording because remote system is unavailable.';
};

const createRecordingStartedEvent = (
  recording: Extract<Recording, { status: 'recording' }>,
): RecordingStartedEvent => ({
  type: 'recording.started',
  aggregate: 'recording',
  occurredAt: new Date().toISOString(),
  delta: {
    status: 'recording',
    sceneName: recording.sceneName,
    lastRecordingFilename: recording.lastRecordingFilename,
  },
});

const createRecordingStoppedEvent = (
  recording: Extract<Recording, { status: 'idle' }>,
): RecordingStoppedEvent => ({
  type: 'recording.stopped',
  aggregate: 'recording',
  occurredAt: new Date().toISOString(),
  delta: {
    status: 'idle',
    sceneName: recording.sceneName,
    lastRecordingFilename: recording.lastRecordingFilename,
  },
});

const createRecordingSceneSwitchedEvent = (
  recording: Extract<Recording, { status: 'idle' }>,
): RecordingSceneSwitchedEvent => ({
  type: 'recording.scene-switched',
  aggregate: 'recording',
  occurredAt: new Date().toISOString(),
  delta: {
    status: 'idle',
    sceneName: recording.sceneName,
    lastRecordingFilename: recording.lastRecordingFilename,
  },
});

const createRecordingFailedEvent = (
  recording: Extract<Recording, { status: 'error' }>,
): RecordingFailedEvent => ({
  type: 'recording.failed',
  aggregate: 'recording',
  occurredAt: new Date().toISOString(),
  delta: {
    status: 'error',
    message: recording.message,
    sceneName: recording.sceneName,
    lastRecordingFilename: recording.lastRecordingFilename,
  },
});

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
      event: null,
    };
  }

  const activeScene = await deps.remoteRecording.getActiveScene();
  currentRecording.sceneName = activeScene;
  const startingRecording = beginStartingRecording(currentRecording);
  deps.logger.debug('Persisting starting recording state.');
  await deps.recordingRepository.saveRecording(startingRecording);

  try {
    deps.logger.debug('Sending start recording command to remote system.');
    await deps.remoteRecording.startRecording();
    const recording = applyRecordingStarted(startingRecording) as Extract<Recording, { status: 'recording' }>;

    deps.logger.info('Remote recording started.');
    await deps.recordingRepository.saveRecording(recording);

    return {
      recording,
      changed: true,
      rejectedMessage: null,
      event: createRecordingStartedEvent(recording),
    };
  } catch (error: unknown) {
    const message = mapStartRecordingFailureMessage();
    const recording = applyRecordingFailed(message, startingRecording) as Extract<Recording, { status: 'error' }>;

    deps.logger.error({ error }, 'Remote start recording command failed.');
    await deps.recordingRepository.saveRecording(recording);

    return {
      recording,
      changed: false,
      rejectedMessage: null,
      event: createRecordingFailedEvent(recording),
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
      event: null,
    };
  }

  const stoppingRecording = beginStoppingRecording(currentRecording);
  deps.logger.debug('Persisting stopping recording state.');
  await deps.recordingRepository.saveRecording(stoppingRecording);

  try {
    deps.logger.debug('Sending stop recording command to remote system.');
    const { recordingFilename } = await deps.remoteRecording.stopRecording();
    const recording = applyRecordingStopped(stoppingRecording.sceneName, recordingFilename) as Extract<Recording, { status: 'idle' }>;

    deps.logger.info('Remote recording stopped.');
    await deps.recordingRepository.saveRecording(recording);

    return {
      recording,
      changed: true,
      rejectedMessage: null,
      event: createRecordingStoppedEvent(recording),
    };
  } catch (error: unknown) {
    const message = mapStopRecordingFailureMessage();
    const recording = applyRecordingFailed(message, stoppingRecording) as Extract<Recording, { status: 'error' }>;

    deps.logger.error({ error }, 'Remote stop recording command failed.');
    await deps.recordingRepository.saveRecording(recording);

    return {
      recording,
      changed: false,
      rejectedMessage: null,
      event: createRecordingFailedEvent(recording),
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
      event: null,
    };
  }

  const switchingRecording = beginSwitchingScene(currentRecording, sceneName);
  deps.logger.debug('Persisting switching scene state.');
  await deps.recordingRepository.saveRecording(switchingRecording);

  try {
    deps.logger.debug('Sending switching scene command to remote system.');
    await deps.remoteRecording.switchScene(sceneName);
    const recording = applyRecordingSceneSwitch(sceneName, currentRecording.lastRecordingFilename) as Extract<Recording, { status: 'idle' }>;

    deps.logger.info('Remote scene switched.');
    await deps.recordingRepository.saveRecording(recording);

    return {
      recording,
      changed: true,
      rejectedMessage: null,
      event: createRecordingSceneSwitchedEvent(recording),
    };
  } catch (error: unknown) {
    const message = mapStopRecordingFailureMessage();
    const recording = applyRecordingFailed(message, currentRecording) as Extract<Recording, { status: 'error' }>;

    deps.logger.error({ error }, 'Remote switching scene command failed.');
    await deps.recordingRepository.saveRecording(recording);

    return {
      recording,
      changed: false,
      rejectedMessage: null,
      event: createRecordingFailedEvent(recording),
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
