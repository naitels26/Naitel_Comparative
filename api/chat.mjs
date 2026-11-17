import { resolve } from 'node:path';
import { createChatRouter } from '../lib/chat.mjs';
const chat = createChatRouter({ versions: { a: resolve('_private/a'), b: resolve('_private/b') }, apiKey: process.env.GEMINI_API_KEY, model: process.env.GEMINI_MODEL });
export default async function handler(req, res) {
  try { await chat(req, res); }
  catch { if (!res.headersSent) { res.writeHead(502, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify({ error: 'gemini_unavailable' })); } else res.destroy(); }
}
