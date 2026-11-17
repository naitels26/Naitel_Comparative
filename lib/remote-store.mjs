import { randomUUID } from 'node:crypto';

async function defaultClientFactory(uri, options) {
  const { MongoClient } = await import('mongodb');
  return new MongoClient(uri, options);
}

export function remoteStore({ uri = process.env.MONGODB_URI, database = process.env.MONGODB_DB || 'naitels_comparador', clientFactory = defaultClientFactory } = {}) {
  if (typeof uri !== 'string' || !/^mongodb(?:\+srv)?:\/\//.test(uri)) throw new Error('Configura MONGODB_URI con la cadena de conexión de MongoDB.');
  if (!/^[a-zA-Z0-9_-]{1,63}$/.test(database)) throw new Error('MONGODB_DB debe contener letras, números, guiones o guiones bajos (hasta 63 caracteres).');
  let connection;
  // Reuse the connection pool across invocations in a warm function.
  const client = () => connection ||= (async () => {
    const instance = await clientFactory(uri, {
      maxPoolSize: 5, minPoolSize: 0, maxIdleTimeMS: 60000,
      serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000,
      socketTimeoutMS: 10000, retryWrites: true, w: 'majority'
    });
    try { await instance.connect(); return instance; }
    catch (error) { await instance.close().catch(() => {}); throw error; }
  })().catch(error => { connection = null; throw error; });
  const collection = async () => (await client()).db(database).collection('respuestas');
  return {
    async save(body) {
      const responses = await collection();
      const id = randomUUID();
      const document = {
        // MongoDB's built-in unique _id index protects retries across instances.
        _id: body.solicitud, id, solicitud: body.solicitud, fecha: new Date().toISOString(),
        preferencia: body.preferencia, motivo: body.motivo, mejoras: body.mejoras,
        dispositivo: body.dispositivo
      };
      try {
        const result = await responses.insertOne(document);
        if (!result.acknowledged) throw new Error('No se pudo confirmar el guardado en MongoDB.');
        return { id, repeated: false };
      } catch (error) {
        if (error.code !== 11000) throw error;
        const prior = await responses.findOne({ _id: body.solicitud });
        if (!prior) throw new Error('No se pudo confirmar el guardado en MongoDB.');
        if (['preferencia', 'motivo', 'mejoras', 'dispositivo'].some(key => prior[key] !== body[key])) return { conflict: true };
        return { id: prior.id, repeated: true };
      }
    },
    async rows() {
      return (await collection()).find({}, { projection: { _id: 0, id: 1, fecha: 1, preferencia: 1, motivo: 1, mejoras: 1, dispositivo: 1 } }).sort({ fecha: 1, id: 1 }).toArray();
    },
    async close() {
      const pending = connection; connection = null;
      if (pending) await (await pending).close();
    }
  };
}
