const partnersMap = (() => {
  const slide = document.querySelector('#partnerMap');
  const layer = slide.querySelector('.partner-map-layer');
  const controls = slide.querySelector('.partner-map-controls');
  const counter = controls.querySelector('output');
  const previous = controls.querySelector('[data-map-step="-1"]');
  const next = controls.querySelector('[data-map-step="1"]');
  const regions = [
    ['americas', { US: [23, 52], CA: [24, 45], MX: [21, 58] }],
    ['europe', { SE: [55.8, 35], DK: [53.9, 37.2], DE: [53.1, 40], FI: [58.2, 33.2], FR: [50.6, 42.5], NL: [52, 39], CH: [53, 43] }],
    ['asia', { CN: [79.5, 45.8], KR: [83, 42.6], TW: [83, 50.5] }]
  ];
  const labels = {
    es: { americas: 'Norteamérica', europe: 'Europa', asia: 'Asia oriental', other: 'Otras marcas', unknown: 'Origen sin indicar', previous: 'Grupo anterior de marcas', next: 'Siguiente grupo de marcas' },
    en: { americas: 'North America', europe: 'Europe', asia: 'East Asia', other: 'Other brands', unknown: 'Origin not listed', previous: 'Previous group of brands', next: 'Next group of brands' }
  };
  let language = 'en';
  let countryNames = new Intl.DisplayNames(language, { type: 'region', fallback: 'none' });
  let groups = [];
  let scenes = [];
  let index = 0;

  function makeGroups(catalog) {
    const unplaced = new Set(catalog);
    const byRegion = regions.map(([name, points]) => {
      const brands = Object.keys(points).flatMap(code => catalog.filter(brand => brand.country === code));
      brands.forEach(brand => unplaced.delete(brand));
      return { name, points, brands };
    });
    const count = Math.ceil(Math.max(...byRegion.map(region => region.brands.length)) / 3);
    const groups = Array.from({ length: count }, () => []);
    byRegion.forEach(region => {
      const portions = Array.from({ length: count }, () => []);
      region.brands.forEach((brand, i) => {
        portions[Math.floor(i * count / region.brands.length)].push(brand);
      });
      portions.forEach((brands, i) => {
        if (brands.length) groups[i].push({ ...region, brands });
      });
    });
    const remaining = [...unplaced];
    for (let i = 0; i < remaining.length; i += 3) {
      groups.push([{ name: 'other', points: {}, brands: remaining.slice(i, i + 3) }]);
    }
    return groups;
  }

  function countryLabel(code) {
    return (/^[A-Z]{2}$/.test(code) && countryNames.of(code)) || labels[language].unknown;
  }

  function buildScene(group) {
    const scene = document.createElement('div');
    scene.className = 'partner-map-scene';
    group.forEach(({ name, points, brands }) => {
      const list = document.createElement('ul');
      const countries = [...new Set(brands.map(brand => brand.country))];
      const anchors = countries.map(country => points[country]).filter(Boolean);
      const x = anchors.length ? Math.min(...anchors.map(point => point[0])) : 57;
      const y = anchors.length ? anchors.reduce((sum, point) => sum + point[1], 0) / anchors.length : 51;
      list.className = 'partner-map-cluster';
      list.setAttribute('aria-label', labels[language][name]);
      list.style.setProperty('--map-x', `${x}%`);
      list.style.setProperty('--map-y', `${y}%`);
      const ordered = [...brands].sort((a, b) => (points[a.country]?.[1] ?? 0) - (points[b.country]?.[1] ?? 0));
      ordered.forEach(brand => {
        const item = document.createElement('li');
        const mark = document.createElement('div');
        const logo = document.createElement('img');
        const country = document.createElement('span');
        mark.className = 'partner-map-mark';
        logo.src = `assets/logos/${encodeURIComponent(brand.logo)}`;
        logo.alt = brand.name;
        logo.decoding = 'async';
        country.textContent = countryLabel(brand.country);
        mark.append(logo);
        item.append(mark, country);
        list.append(item);
      });
      for (const point of anchors) {
        const pin = document.createElement('span');
        pin.className = 'partner-map-pin';
        pin.setAttribute('aria-hidden', 'true');
        pin.style.setProperty('--map-x', `${point[0]}%`);
        pin.style.setProperty('--map-y', `${point[1]}%`);
        scene.append(pin);
      }
      scene.append(list);
    });
    return scene;
  }

  function select(position) {
    if (!scenes.length) return;
    index = (position + scenes.length) % scenes.length;
    scenes.forEach((scene, i) => {
      scene.toggleAttribute('data-current', i === index);
      scene.setAttribute('aria-hidden', String(i !== index));
    });
    counter.value = `${String(index + 1).padStart(2, '0')} / ${String(scenes.length).padStart(2, '0')}`;
  }

  function render() {
    scenes = groups.map(buildScene);
    layer.replaceChildren(...scenes);
    controls.hidden = scenes.length < 2;
    select(index);
  }

  function setLanguage(nextLanguage) {
    language = nextLanguage;
    countryNames = new Intl.DisplayNames(language, { type: 'region', fallback: 'none' });
    previous.setAttribute('aria-label', labels[language].previous);
    next.setAttribute('aria-label', labels[language].next);
    if (groups.length) render();
  }

  async function load() {
    const status = slide.querySelector('.partner-map-status');
    try {
      groups = makeGroups(await getPartnerCatalog());
      render();
      status.hidden = groups.length > 0;
    } catch {
      status.hidden = false;

    }
  }

  previous.addEventListener('click', () => select(index - 1));
  next.addEventListener('click', () => select(index + 1));
  return { load, setLanguage };
})();
