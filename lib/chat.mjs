import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Readable } from 'node:stream';

// Reuse each reference server's Gemini prompt, catalog and response contract.
// No file in the reference directories is modified and no listener is opened.
export function createChatRouter({ versions, apiKey, model, fetcher = fetch }) {
  const handlers = new Map();
  return async (req, res) => {
    const fail = (code, error) => {
      res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ error }));
    };
    if (req.method !== 'POST') return fail(405, 'method');
    if (!apiKey) return fail(503, 'gemini_not_configured');
    let referer;
    try { referer = new URL(req.headers.referer); } catch { return fail(400, 'version_required'); }
    const version = /^\/sitios\/([ab])\//.exec(referer.pathname)?.[1];
    if (!version || referer.host !== req.headers.host) return fail(403, 'origin');
    if (!handlers.has(version)) {
      handlers.set(version, import(pathToFileURL(resolve(versions[version], 'server.mjs')).href).then(module => {
        const server = module.createLandingServer({ apiKey, ...(model ? { model } : {}), fetcher, sendContact: null });
        return server.listeners('request')[0];
      }));
    }
    let input = req;
    // Vercel may already have parsed the body before invoking a Node handler.
    if (req.body !== undefined) {
      const body = typeof req.body === 'string' || Buffer.isBuffer(req.body) ? req.body : JSON.stringify(req.body);
      input = Readable.from([Buffer.from(body)]);
      Object.assign(input, { url: '/api/chat', method: req.method, headers: req.headers, socket: req.socket });
    }
    await (await handlers.get(version))(input, res);
  };
}
