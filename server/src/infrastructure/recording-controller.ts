import { Hono } from 'hono';
import type { ReadRecordingService } from '../application/recording-control.js';
import { mapRecordingErrorToResponse } from './recording-error-response.js';
import type { AppLogger } from './recording-logger.js';
import type { GetObsConnectionStatus, GetObsScenes } from './obs-recording-adapter.js';

export type RecordingControllerEnv = {
  Bindings: Record<string, never>;
  Variables: {
    trace_id: string;
  };
};

export type RecordingControllerDeps = {
  readRecording: ReadRecordingService;
  getObsConnectionStatus: GetObsConnectionStatus;
  getObsScenes: GetObsScenes;
  logger: AppLogger;
};

export const createRecordingController = (
  deps: RecordingControllerDeps,
): Hono<RecordingControllerEnv> => {
  const app = new Hono<RecordingControllerEnv>();

  app.get('/recording', async (context) => {
    deps.logger.debug('Handling GET /recording request.');

    try {
      const recording = await deps.readRecording();
      deps.logger.info({ status: recording.status }, 'Handled GET /recording request.');

      return context.json(recording, 200);
    } catch (error: unknown) {
      const response = mapRecordingErrorToResponse(error);
      deps.logger.error(
        { error, status: response.status, code: response.body.error.code },
        'Failed to handle GET /recording request.',
      );

      return context.json(response.body, { status: response.status });
    }
  });

  app.get('/obs/scenes', async (context) => {
    deps.logger.debug('Handling GET /obs/scenes request.');

    try {
      const scenes = await deps.getObsScenes();
      deps.logger.info({ scenes }, 'Handled GET /obs/scenes request.');

      return context.json(scenes, 200);
    } catch (error: unknown) {
      const response = mapRecordingErrorToResponse(error);
      deps.logger.error(
        { error, status: response.status, code: response.body.error.code },
        'Failed to handle GET /obs/scenes request.',
      );

      return context.json(response.body, { status: response.status });
    }
  });

  app.get('/obs/connection', (context) => {
    const status = deps.getObsConnectionStatus();
    deps.logger.info({ status: status.status }, 'Handled GET /obs/connection request.');

    return context.json(status, 200);
  });

  return app;
};
