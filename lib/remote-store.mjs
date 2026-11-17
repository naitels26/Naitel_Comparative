import { randomUUID } from 'node:crypto';

async function defaultClientFactory(uri, options) {
  const { MongoClient } = await import('mongodb');
  return new MongoClient(uri, options);
}

// Return only fixed diagnostic labels. Never log raw MongoDB errors: they can
// contain hostnames, credentials or submitted content.
export function databaseFailure(error) {
  if (error?.code === 18) return 'MDB_AUTH';
  if (error?.code === 13) return 'MDB_PERMISSIONS';
  if (['MONGODB_URI_INVALID', 'MONGODB_DB_INVALID'].includes(error?.code) || ['MongoParseError', 'MongoInvalidArgumentError'].includes(error?.name)) return 'MDB_CONFIG';
  if (['MongoServerSelectionError', 'MongoNetworkError', 'MongoNetworkTimeoutError', 'MongoOperationTimeoutError'].includes(error?.name) || ['ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'ETIMEDOUT'].includes(error?.code)) return 'MDB_CONNECTION';
  if (error?.code === 'ERR_MODULE_NOT_FOUND') return 'MDB_DRIVER';
  if (error?.code === 'MONGODB_UNCONFIRMED') return 'MDB_WRITE';
  return 'MDB_UNKNOWN';
}

export function remoteStore({ uri = process.env.MONGODB_URI, database = process.env.MONGODB_DB || 'naitels_comparador', clientFactory = defaultClientFactory } = {}) {
  if (typeof uri !== 'string' || !/^mongodb(?:\+srv)?:\/\//.test(uri)) throw Object.assign(new Error('Configura MONGODB_URI con la cadena de conexión de MongoDB.'), { code: 'MONGODB_URI_INVALID' });
  if (!/^[a-zA-Z0-9_-]{1,63}$/.test(database)) throw Object.assign(new Error('MONGODB_DB debe contener letras, números, guiones o guiones bajos (hasta 63 caracteres).'), { code: 'MONGODB_DB_INVALID' });
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
        if (!result.acknowledged) throw Object.assign(new Error('No se pudo confirmar el guardado en MongoDB.'), { code: 'MONGODB_UNCONFIRMED' });
        return { id, repeated: false };
      } catch (error) {
        if (error.code !== 11000) throw error;
        const prior = await responses.findOne({ _id: body.solicitud });
        if (!prior) throw Object.assign(new Error('No se pudo confirmar el guardado en MongoDB.'), { code: 'MONGODB_UNCONFIRMED' });
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
