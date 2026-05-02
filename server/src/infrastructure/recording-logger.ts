import pino, { type Logger } from 'pino';

export const rootLogger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
});

export type AppLogger = Logger;
