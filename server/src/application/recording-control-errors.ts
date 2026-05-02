export abstract class RecordingControlError extends Error {
  abstract readonly code: string;
  readonly details?: unknown;

  protected constructor(message: string, details?: unknown) {
    super(message);
    this.name = new.target.name;
    this.details = details;
  }
}

export class RecordingReadError extends RecordingControlError {
  readonly code = 'recording.read_failed' as const;

  constructor(message = 'Failed to fetch recording.', details?: unknown) {
    super(message, details);
  }
}

export class RecordingNotFoundError extends RecordingControlError {
  readonly code = 'recording.not_found' as const;

  constructor(message = 'Recording not found.', details?: unknown) {
    super(message, details);
  }
}

export class RecordingUnknownCommandError extends RecordingControlError {
  readonly code = 'recording.unknown_command' as const;

  constructor(message = 'Command unknown.', details?: unknown) {
    super(message, details);
  }
}
