// PUBLIC_MODE=true: safe for strangers. Visitors bring their own AI key (kept in their browser),
// history is separated per browser, server-side settings can't be changed, and requests are rate limited.
export const isPublicMode = () => process.env.PUBLIC_MODE === 'true';
