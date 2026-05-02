import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { WebSocketServer } from 'ws';
import {
  createIssueRecordingCommandService,
  createReadRecordingService,
} from './application/recording-control.js';
import { createObsRecordingAdapter } from './infrastructure/obs-recording-adapter.js';
import { createRecordingController } from './infrastructure/recording-controller.js';
import { rootLogger } from './infrastructure/recording-logger.js';
import { createSqliteRecordingRepository } from './infrastructure/sqlite-recording-repository.js';
import { createWebsocketRecordingGateway } from './infrastructure/websocket-recording-gateway.js';

export type ServerConfig = {
  port: number;
  obsUrl: string;
  obsPassword?: string;
};

export const createServerConfig = (): ServerConfig => {
  const portValue = process.env.PORT ?? '3000';
  const parsedPort = Number.parseInt(portValue, 10);
  const port = Number.isNaN(parsedPort) ? 3000 : parsedPort;
  const obsUrl = process.env.OBS_WEBSOCKET_URL ?? 'ws://127.0.0.1:4455';
  const obsPassword = process.env.OBS_WEBSOCKET_PASSWORD;
  const config: ServerConfig = {
    port,
    obsUrl,
  };

  if (obsPassword !== undefined) {
    config.obsPassword = obsPassword;
  }

  return config;
};

export const createServerApp = (config: ServerConfig): Hono => {
  const app = new Hono();
  const logger = rootLogger.child({ scope: 'server' });
  const repositoryLogger = logger.child({ component: 'sqlite-recording-repository' });
  const obsAdapterLogger = logger.child({ component: 'obs-recording-adapter' });
  const controllerLogger = logger.child({ component: 'recording-controller' });
  const gatewayLogger = logger.child({ component: 'websocket-recording-gateway' });
  const recordingRepository = createSqliteRecordingRepository({
    logger: repositoryLogger,
  });
  const obsRecordingAdapterConfig = { url: config.obsUrl };

  if (config.obsPassword !== undefined) {
    Object.assign(obsRecordingAdapterConfig, {
      password: config.obsPassword,
    });
  }

  const obsRecordingAdapter = createObsRecordingAdapter({
    config: obsRecordingAdapterConfig,
    logger: obsAdapterLogger,
  });
  const readRecording = createReadRecordingService({
    recordingRepository,
    logger,
  });
  const issueRecordingCommand = createIssueRecordingCommandService({
    recordingRepository,
    startObsRecording: obsRecordingAdapter.startRecording,
    stopObsRecording: obsRecordingAdapter.stopRecording,
    logger,
  });
  const recordingController = createRecordingController({
    readRecording,
    logger: controllerLogger,
  });
  const websocketRecordingGateway = createWebsocketRecordingGateway({
    issueRecordingCommand,
    logger: gatewayLogger,
  });

  logger.info('Composed server dependencies.');
  app.route('/', recordingController);
  app.route('/', websocketRecordingGateway.app);
  app.get('/health', (context) => {
    return context.json({ status: 'ok' }, 200);
  });

  return app;
};

export const startServer = (config: ServerConfig = createServerConfig()) => {
  const app = createServerApp(config);
  const websocketServer = new WebSocketServer({ noServer: true });
  const logger = rootLogger.child({ scope: 'server', port: config.port });

  logger.info(
    {
      obsUrl: config.obsUrl,
    },
    'Starting recording control server.',
  );

  return serve(
    {
      fetch: app.fetch,
      port: config.port,
      websocket: { server: websocketServer },
    },
    (info) => {
      logger.info({ port: info.port }, 'Recording control server is listening.');
    },
  );
};

const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  startServer();
}
