import { remoteStore, databaseFailure } from '../lib/remote-store.mjs';
import { validate } from '../lib/survey-data.mjs';

let store;
export default async function handler(req, res) {
  const json = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); };
  try {
    if (req.method !== 'POST') return json(405, { error: 'Método no permitido.' });
    if ((req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) || req.headers['sec-fetch-site'] === 'cross-site') return json(403, { error: 'Origen no permitido.' });
    if (req.headers['content-type']?.split(';')[0].trim() !== 'application/json') return json(415, { error: 'Se requiere JSON.' });
    let raw = req.body;
    if (raw === undefined) {
      const chunks = []; let size = 0;
      for await (const chunk of req.iterator({ destroyOnReturn: false })) {
        size += chunk.length;
        if (size > 40000) { req.resume(); return json(413, { error: 'Respuesta demasiado larga.' }); }
        chunks.push(chunk);
      }
      raw = Buffer.concat(chunks).toString('utf8');
    }
    if (Buffer.byteLength(typeof raw === 'string' ? raw : JSON.stringify(raw)) > 40000) return json(413, { error: 'Respuesta demasiado larga.' });
    let body;
    try { body = validate(typeof raw === 'string' ? JSON.parse(raw) : raw); } catch {}
    if (!body) return json(400, { error: 'Revisa los campos obligatorios.' });
    if (!process.env.MONGODB_URI) return json(503, { error: 'La base de respuestas todavía no está configurada.' });
    store ||= remoteStore();
    const saved = await store.save(body);
    if (saved.conflict) return json(409, { error: 'Este envío ya se guardó con otros datos. Recarga para iniciar otra respuesta.' });
    json(saved.repeated ? 200 : 201, { guardada: true, id: saved.id });
  } catch (error) {
    const code = databaseFailure(error);
    console.error(`[EncuestaMongoDB] ${code}`);
    if (!res.headersSent) json(503, { error: `No pudimos confirmar el guardado. Reintenta el envío. Código: ${code}`, codigo: code });
    else res.destroy();
  }
}
