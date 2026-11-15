import { Router as ExpressRouter } from 'express';

// Express 4 doesn't catch errors from async handlers. This wrapper forwards them to the error handler instead of crashing.
const wrap = (fn) => (req, res, next) => {
  try { const r = fn(req, res, next); if (r && typeof r.catch === 'function') r.catch(next); } catch (e) { next(e); }
};
export function Router() {
  const router = ExpressRouter();
  for (const m of ['get', 'post', 'put', 'patch', 'delete']) {
    const orig = router[m].bind(router);
    router[m] = (p, ...handlers) => orig(p, ...handlers.map((h) => (typeof h === 'function' ? wrap(h) : h)));
  }
  return router;
}
