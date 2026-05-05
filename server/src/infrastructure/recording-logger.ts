import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import type { MiddlewareHandler } from 'hono';
import pino, { type Logger } from 'pino';

export const traceStorage = new AsyncLocalStorage<string>();

export const rootLogger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true },
  },
  mixin() {
    const traceId = traceStorage.getStore();
    return traceId ? { trace_id: traceId } : {};
  },
});

export const traceMiddleware = (): MiddlewareHandler => {
  return async (c, next) => {
    const traceId = c.req.header('x-trace-id') ?? randomUUID();
    c.set('trace_id', traceId);
    return traceStorage.run(traceId, async () => {
      await next();
    });
  };
};

export type AppLogger = Logger;
