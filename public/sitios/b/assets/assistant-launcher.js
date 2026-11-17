function setupAssistantLauncher(button, open) {
  const header = document.querySelector('.header');
  const logos = document.querySelector('.logo-carousel');
  let pointer = null;
  let dragged = false;

  function position(left, top) {
    const edge = 8;
    const minTop = header.getBoundingClientRect().bottom + edge;
    const maxTop = logos.getBoundingClientRect().top - button.offsetHeight - edge;
    const maxLeft = document.documentElement.clientWidth - button.offsetWidth - edge;
    button.style.left = `${Math.max(edge, Math.min(left, maxLeft))}px`;
    button.style.top = `${Math.max(minTop, Math.min(top, maxTop))}px`;
    button.dataset.moved = '';
  }

  button.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    const { left, top } = button.getBoundingClientRect();
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, left, top };
    dragged = false;
    button.setPointerCapture(pointer.id);
  });

  button.addEventListener('pointermove', event => {
    if (pointer?.id !== event.pointerId) return;
    const dx = event.clientX - pointer.x;
    const dy = event.clientY - pointer.y;
    if (!dragged && Math.hypot(dx, dy) < 6) return;
    dragged = true;
    button.dataset.dragging = '';
    position(pointer.left + dx, pointer.top + dy);
  });

  button.addEventListener('lostpointercapture', () => {
    pointer = null;
    delete button.dataset.dragging;
  });

  button.addEventListener('click', event => {
    if (event.detail && dragged) return;
    open();
  });

  function keepInView() {
    if (!button.hasAttribute('data-moved')) return;
    const { left, top } = button.getBoundingClientRect();
    position(left, top);
  }

  window.addEventListener('resize', keepInView);
  new ResizeObserver(keepInView).observe(button);
}
