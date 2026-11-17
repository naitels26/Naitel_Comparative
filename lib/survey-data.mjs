export function validate(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  if (typeof body.solicitud !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.solicitud)) return null;
  if (!['A', 'B'].includes(body.preferencia) || !['Celular', 'Computadora', 'Tableta'].includes(body.dispositivo)) return null;
  const choices = ['A', 'B'];
  if (!choices.includes(body.facilidad) || !choices.includes(body.claridad)) return null;
  if (typeof body.motivo !== 'string' || typeof body.mejoras !== 'string') return null;
  const motivo = body.motivo.trim();
  const mejoras = body.mejoras.trim();
  if (!motivo || motivo.length > 4000 || mejoras.length > 4000 || /\x00/.test(motivo + mejoras)) return null;
  return { solicitud: body.solicitud, preferencia: body.preferencia, motivo, mejoras, dispositivo: body.dispositivo, facilidad: body.facilidad, claridad: body.claridad };
}

export function csv(rows) {
  const keys = ['id', 'fecha', 'preferencia', 'motivo', 'facilidad', 'claridad', 'mejoras', 'dispositivo'];
  const cell = value => {
    let text = String(value ?? '');
    // Prevent spreadsheet formula execution, including leading whitespace/control characters.
    if (/^[\s\u0000-\u001f]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  return '\uFEFF' + [keys, ...rows.map(row => keys.map(key => row[key]))].map(row => row.map(cell).join(',')).join('\r\n') + '\r\n';
}
