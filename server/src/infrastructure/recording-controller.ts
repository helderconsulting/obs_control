import { Hono } from 'hono';
import type { ReadRecordingService } from '../application/recording-control.js';
import { mapRecordingErrorToResponse } from './recording-error-response.js';

export type RecordingControllerEnv = {
  Bindings: Record<string, never>;
  Variables: Record<string, never>;
};

export type RecordingControllerDeps = {
  readRecording: ReadRecordingService;
};

export const createRecordingController = (
  deps: RecordingControllerDeps,
): Hono<RecordingControllerEnv> => {
  const app = new Hono<RecordingControllerEnv>();

  app.get('/recording', async (context) => {
    try {
      const recording = await deps.readRecording();
      return context.json(recording, 200);
    } catch (error: unknown) {
      const response = mapRecordingErrorToResponse(error);
      return context.json(response.body, { status: response.status });
    }
  });

  return app;
};
