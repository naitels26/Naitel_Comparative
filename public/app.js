// Apply the requested mobile alignment equally to both embedded versions.
// Keep all reference files intact and reapply after navigation inside a frame.
for (const frame of document.querySelectorAll('.viewer iframe')) {
  const alignMobileNavigation = () => {
    const doc = frame.contentDocument;
    if (!doc?.head || doc.querySelector('[data-comparator-navigation]')) return;
    const style = doc.createElement('link');
    style.rel = 'stylesheet';
    style.href = '/mobile-navigation.css';
    style.dataset.comparatorNavigation = '';
    doc.head.append(style);
  };
  frame.addEventListener('load', alignMobileNavigation);
  if (frame.contentDocument?.readyState === 'complete') alignMobileNavigation();
}
const tabs = [...document.querySelectorAll('[role="tab"]')];
function selectTab(tab) {
  for (const item of tabs) {
    const selected = item === tab;
    item.setAttribute('aria-selected', String(selected));
    item.tabIndex = selected ? 0 : -1;
    document.getElementById(item.getAttribute('aria-controls')).hidden = !selected;
  }
  // Both iframes stay mounted: no src changes or document reloads.
}
for (const [index, tab] of tabs.entries()) {
  tab.addEventListener('click', () => selectTab(tab));
  tab.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? tabs[0] : event.key === 'End' ? tabs.at(-1) : tabs[(index + 1) % tabs.length];
    selectTab(next); next.focus();
  });
}
const dialog = document.getElementById('survey');
const form = document.getElementById('survey-form');
const submit = document.getElementById('submit');
const status = document.getElementById('form-status');
const motivo = document.getElementById('motivo');
let pending = false, saved = false, attemptedPayload = null;
// The page retains the key during retries. Responses are stored only by the server.
function uuid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
  return [...bytes].map((b,i) => ([4,6,8,10].includes(i) ? '-' : '') + b.toString(16).padStart(2,'0')).join('');
}
const requestId = uuid();
document.getElementById('opinion').addEventListener('click', () => dialog.showModal());
document.getElementById('close').addEventListener('click', () => dialog.close());
document.getElementById('continue').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => document.getElementById('opinion').focus());
motivo.addEventListener('input', () => motivo.setCustomValidity(''));
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (pending || saved) return;
  if (!motivo.value.trim()) { motivo.setCustomValidity('Cuéntanos por qué prefieres esa versión.'); motivo.reportValidity(); return; }
  if (!form.reportValidity()) return;
  pending = true;
  submit.disabled = true;
  submit.textContent = 'Guardando…';
  status.textContent = '';
  // After an uncertain network result, retry exactly the original payload.
  attemptedPayload ||= { solicitud: requestId, ...Object.fromEntries(new FormData(form)) };
  for (const control of form.elements) control.disabled = true;
  try {
    const response = await fetch('/api/respuestas', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(attemptedPayload), signal: AbortSignal.timeout(20000)
    });
    const result = await response.json();
    if (!response.ok || !result.guardada) {
      if (response.status >= 400 && response.status < 500) attemptedPayload = null;
      throw new Error(result.error || 'No pudimos guardar tu respuesta. Inténtalo nuevamente.');
    }
    saved = true;
    document.getElementById('questions').hidden = true;
    document.getElementById('success').hidden = false;
    document.getElementById('success').focus();
  } catch (error) {
    status.textContent = error.name === 'TimeoutError' || error.name === 'TypeError'
      ? 'No pudimos confirmar el guardado. Reintenta el envío; no se duplicará tu respuesta.'
      : error.message;
    // If the result is uncertain, keep fields locked so retry uses identical data.
    for (const control of form.elements) control.disabled = attemptedPayload !== null;
  } finally {
    pending = false;
    submit.disabled = false;
    submit.textContent = attemptedPayload && !saved ? 'Reintentar envío' : 'Enviar mi opinión →';
  }
});
