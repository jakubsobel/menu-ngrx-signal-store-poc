import type { Response } from 'express';

/**
 * Shape of the object passed as the second argument to
 * `AngularNodeAppEngine.handle(req, ctx)` from server.ts. Picked up inside
 * the Angular tree via `inject(REQUEST_CONTEXT)` from `@angular/core`.
 *
 * Always optional: the local dev server bypasses server.ts, so the token
 * is never provided there. Consumers must inject with `{ optional: true }`
 * and check for null.
 */
export interface SsrRequestContext {
  readonly response?: Response;
}
