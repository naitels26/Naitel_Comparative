const INTERACTIVE = 'a,button,input,textarea,select,label,form,summary,dialog,[contenteditable="true"],[role="button"],[role="slider"],[data-no-swipe],.header,.footer-ui,.slide-footer,.logo-carousel,.partner-map-controls,.cookie-banner';

export function swipeDirection({ dx, dy, duration, width }) {
  const threshold = Math.max(42, Math.min(80, width * 0.12));
  if (duration > 900 || duration < 0 || Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy) * 1.5) return 0;
  return dx < 0 ? 1 : -1;
}

export function canAutoplay({ mobile, reducedMotion, active, hidden, paused, interacting, contact, editing, overlay }) {
  return mobile && !reducedMotion && active && !hidden && !paused && !interacting && !contact && !editing && !overlay;
}

export function installCarousel(frame, { version, isActive, isPaused, delay = 6000 }) {
  const win = frame.contentWindow;
  const doc = frame.contentDocument;
  const hero = doc?.querySelector('.hero');
  const slides = [...(doc?.querySelectorAll('.slide') ?? [])];
  if (!hero || slides.length < 2 || typeof win.go !== 'function') return { refresh() {}, destroy() {} };
  const mobile = win.matchMedia('(max-width: 760px), (pointer: coarse)');
  const motion = win.matchMedia('(prefers-reduced-motion: reduce)');
  const cleanups = [];
  let timer = null, gesture = null, destroyed = false;
  hero.setAttribute('data-comparator-swipe', '');
  const listen = (target, type, fn, options) => {
    target.addEventListener(type, fn, options);
    cleanups.push(() => target.removeEventListener(type, fn, options));
  };
  const currentIndex = () => slides.findIndex(slide => slide.classList.contains('active'));
  const blocked = () => !canAutoplay({
    mobile: mobile.matches, reducedMotion: motion.matches,
    active: isActive(), hidden: doc.hidden, paused: isPaused(), interacting: Boolean(gesture),
    contact: slides[currentIndex()]?.id === 'contacto',
    editing: Boolean(doc.activeElement?.closest('input,textarea,select,form,[contenteditable="true"]')),
    overlay: Boolean(doc.querySelector('dialog[open], #solutionsMenu:not([hidden])'))
  });
  function move(direction, announce = true) {
    const index = currentIndex();
    // Let the original function wrap the index so A also keeps its reverse
    // transition when swiping from the first slide to the last one.
    if (index >= 0) win.go(index + direction, announce);
  }
  function refresh() {
    win.clearTimeout(timer); timer = null;
    if (destroyed || version !== 'b') return;
    if (!blocked()) timer = win.setTimeout(() => {
      timer = null;
      if (!blocked()) move(1, false);
      refresh();
    }, delay);
    hero.setAttribute('data-comparator-autoplay', timer === null ? 'paused' : 'running');
  }
  function start(event) {
    if (!event.isPrimary) { gesture = null; refresh(); return; }
    if (!mobile.matches || !isActive() || isPaused() || doc.querySelector('dialog[open]') || event.target.closest(INTERACTIVE) || (event.pointerType === 'mouse' && event.button !== 0)) return;
    // A narrow desktop window may also use this layout. Keep mouse text selection
    // available; only a drag that starts on empty space acts as a mouse swipe.
    if (event.pointerType === 'mouse' && event.target.closest('p,h1,h2,h3,h4,li,dt,dd')) return;
    gesture = { id: event.pointerId, type: event.pointerType, selected: Boolean(win.getSelection()?.toString().trim()), x: event.clientX, y: event.clientY, at: win.performance.now() };
    // Keep the gesture intact even if the finger reaches the iframe's edge.
    try { hero.setPointerCapture?.(event.pointerId); } catch { /* Pointer already ended. */ }
    refresh();
  }
  function moving(event) {
    if (!gesture || gesture.id !== event.pointerId) return;
    const dx = Math.abs(event.clientX - gesture.x), dy = Math.abs(event.clientY - gesture.y);
    // Vertical scrolling stays native; it must never change a slide.
    if (dy > 12 && dy > dx * 1.2) { gesture = null; refresh(); }
  }
  function end(event) {
    if (!gesture || gesture.id !== event.pointerId) return;
    const start = gesture; gesture = null;
    try { hero.releasePointerCapture?.(event.pointerId); } catch { /* Capture already released. */ }
    const direction = swipeDirection({ dx: event.clientX - start.x, dy: event.clientY - start.y, duration: win.performance.now() - start.at, width: win.innerWidth });
    const selectedText = Boolean(win.getSelection()?.toString().trim());
    if (direction && !start.selected && (start.type === 'mouse' || !selectedText) && mobile.matches && isActive() && !isPaused() && !doc.querySelector('dialog[open]')) {
      if (start.type === 'mouse') win.getSelection()?.removeAllRanges();
      move(direction);
    }
    refresh();
  }
  function cancel() { gesture = null; refresh(); }
  listen(hero, 'pointerdown', start, { passive: true });
  listen(doc, 'pointermove', moving, { passive: true });
  listen(doc, 'pointerup', end, { passive: true });
  listen(doc, 'pointercancel', cancel, { passive: true });
  listen(doc, 'click', refresh);
  listen(doc, 'focusin', refresh);
  listen(doc, 'focusout', refresh);
  listen(doc, 'scroll', refresh, { capture: true, passive: true });
  listen(doc, 'visibilitychange', refresh);
  listen(mobile, 'change', cancel);
  listen(motion, 'change', refresh);
  // Observe only slide activation and open/close states, not animation frames.
  const observer = new win.MutationObserver(refresh);
  for (const slide of slides) observer.observe(slide, { attributes: true, attributeFilter: ['class'] });
  for (const overlay of doc.querySelectorAll('dialog, #solutionsMenu')) observer.observe(overlay, { attributes: true, attributeFilter: ['open', 'hidden'] });
  refresh();
  return {
    refresh,
    destroy() {
      destroyed = true; win.clearTimeout(timer); observer.disconnect();
      for (const cleanup of cleanups) cleanup();
      hero.removeAttribute('data-comparator-swipe');
      hero.removeAttribute('data-comparator-autoplay');
    }
  };
}
