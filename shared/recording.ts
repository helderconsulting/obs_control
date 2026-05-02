export type RecordingIdle = {
  status: 'idle';
  lastRecordingFilename: string | null;
};

export type RecordingStarting = {
  status: 'starting';
  lastRecordingFilename: string | null;
};

export type RecordingActive = {
  status: 'recording';
  lastRecordingFilename: string | null;
};

export type RecordingStopping = {
  status: 'stopping';
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

export type RecordingEvent = RecordingStartedEvent | RecordingStoppedEvent | RecordingFailedEvent;
