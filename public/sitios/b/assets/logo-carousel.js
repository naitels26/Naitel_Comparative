const logoCarousel = (() => {
  const carousel = document.querySelector('.logo-carousel');
  const list = document.querySelector('#carouselLogos');
  const message = document.querySelector('#logoCarouselMessage');
  const labels = {
    en: ['Partner logos', 'Partner logos are currently unavailable.'],
    es: ['Logos de marcas aliadas', 'Los logos no están disponibles en este momento.']
  };
  const SPEED = 60; // píxeles por segundo
  let language = 'en';
  let cards = [];
  let resizeTimer;

  function setLanguage(nextLanguage) {
    language = nextLanguage;
    const [name, unavailable] = labels[language];
    carousel.setAttribute('aria-label', name);
    message.textContent = unavailable;
  }

  function copyOf(card) {
    const clone = card.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    clone.querySelector('img')?.setAttribute('alt', '');
    return clone;
  }

  // Arma el bucle: una "mitad" con suficientes logos para cubrir el ancho de la
  // pantalla, y una segunda mitad idéntica. La animación recorre exactamente
  // una mitad (-50%), así que el reinicio es imperceptible.
  function render() {
    if (!cards.length) return;
    list.replaceChildren(...cards);
    const setWidth = list.scrollWidth;
    if (!setWidth) return;
    const repeats = Math.max(1, Math.ceil(carousel.clientWidth / setWidth));
    const half = [...cards];
    for (let i = 1; i < repeats; i++) half.push(...cards.map(copyOf));
    list.replaceChildren(...half, ...half.map(copyOf));
    list.style.animationDuration = `${Math.round((setWidth * repeats) / SPEED)}s`;
    list.classList.toggle('is-static', cards.length < 2);
  }

  async function load() {
    try {
      const catalog = await getPartnerCatalog();
      cards = catalog.map(({ name, logo, height }) => {
        const item = document.createElement('li');
        const image = document.createElement('img');
        image.alt = name;
        image.src = `assets/logos/${encodeURIComponent(logo)}`;
        image.loading = 'eager';
        image.decoding = 'async';
        image.style.height = `${Math.min(height, 24)}px`;
        image.addEventListener('error', () => {
          item.textContent = name;
          item.classList.add('logo-fallback');
        }, { once: true });
        item.append(image);
        return item;
      });
      render();
      message.hidden = cards.length > 0;
    } catch {
      cards = [];
      list.replaceChildren();
      message.hidden = false;
    }
  }

  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(render, 200);
  });

  return { load, setLanguage };
})();
