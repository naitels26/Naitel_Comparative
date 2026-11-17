// B starts in a hidden iframe. Wait for real dimensions before building its loop.
export function marqueeLayout(setWidth, viewportWidth, speed = 60) {
  if (!(setWidth > 0) || !(viewportWidth > 0) || !(speed > 0)) return null;
  const copies = Math.max(1, Math.ceil(viewportWidth / setWidth));
  return { copies, halfWidth: setWidth * copies, duration: setWidth * copies / speed * 1000 };
}

export function installLogoMarquee(frame, { isActive, isPaused }) {
  const win = frame.contentWindow;
  const doc = frame.contentDocument;
  const region = doc?.querySelector('.logo-carousel');
  const list = doc?.querySelector('#carouselLogos');
  if (!region || !list) return { refresh() {}, destroy() {} };
  const motion = win.matchMedia('(prefers-reduced-motion: reduce)');
  const hover = win.matchMedia('(hover: hover) and (pointer: fine)');
  const cleanups = [];
  let animation = null, dirty = true, destroyed = false, hovered = false, touching = false;
  const listen = (target, name, action, options) => {
    target.addEventListener(name, action, options);
    cleanups.push(() => target.removeEventListener(name, action, options));
  };
  const observe = () => changes.observe(list, { childList: true });
  const clone = node => {
    const copy = node.cloneNode(true);
    copy.setAttribute('aria-hidden', 'true');
    copy.querySelector('img')?.setAttribute('alt', '');
    return copy;
  };
  function rebuild() {
    const cards = [...list.children].filter(node => node.getAttribute('aria-hidden') !== 'true');
    if (cards.length < 2) return;
    const width = cards.reduce((total, card) => {
      const style = win.getComputedStyle(card);
      return total + card.getBoundingClientRect().width + (parseFloat(style.marginLeft) || 0) + (parseFloat(style.marginRight) || 0);
    }, 0);
    const layout = marqueeLayout(width, region.clientWidth);
    if (!layout) return;
    const elapsed = Number(animation?.currentTime) || 0;
    animation?.cancel();
    // Disconnect during our own clones so the observer cannot rebuild endlessly.
    changes.disconnect();
    const half = [...cards];
    for (let n = 1; n < layout.copies; n++) half.push(...cards.map(clone));
    list.replaceChildren(...half, ...half.map(clone));
    list.classList.remove('is-static');
    list.style.animation = 'none';
    list.setAttribute('aria-live', 'off');
    observe();
    // Web Animations avoids the original sticky :hover pause on touchscreens.
    animation = list.animate([{ transform: 'translateX(0)' }, { transform: `translateX(-${layout.halfWidth}px)` }], {
      duration: layout.duration, iterations: Infinity, easing: 'linear'
    });
    animation.currentTime = elapsed % layout.duration;
    dirty = false;
  }
  function refresh() {
    if (destroyed) return;
    if (isActive() && region.clientWidth > 0 && (dirty || !animation)) rebuild();
    const paused = !isActive() || isPaused() || doc.hidden || motion.matches || hovered || touching || region.contains(doc.activeElement);
    if (animation) {
      if (paused) animation.pause();
      else if (animation.playState !== 'running') animation.play();
      region.setAttribute('data-comparator-marquee', paused ? 'paused' : 'running');
    }
  }
  const changes = new win.MutationObserver(() => { dirty = true; refresh(); });
  observe();
  const size = new win.ResizeObserver(() => { dirty = true; refresh(); });
  size.observe(region);
  listen(doc, 'visibilitychange', refresh);
  listen(motion, 'change', refresh);
  listen(hover, 'change', () => { hovered = false; refresh(); });
  listen(region, 'pointerenter', event => { if (hover.matches && event.pointerType === 'mouse') { hovered = true; refresh(); } });
  listen(region, 'pointerleave', () => { hovered = false; refresh(); });
  listen(region, 'pointerdown', event => { if (event.pointerType !== 'mouse') { touching = true; refresh(); } }, { passive: true });
  const release = () => { if (touching) { touching = false; refresh(); } };
  listen(doc, 'pointerup', release, { passive: true });
  listen(doc, 'pointercancel', release, { passive: true });
  listen(region, 'focusin', refresh);
  listen(region, 'focusout', () => win.queueMicrotask(refresh));
  refresh();
  return {
    refresh,
    destroy() {
      destroyed = true;
      animation?.cancel(); changes.disconnect(); size.disconnect();
      for (const cleanup of cleanups) cleanup();
      region.removeAttribute('data-comparator-marquee');
    }
  };
}
