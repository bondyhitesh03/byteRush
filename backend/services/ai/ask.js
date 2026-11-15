import { callAI, parseJson, AIError } from './client.js';

// Calls the AI, parses JSON and validates it. Retries once if the AI's JSON is malformed.
export async function askAI(system, user, validate, images = []) {
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    try { return validate(parseJson(await callAI(system, user, 8192, images))); }
    catch (e) { if (e instanceof AIError) throw e; lastErr = e; }
  }
  console.error('Invalid AI response:', lastErr?.message);
  throw new AIError("The AI's answer came back in an unexpected format. Please try again.", 502, 'format');
}

export const failJson = (res, e) => res.status(e instanceof AIError ? e.status : 500)
  .json({ status: 'error', code: e instanceof AIError ? e.code : 'error', message: e.message });
