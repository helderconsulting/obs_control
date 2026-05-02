import { RecordingControlError } from '../application/recording-control-errors.js';

export type ErrorResponse = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export type ErrorResponseResult = {
  status: 404 | 500;
  body: ErrorResponse;
};

const errorStatusByCode = new Map<string, number>([
  ['recording.not_found', 404],
  ['recording.read_failed', 500],
  ['internal-error', 500],
]);

export const mapRecordingErrorToResponse = (error: unknown): ErrorResponseResult => {
  if (error instanceof RecordingControlError) {
    const status = errorStatusByCode.get(error.code) ?? 500;

    return {
      status: status as 404 | 500,
      body: {
        error: {
          code: error.code,
          message: error.message || 'An unexpected error occurred.',
          details: error.details,
        },
      },
    };
  }

  return {
    status: 500,
    body: {
      error: {
        code: 'internal-error',
        message: 'An unexpected error occurred.',
      },
    },
  };
};
