// Tiny in-memory fixed-window limiter per IP (no dependencies). Behind a proxy/tunnel set TRUST_PROXY=1 so req.ip is the visitor.
export function rateLimit({ windowMs, max }) {
  const hits = new Map();
  setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (v.reset < now) hits.delete(k); }, windowMs).unref();
  return (req, res, next) => {
    const now = Date.now();
    let h = hits.get(req.ip);
    if (!h || h.reset < now) { h = { n: 0, reset: now + windowMs }; hits.set(req.ip, h); }
    if (++h.n > max) {
      res.setHeader('Retry-After', Math.ceil((h.reset - now) / 1000));
      return res.status(429).json({ status: 'error', code: 'rate_limit', message: 'Too many requests. Please wait a minute and try again.' });
    }
    next();
  };
}
