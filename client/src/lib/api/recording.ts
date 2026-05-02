import type { Recording } from '../../../../shared/recording.js';

export type RecordingApiError = {
  code: string;
  message: string;
  details?: unknown;
};

export type RecordingApiSuccess = {
  ok: true;
  recording: Recording;
};

export type RecordingApiFailure = {
  ok: false;
  error: RecordingApiError;
};

export type RecordingApiResult = RecordingApiSuccess | RecordingApiFailure;

type RecordingErrorResponse = {
  error?: Partial<RecordingApiError>;
};

const createFallbackError = (): RecordingApiError => {
  return {
    code: 'internal-error',
    message: 'Failed to fetch recording.',
  };
};

const mapErrorResponse = (payload: unknown): RecordingApiError => {
  if (typeof payload !== 'object' || payload === null) {
    return createFallbackError();
  }

  const errorResponse = payload as RecordingErrorResponse;
  const error = errorResponse.error;

  if (error === undefined) {
    return createFallbackError();
  }

  const code = typeof error.code === 'string' ? error.code : 'internal-error';
  const message = typeof error.message === 'string' ? error.message : 'Failed to fetch recording.';

  return {
    code,
    message,
    details: error.details,
  };
};

export const fetchRecording = async (): Promise<RecordingApiResult> => {
  const response = await fetch('/recording');

  if (response.ok) {
    const recording = (await response.json()) as Recording;

    return {
      ok: true,
      recording,
    };
  }

  const payload = (await response.json()) as unknown;
  const error = mapErrorResponse(payload);

  return {
    ok: false,
    error,
  };
};
