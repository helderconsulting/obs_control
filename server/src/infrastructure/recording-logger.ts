import pino, { type Logger } from 'pino';

export const rootLogger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true },
  },
});

export type AppLogger = Logger;
