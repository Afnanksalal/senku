import { AsyncLocalStorage } from 'node:async_hooks';
/** Correlation metadata only; durable state always belongs in PostgreSQL. */
export const requestContext = new AsyncLocalStorage<{ requestId: string }>();
