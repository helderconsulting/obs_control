export type RecordingIdle = {
  status: 'idle';
};

export type RecordingStarting = {
  status: 'starting';
};

export type RecordingActive = {
  status: 'recording';
  currentFilename: string | null;
};

export type RecordingStopping = {
  status: 'stopping';
};

export type RecordingError = {
  status: 'error';
  message: string;
};

export type Recording =
  | RecordingIdle
  | RecordingStarting
  | RecordingActive
  | RecordingStopping
  | RecordingError;

export type StartRecordingCommand = {
  type: 'recording.start';
};

export type StopRecordingCommand = {
  type: 'recording.stop';
};

export type RecordingCommand = StartRecordingCommand | StopRecordingCommand;

export type RecordingStartedEvent = {
  type: 'recording.started';
  aggregate: 'recording';
  occurredAt: string;
  delta: {
    status: 'recording';
    currentFilename: string | null;
  };
};

export type RecordingStoppedEvent = {
  type: 'recording.stopped';
  aggregate: 'recording';
  occurredAt: string;
  delta: {
    status: 'idle';
  };
};

export type RecordingFailedEvent = {
  type: 'recording.failed';
  aggregate: 'recording';
  occurredAt: string;
  delta: {
    status: 'error';
    message: string;
  };
};

export type RecordingEvent =
  | RecordingStartedEvent
  | RecordingStoppedEvent
  | RecordingFailedEvent;
