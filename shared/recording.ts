export type RecordingIdle = {
  status: 'idle';
  sceneName: string;
  lastRecordingFilename: string | null;
};

export type RecordingStarting = {
  status: 'starting';
  sceneName: string;
  lastRecordingFilename: string | null;
};

export type RecordingActive = {
  status: 'recording';
  sceneName: string;
  lastRecordingFilename: string | null;
};

export type RecordingStopping = {
  status: 'stopping';
  sceneName: string;
  lastRecordingFilename: string | null;
};

export type RecordingSceneSwitching = {
  status: 'switching-scene';
  sceneName: string;
  lastRecordingFilename: string | null;
};

export type RecordingError = {
  status: 'error';
  message: string;
  lastRecordingFilename: string | null;
};

export type Recording =
  | RecordingIdle
  | RecordingStarting
  | RecordingActive
  | RecordingStopping
  | RecordingSceneSwitching
  | RecordingError;

export type StartRecordingCommand = {
  type: 'recording.start';
};

export type StopRecordingCommand = {
  type: 'recording.stop';
};

export type SwitchSceneCommand = {
  type: 'recording.switch-scene';
  sceneName: string;
};

export type RecordingCommand = StartRecordingCommand | StopRecordingCommand | SwitchSceneCommand;

export type RecordingStartedEvent = {
  type: 'recording.started';
  aggregate: 'recording';
  occurredAt: string;
  delta: {
    status: 'recording';
    lastRecordingFilename: string | null;
  };
};

export type RecordingStoppedEvent = {
  type: 'recording.stopped';
  aggregate: 'recording';
  occurredAt: string;
  delta: {
    status: 'idle';
    lastRecordingFilename: string | null;
  };
};

export type RecordingSceneSwitchedEvent = {
  type: 'recording.scene-switched';
  aggregate: 'recording';
  occuredAt: string;
  delta: {
    status: 'switching-scene';
    sceneName: string;
  };
};

export type RecordingFailedEvent = {
  type: 'recording.failed';
  aggregate: 'recording';
  occurredAt: string;
  delta: {
    status: 'error';
    message: string;
    lastRecordingFilename: string | null;
  };
};

export type RecordingEvent =
  | RecordingStartedEvent
  | RecordingStoppedEvent
  | RecordingFailedEvent
  | RecordingSceneSwitchedEvent;
