const esc = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const icon = (name, className = '') => `<svg class="icon ${className}" viewBox="0 0 256 256" aria-hidden="true">${ICONS[name] || ICONS['package']}</svg>`;
const wordmark = () => '<div class="wordmark" aria-label="Tarozi"><span class="mark" aria-hidden="true"><i></i><i></i><i></i></span><span>Tarozi</span></div>';
const demoStamp = () => '<span class="demo-stamp">Демоданные</span>';
function stockFor(productId, supplierId) {
  return offersFor(byId(productId)).find(offer => offer.id === supplierId).stock;
}
let initial = initialCart();
let favorites = ['rice', 'oil'];
try {
  const saved = JSON.parse(localStorage.getItem('lumora-style-lab-v1'));
  if (saved && Array.isArray(saved.cart)) {
    initial = saved.cart.filter(item => byId(item.productId) && supplierById(item.supplierId) && Number.isInteger(item.quantity) && item.quantity >= byId(item.productId).min && item.quantity <= stockFor(item.productId, item.supplierId));
  }
  if (saved && Array.isArray(saved.favorites)) favorites = saved.favorites.filter(id => byId(id));
} catch { /* The demonstration remains usable with storage disabled. */ }

const state = {
  page: 'market', productId: 'sugar', supplierId: 'baraka', quantity: 50,
  category: 'all', market: 'all', query: '', sort: 'default', range: 7, chartType: 'line',
  cart: initial, favorites: new Set(favorites), alerts: new Set(), thresholds: {},
  confirmed: false, feedback: ''
};
const navigation = [
  { id: 'market', label: 'Цены рынка', icon: 'chart-line' },
  { id: 'cart', label: 'Моя закупка', icon: 'shopping-bag' },
  { id: 'favorites', label: 'Избранное', icon: 'heart' },
  { id: 'alerts', label: 'Оповещения', icon: 'bell' },
  { id: 'stores', label: 'Магазины', icon: 'storefront' },
  { id: 'chat', label: 'Чат', icon: 'robot' }
];
const activeProduct = () => byId(state.productId);
const availableOffers = () => offersFor(activeProduct(), state.market);
const activeOffer = () => availableOffers().find(offer => offer.id === state.supplierId) || availableOffers()[0];
const visibleProducts = () => {const query=state.query.trim();const matched=products.filter(product=>matchesSearch([product.name,product.origin,...(TRANSLATIONS[product.name]||[]),...(TRANSLATIONS[product.short]||[]),...marketCatalog.items.filter(item=>item.productId===product.id).map(item=>item.name)].join(' '),query));return filteredProducts({...state,query:'',favoriteOnly:state.page==='favorites'}).filter(product=>matched.includes(product));};
const formatDelta = value => `${value > 0 ? '+' : value < 0 ? '−' : ''}${money(Math.abs(value))}`;
const deltaClass = value => value < 0 ? 'positive' : value > 0 ? 'negative' : 'muted';
const pageName = () => navigation.find(item => item.id === state.page)?.label || 'Цены рынка';

function save() {
  try { localStorage.setItem('lumora-style-lab-v1', JSON.stringify({ cart: state.cart, favorites: [...state.favorites] })); } catch { /* Optional persistence. */ }
}

function navigationButtons(mode = 'sidebar') {
  return activeNavigation().map(item => {
    const active = (state.page==='product-stats'?'alerts':state.page)===item.id;
    if (mode === 'rail') return `<button class="rail-button ${active ? 'active' : ''}" data-action="view" data-view="${item.id}" aria-label="${item.label}" title="${item.label}" ${active ? 'aria-current="page"' : ''}>${icon(item.icon)}</button>`;
    if (mode === 'compact') return `<button data-action="view" data-view="${item.id}" class="${active ? 'active' : ''}" title="${item.label}" aria-label="${item.label}" ${active ? 'aria-current="page"' : ''}>${icon(item.icon)}</button>`;
    if (mode === 'top') return `<button data-action="view" data-view="${item.id}" class="${active ? 'active' : ''}" ${active ? 'aria-current="page"' : ''}>${item.label}</button>`;
    return `<button class="nav-button ${active ? 'active' : ''}" data-action="view" data-view="${item.id}" ${active ? 'aria-current="page"' : ''}>${icon(item.icon)}<span>${item.label}</span>${item.id === 'cart' && state.cart.length ? `<span class="count num">${state.cart.length}</span>` : ''}</button>`;
  }).join('');
}

function cartButton(label = 'Моя закупка') {
  return `<button class="button" data-action="view" data-view="cart">${icon('shopping-bag')}<span class="button-label">${label} <span class="num">${state.cart.length}</span></span></button>`;
}

function heading(title, description) {
  return `<header class="heading-row"><div><h1 id="main-content" tabindex="-1">${title}</h1><p>${description}</p></div><div class="heading-right">${cartButton()}</div></header>`;
}

function tabs() {
  return `<nav class="tabline" aria-label="Категории товаров">${categories.map(category => `<button data-action="category" data-category="${category.id}" class="${state.category === category.id ? 'active' : ''}" aria-pressed="${state.category === category.id}">${category.name}</button>`).join('')}</nav>`;
}

function search() {
  return `<label class="search">${icon('magnifying-glass')}<span class="sr-only">Найти товар</span><input type="search" id="product-search" data-input="search" value="${esc(state.query)}" placeholder="Найти товар..." autocomplete="off" enterkeyhint="search"><kbd aria-hidden="true">/</kbd></label>`;
}

function filters() {
  return `<div class="filter-row">${search()}<div class="filters-right"><span class="meta num">${visibleProducts().length} из ${products.length} товаров</span><label class="select-wrap">${icon('sliders-horizontal')}<span class="sr-only">Сортировка товаров</span><select data-input="sort" id="product-sort"><option value="default" ${state.sort === 'default' ? 'selected' : ''}>По умолчанию</option><option value="price" ${state.sort === 'price' ? 'selected' : ''}>Сначала дешевле</option><option value="name" ${state.sort === 'name' ? 'selected' : ''}>По названию</option></select></label></div></div>`;
}

function favoriteButton(product) {
  const on = state.favorites.has(product.id);
  return `<button class="icon-btn ${on ? 'is-on' : ''}" data-action="favorite" data-id="${product.id}" aria-pressed="${on}" aria-label="${on ? 'Убрать из избранного' : 'В избранное'}: ${product.name}" title="${on ? 'В избранном' : 'В избранное'}">${icon('heart')}</button>`;
}

function emptyProducts() {
  return `<div class="empty"><h2>Товары не найдены</h2><p>${state.page === 'favorites' && !state.favorites.size ? 'Добавьте нужные товары в избранное.' : 'Попробуйте другое название или категорию.'}</p><button class="button" data-action="reset-filters">Показать все товары</button></div>`;
}

function rangeControls() {
  return `<div class="chart-range"><label class="chart-type-label"><span class="sr-only">Вид графика</span><select data-input="chart-type" aria-label="Вид графика"><option value="line" ${state.chartType==='line'?'selected':''}>Линия</option><option value="area" ${state.chartType==='area'?'selected':''}>Область</option><option value="bar" ${state.chartType==='bar'?'selected':''}>Столбцы</option></select><span class="muted">сум / ${activeProduct().unit}</span></label><div class="range-buttons" aria-label="Период графика"><button data-action="range" data-range="7" class="${state.range === 7 ? 'active' : ''}" aria-pressed="${state.range === 7}">7 дней</button><button data-action="range" data-range="30" class="${state.range === 30 ? 'active' : ''}" aria-pressed="${state.range === 30}">Месяц</button></div></div>`;
}

function priceAndChange(className = '') {
  const product = activeProduct();
  const best = offersFor(product, state.market)[0].price;
  const delta = change(product);
  return `<div class="quote-price ${className}"><strong class="num">${money(best)}</strong><span>сум / ${product.unit}</span></div><p class="quote-change ${deltaClass(delta)}">${delta < 0 ? icon('arrow-down-right') : icon('arrow-up-right')} <span class="num">${formatDelta(delta)} сум</span> за неделю</p>`;
}

function offerOptions() {
  return availableOffers().map((offer, index) => `<button class="offer-option" data-action="supplier" data-supplier="${offer.id}" aria-pressed="${activeOffer().id === offer.id}"><span class="radio-dot" aria-hidden="true"></span><span class="supplier-name"><strong>${offer.name}</strong><small>${offer.market}${index === 0 && availableOffers().length > 1 ? ' · лучшая цена' : ''}</small></span><span class="offer-price num">${money(offer.price)}<small>сум / ${activeProduct().unit}</small></span></button>`).join('');
}

function orderControls() {
  const product = activeProduct();
  const offer = activeOffer();
  return `<div class="quantity-area"><label class="quantity-label" for="order-quantity"><span>Количество, ${product.unit}</span><span>от ${product.min} ${product.unit}</span></label><div class="quantity-row"><div class="stepper"><button data-action="quantity" data-direction="-1" aria-label="Уменьшить количество" ${state.quantity <= product.min ? 'disabled' : ''}>${icon('minus')}</button><input id="order-quantity" data-input="quantity" type="number" inputmode="numeric" min="${product.min}" max="${offer.stock}" step="1" value="${state.quantity}"><button data-action="quantity" data-direction="1" aria-label="Увеличить количество" ${state.quantity >= offer.stock ? 'disabled' : ''}>${icon('plus')}</button></div><strong class="num">${money(state.quantity * offer.price)} <small>сум</small></strong></div><button class="button primary full" data-action="add">${icon('plus')}В список закупки</button><div class="delivery-line">${icon('truck')}Доставка от ${money(offer.delivery)} сум</div>${state.feedback ? `<p class="inline-feedback" role="status">${icon('check')} ${esc(state.feedback)}</p>` : ''}</div>`;
}

function marketStudio() {
  const product = activeProduct();
  const title = state.query.trim()?productLabel(product):state.page === 'favorites' ? 'То, что всегда под рукой' : 'Закупка на сегодня';
  return `<header class="heading-row"><div><h1 id="main-content" tabindex="-1">${title}</h1></div></header>${filters()}<nav class="studio-product-tabs" aria-label="Товары">${visibleProducts().map(item => `<button class="studio-product-tab ${state.productId === item.id ? 'active' : ''}" data-action="product" data-id="${item.id}" aria-pressed="${state.productId === item.id}"><span>${item.short}</span>${state.productId===item.id?icon('check-circle','studio-product-check'):''}<div><strong class="num">${money(offersFor(item, state.market)[0].price)}</strong><small>/${item.unit==='кг'?(language==='ru'?'кг':'kg'):(language==='ru'?'л':'l')}</small></div></button>`).join('')}</nav>${!visibleProducts().length ? emptyProducts() : ''}<div class="studio-feature-grid"><div><section class="studio-research"><div class="quote-top"><div><h2>${product.name}</h2><p class="meta">${product.origin} · ${product.pack}</p></div>${favoriteButton(product)}</div>${priceAndChange()}<div class="studio-chart-well">${rangeControls()}<div class="chart" data-chart></div></div></section></div><section class="studio-purchase"><h2>Выберите предложение</h2><p class="meta">${product.name} · цена за ${product.unit}</p><div class="offer-heading"><span>Поставщик</span><span class="muted">Сум / ${product.unit}</span></div>${offerOptions()}${orderControls()}</section></div>`;
}

function cartView() {
  const summary = cartSummary(state.cart);
  return `${heading('Моя закупка', `${summary.count} поз. · ${summary.supplierCount} поставщика · демонстрационный список`)}${state.cart.length ? `<div class="cart-layout"><section class="cart-list" aria-label="Товары в закупке">${state.cart.map((item, index) => {
    const product = byId(item.productId);
    const supplier = supplierById(item.supplierId);
    const price = product.prices[suppliers.indexOf(supplier)];
    return `<article class="cart-item"><div><h2>${product.name}</h2><p>${supplier.name} · ${supplier.market}</p><p>${money(price)} сум / ${product.unit}</p></div><div class="cart-value"><strong class="num">${money(price * item.quantity)} сум</strong><div class="stepper"><button data-action="cart-quantity" data-index="${index}" data-direction="-1" aria-label="Уменьшить: ${product.name}" ${item.quantity <= product.min ? 'disabled' : ''}>${icon('minus')}</button><span class="num">${item.quantity} ${product.unit}</span><button data-action="cart-quantity" data-index="${index}" data-direction="1" aria-label="Увеличить: ${product.name}" ${item.quantity >= product.stock ? 'disabled' : ''}>${icon('plus')}</button></div></div><button class="icon-btn" data-action="remove" data-index="${index}" aria-label="Убрать из закупки: ${product.name}" title="Убрать товар">${icon('x')}</button></article>`;
  }).join('')}<p class="cart-note">Стоимость доставки учитывается один раз для каждого поставщика.</p><button class="text-button" data-action="view" data-view="market">${icon('arrow-left')}Вернуться к ценам</button></section><aside class="cart-summary"><h2>Итог закупки</h2><div class="sum-row"><span>Товары</span><span class="num">${money(summary.goods)} сум</span></div><div class="sum-row"><span>Доставка</span><span class="num">${money(summary.delivery)} сум</span></div><div class="sum-total"><span>Итого</span><strong class="num">${money(summary.total)} <small>сум</small></strong></div><p class="meta">Товары ${summary.difference >= 0 ? 'дешевле' : 'дороже'} средней цены предложений на <span class="num">${money(Math.abs(summary.difference))} сум</span>.</p><button class="button primary full" data-action="confirm" ${state.confirmed ? 'disabled' : ''}>${state.confirmed ? icon('check') : icon('receipt')}${state.confirmed ? 'Демо-заявка готова' : 'Собрать демо-заявку'}</button>${state.confirmed ? '<div class="confirmed" role="status">' + icon('check-circle') + 'Закупка собрана<small>Это демонстрация: заявка никуда не отправлена.</small></div>' : '<p class="sum-note">Демонстрация оформления. Оплата и отправка поставщикам не выполняются.</p>'}</aside></div>` : `<div class="empty"><h2>Список пока пуст</h2><p>Выберите товар и добавьте предложение поставщика.</p><button class="button" data-action="view" data-view="market">Открыть цены рынка</button></div>`}`;
}

function alertsView() {
  return `${heading('Оповещения о цене', 'Выберите товары и укажите цену, за которой хотите следить.')}<div class="alerts-grid">${products.map(product => {
    const enabled = state.alerts.has(product.id);
    return `<section class="alert-card"><div class="quote-top"><div><h2><button class="alert-product-link" data-action="product-stats" data-id="${product.id}">${product.name}${icon('arrow-up-right')}</button></h2><p>Текущая демо-цена за ${product.unit}</p></div>${icon('bell')}</div><div class="quote-price"><strong class="num">${money(offersFor(product)[0].price)}</strong><span>сум / ${product.unit}</span></div><label for="threshold-${product.id}">Цена ниже<input type="number" id="threshold-${product.id}" data-input="threshold" data-id="${product.id}" min="1" step="100" value="${state.thresholds[product.id] || Math.floor(offersFor(product)[0].price * .95 / 100) * 100}">сум</label><button class="button" data-action="alert" data-id="${product.id}" aria-pressed="${enabled}">${icon(enabled ? 'check' : 'plus')}${enabled ? 'Отслеживается в демо' : 'Отслеживать цену'}</button></section>`;
  }).join('')}</div><p class="cart-note">Демонстрационные настройки. Уведомления не отправляются.</p>`;
}

function activeNavigation(){return profile?.role==='seller'?[...navigation.slice(0,-1),{id:'seller',label:'Кабинет',icon:'storefront'},navigation.at(-1)]:navigation;}
function pageBody(style) {
  if(!authReady)return '<div class="auth-loading" role="status" aria-label="Загрузка"><span></span></div>';
  if(!profile)return authView();
  if(state.page==='stores')return storesView();
  if(state.page==='seller')return sellerView();
  if(state.page==='product-stats')return productStatsView();
  if (state.page === 'chat') return '<div data-chat-page></div>';
  if (state.page === 'profile') return profileView();
  if (state.page === 'cart') return cartView();
  if (state.page === 'alerts') return alertsView();
  if (!visibleProducts().length) return `${heading(pageName(), 'Ташкент · демонстрационные предложения')}${tabs()}${filters()}${emptyProducts()}`;
  return marketStudio()+marketInsights();
}

const variants = [
  () => `<div class="app studio" data-ui><header class="studio-top">${wordmark()}<nav class="studio-nav" aria-label="Главная навигация">${navigationButtons('top')}</nav><div class="account"><div class="person-name">Магазин Дилшода<small>Ташкент</small></div><span class="avatar">Д</span></div></header><main class="studio-canvas">${pageBody('studio')}</main></div>`
];

function drawCharts() {
  const product = activeProduct();
  const offset = offersFor(product, state.market)[0].price - Math.min(...product.prices);
  const values = (state.range === 7 ? product.history : product.month).map(value => value + offset);
  const russianLabels = state.range === 7 ? ['25 окт', '26 окт', '27 окт', '28 окт', '29 окт', '30 окт', '31 окт'] : ['3 окт', '5 окт', '7 окт', '9 окт', '11 окт', '13 окт', '15 окт', '17 окт', '19 окт', '21 окт', '23 окт', '25 окт', '27 окт', '29 окт', '31 окт'];
  const labels=russianLabels.map(label=>language==='ru'?label:label.replace('окт',language==='uz'?'okt':'Oct'));
  const unit=language==='uz'?'so‘m':language==='en'?'UZS':'сум';
  const seriesName=language==='ru'?product.name:(TRANSLATIONS[product.name]?.[language==='uz'?1:0] || product.name);
  const step = Math.ceil((Math.max(...values) - Math.min(...values) + 1) / 3 / 100) * 100;
  const min = Math.floor(Math.min(...values) / step) * step - step;
  const max = Math.ceil(Math.max(...values) / step) * step + step;
  const yTicks = [];
  for (let tick = min; tick <= max; tick += step) yTicks.push(tick);
  document.querySelectorAll('[data-chart]').forEach(element => {
    if (element.dataset.drawn) return;
    element.dataset.drawn = 'true';
    Charts.line(element, { type:state.chartType, locale:language, unit, labels, series: [{ name: `${seriesName}, ${unit} / ${product.unit}`, values }], height: () => element.clientHeight || 170, yTicks, format: value => `${money(value)} сум`, tickFormat: money, xAt: state.range === 7 ? [0, 2, 4, 6] : [0, 4, 8, 12], label: `Демонстрационная минимальная цена: ${product.name}` });
  });
  if (language !== 'ru') translatePage();
}

function releaseCharts() {
  stage.querySelectorAll('[data-chart],[data-nav-header],[data-analytics-chart],[data-store-map],[data-store-picker]').forEach(element => Charts.release(element));
}

function syncSelected() {
  const visible = visibleProducts();
  if (visible.length && !visible.some(product => product.id === state.productId)) {
    state.productId = visible[0].id;
    state.quantity = visible[0].quantity;
    state.supplierId = offersFor(visible[0], state.market)[0].id;
  }
  if (!availableOffers().some(offer => offer.id === state.supplierId)) state.supplierId = availableOffers()[0].id;
}

function refresh() {
  const focus = document.activeElement;
  const id = focus?.id;
  const selection = focus?.selectionStart;
  releaseCharts();
  stage.innerHTML = variants[current]();
  finishRender();
  drawCharts();
  mountCommerce();
  if (id) {
    const replacement = document.getElementById(id);
    replacement?.focus({ preventScroll: true });
    if (typeof selection === 'number' && replacement?.type === 'search') replacement.setSelectionRange(selection, selection);
  }
}

document.addEventListener('click', event => {
  const target = event.target.closest('[data-action]');
  if (!target || target.disabled) return;
  const action = target.dataset.action;
  state.feedback = '';
  if (action === 'view') { state.page = target.dataset.view; state.confirmed = false; syncSelected(); if(state.page==='seller')queueMicrotask(loadSeller); }
  else if (action === 'product-stats') {if(!byId(target.dataset.id))return;state.productId=target.dataset.id;state.market='all';state.quantity=activeProduct().quantity;state.supplierId=availableOffers()[0].id;state.range=30;state.page='product-stats';}
  else if (action === 'product') { state.productId = target.dataset.id; state.quantity = activeProduct().quantity; state.supplierId = availableOffers()[0].id; }
  else if (action === 'category') { state.category = target.dataset.category; syncSelected(); }
  else if (action === 'market') { state.market = target.dataset.market; state.supplierId = availableOffers()[0].id; state.page = 'market'; }
  else if (action === 'favorite') { const id = target.dataset.id; state.favorites.has(id) ? state.favorites.delete(id) : state.favorites.add(id); save(); syncSelected(); }
  else if (action === 'supplier') { state.supplierId = target.dataset.supplier; state.quantity = Math.min(state.quantity, activeOffer().stock); }
  else if (action === 'range') state.range = Number(target.dataset.range);
  else if (action === 'quantity') state.quantity = Math.max(activeProduct().min, Math.min(activeOffer().stock, state.quantity + Number(target.dataset.direction)));
  else if (action === 'add') {
    const product = activeProduct();
    const offer = activeOffer();
    const existing = state.cart.find(item => item.productId === product.id && item.supplierId === offer.id);
    if (existing) existing.quantity = Math.min(offer.stock, existing.quantity + state.quantity);
    else state.cart.push({ productId: product.id, supplierId: offer.id, quantity: state.quantity });
    state.confirmed = false;
    state.feedback = `${product.short} в списке закупки`;
    document.getElementById('announcer').textContent = state.feedback;
    save();
  }
  else if (action === 'cart-quantity') {
    const item = state.cart[Number(target.dataset.index)];
    if (item) item.quantity = Math.max(byId(item.productId).min, Math.min(stockFor(item.productId, item.supplierId), item.quantity + Number(target.dataset.direction)));
    state.confirmed = false; save();
  }
  else if (action === 'remove') { state.cart.splice(Number(target.dataset.index), 1); state.confirmed = false; save(); }
  else if (action === 'confirm') state.confirmed = true;
  else if (action === 'alert') { const id = target.dataset.id; state.alerts.has(id) ? state.alerts.delete(id) : state.alerts.add(id); }
  else if (action === 'reset-filters') { state.query = ''; state.category = 'all'; state.page = 'market'; syncSelected(); }
  else return;
  refresh();
  if(action==='product-stats')window.scrollTo?.({top:0,left:0,behavior:'auto'});
});

document.addEventListener('input', event => {
  if (event.target.dataset.input === 'search') { state.query = event.target.value;if(state.query.trim()){state.category='all';state.market='all';state.page='market';state.range=30;}syncSelected();refresh(); }
  if (event.target.dataset.input === 'threshold') state.thresholds[event.target.dataset.id] = Math.max(1, Math.round(Number(event.target.value) || 1));
});
document.addEventListener('change', event => {
  if (event.target.dataset.input === 'chart-type') {state.chartType=event.target.value;refresh();}
  if (event.target.dataset.input === 'sort') { state.sort = event.target.value; refresh(); }
  if (event.target.dataset.input === 'quantity') { state.quantity = Math.max(activeProduct().min, Math.min(activeOffer().stock, Math.round(Number(event.target.value) || activeProduct().min))); refresh(); }
});

const stage = document.getElementById('stage');
let current = 0;
let language = localStorage.getItem('market-language') || 'ru';
let dark = localStorage.getItem('market-theme') === 'dark';
let profile = null;
let authReady = false, authMode = 'login', authError = '', authBusy = false, googleEnabled = false;
function finishRender() {
  const app = document.querySelector('.app');
  app?.classList.toggle('dark', dark);
  document.documentElement.lang = language;
  document.querySelector('meta[name="theme-color"]').content = dark ? '#0b0b0b' : '#ffffff';
  document.documentElement.style.background = dark ? '#0b0b0b' : '#ffffff';
  const account = document.querySelector('.studio-top .account');
  if (account) account.outerHTML = `<div class="account-controls"><label><span class="sr-only">Язык</span><select id="language-select" aria-label="Language"><option value="ru" ${language==='ru'?'selected':''}>RU</option><option value="en" ${language==='en'?'selected':''}>EN</option><option value="uz" ${language==='uz'?'selected':''}>UZ</option></select></label><button class="icon-btn" data-settings="theme" aria-label="Сменить тему" title="Сменить тему">${icon('sun')}</button><button class="profile-trigger" data-settings="profile"><span class="avatar">${esc(profile?.name?.slice(0,1) || 'Д')}</span><span>${esc(profile?.name || 'Аккаунт')}</span></button></div>`;
  if (language !== 'ru') translatePage();
  let assistantHost=document.getElementById('assistant-root');
  if(!assistantHost){assistantHost=document.createElement('div');assistantHost.id='assistant-root';document.body.appendChild(assistantHost);}
  assistantHost.className='app studio'+(dark?' dark':'');
  Charts.assistant(assistantHost,{language,target:document.querySelector('[data-chat-page]'),names:Object.fromEntries(products.map(product=>[product.id,language==='ru'?product.name:(TRANSLATIONS[product.name]?.[language==='uz'?1:0]||product.name)]))});
  const nav=document.querySelector('.studio-nav');
  if(nav){nav.hidden=!profile;nav.innerHTML='';nav.setAttribute('data-nav-header','');Charts.nav(nav,activeNavigation().map(item=>({id:item.id,label:language==='ru'?item.label:(TRANSLATIONS[item.label]?.[language==='uz'?1:0]||item.label)})),state.page==='product-stats'?'alerts':state.page,language==='ru'?'Главная навигация':language==='uz'?'Asosiy navigatsiya':'Main navigation');}
}
function profileView() {
  if (!authReady) return '<div class="auth-loading" role="status" aria-label="Загрузка"><span></span></div>';
  if (!profile) return authView();
  return `<section class="profile-page"><header class="heading-row"><div><h1 id="main-content">Профиль</h1><p>Ваш аккаунт и магазин</p></div></header><div class="profile-layout"><div class="profile-summary"><span class="avatar profile-avatar">${esc(profile?.name?.slice(0,1)||'Д')}</span><h2>${esc(profile?.name||'Дилшод Каримов')}</h2><p class="muted">${esc(profile?.email||'Локальный демо-профиль')}</p><p class="meta">${profile.role==='seller'?'Продавец':'Покупатель'} · Ташкент</p></div><form id="profile-form" class="profile-form">${authError?`<p class="negative" role="alert">${esc(authError)}</p>`:''}<label>Имя<input name="name" required maxlength="80" value="${esc(profile?.name||'Дилшод Каримов')}"></label><label>Email<input name="email" type="email" readonly value="${esc(profile?.email||'')}"></label><label>Название магазина<input name="store" required maxlength="100" value="${esc(profile?.store||'Магазин Дилшода')}"></label><button class="button primary" type="submit">Сохранить профиль</button><div class="oauth-section"><p class="meta">${profile.provider==='demo'?tr('Демо-вход','Demo session','Demo kirish'):profile.provider==='google'?'Вход через Google':'Вход по email'}</p><button class="button" type="button" data-auth="logout">Выйти из аккаунта</button></div></form></div></section>`;
}
document.addEventListener('click', event => {
  const settings=event.target.closest('[data-settings]');
  if(!settings) return;
  if(settings.dataset.settings==='theme') { dark=!dark; localStorage.setItem('market-theme',dark?'dark':'light'); refresh(); }
  else { state.page='profile'; refresh(); }
});
document.addEventListener('change', event => {
  if(event.target.id==='language-select') { language=event.target.value; localStorage.setItem('market-language',language); refresh(); }
});
document.addEventListener('submit', event => {
  if(event.target.id!=='profile-form') return;
  event.preventDefault();
  const values=new FormData(event.target);
  if(demoSession){profile.name=String(values.get('name'));profile.store=String(values.get('store'));if(profile.role==='seller')localStorage.setItem('tarozi-demo-store',JSON.stringify({...readDemoStore(),store:profile.store}));refresh();return;}
  accountRequest('/api/auth/profile',{name:values.get('name'),store:values.get('store')}).then(result=>{profile=result.user;refresh();document.getElementById('announcer').textContent='Профиль сохранён';}).catch(()=>{authError='Не удалось сохранить профиль';refresh();});
});
window.addEventListener('resize', drawCharts);
refresh();
document.fonts.ready.then(drawCharts);

async function accountRequest(endpoint, data) {
 const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify(data)});
 const result=await response.json(); if(!response.ok)throw new Error(result.error); return result;
}
function authView() {
 return `<section class="auth-page"><div class="auth-intro"><h1 id="main-content">${authMode==='register'?'Создать аккаунт':'Вход в Tarozi'}</h1><div class="auth-roles"><button type="button" data-commerce="role" data-role="buyer" aria-pressed="${authRole==='buyer'}" class="${authRole==='buyer'?'active':''}">${icon('user')}Покупатель</button><button type="button" data-commerce="role" data-role="seller" aria-pressed="${authRole==='seller'}" class="${authRole==='seller'?'active':''}">${icon('storefront')}Продавец</button></div></div><form id="account-form" class="profile-form auth-form">${authMode==='register'?'<label>Имя<input name="name" required maxlength="80" autocomplete="name"></label>':''}<label>Email<input name="email" type="email" required autocomplete="email"></label><label>Пароль<input name="password" type="password" required minlength="8" maxlength="128" autocomplete="${authMode==='register'?'new-password':'current-password'}"></label>${authMode==='register'?'<p class="meta">Не менее 8 символов, латинская буква и цифра.</p>':''}${authError?`<p class="negative" role="alert">${esc(authError)}</p>`:''}<button class="button primary full" ${authBusy?'disabled':''}>${authMode==='register'?'Создать аккаунт':'Войти'}</button><button class="button full google-entry" type="button" data-commerce="demo" ${authBusy?'disabled':''}><img src="${GOOGLE_LOGO}" width="20" height="20" alt="" aria-hidden="true">Продолжить с Google</button><button class="text-button" type="button" data-auth="switch">${authMode==='register'?'Уже есть аккаунт? Войти':'Нет аккаунта? Зарегистрироваться'}</button></form></section>`;
}
document.addEventListener('submit',async event=>{
 if(event.target.id!=='account-form')return;event.preventDefault();
 if(authBusy)return;
 const values=new FormData(event.target), data={...Object.fromEntries(values),role:authRole};
 authBusy=true;authError='';refresh();
 try{const result=await accountRequest('/api/auth/'+(authMode==='register'?'register':'login'),data);profile=result.user;demoSession=false;state.page=profile.role==='seller'?'seller':'market';loadCatalog();if(profile.role==='seller')loadSeller();}
 catch(error){authError=error.message==='EMAIL_EXISTS'?'Этот email уже зарегистрирован':error.message==='WEAK_PASSWORD'?'Не менее 8 символов, латинская буква и цифра.':error.message==='INVALID_CREDENTIALS'?'Неверный email или пароль':'Не удалось войти. Попробуйте ещё раз.';}
 finally{authBusy=false;refresh();}
});
document.addEventListener('click',async event=>{
 const control=event.target.closest('[data-auth]');if(!control)return;
 if(control.dataset.auth==='switch'){authMode=authMode==='login'?'register':'login';authError='';refresh();}
 if(control.dataset.auth==='google')location.assign('/api/auth/google?role='+authRole);
 if(control.dataset.auth==='logout'){try{if(!demoSession)await accountRequest('/api/auth/logout',{});profile=null;demoSession=false;sellerItems=[];sellerStats=null;state.page='market';refresh();}catch{authError='Не удалось выйти';refresh();}}
});
if(typeof fetch==='function')fetch('/api/auth/session',{credentials:'same-origin',cache:'no-store'}).then(response=>{if(!response.ok)throw new Error();return response.json();}).then(result=>{profile=result.user;googleEnabled=result.googleEnabled;if(profile){state.page=profile.role==='seller'?'seller':'market';loadCatalog();if(profile.role==='seller')queueMicrotask(loadSeller);}}).catch(()=>{googleEnabled=false;}).finally(()=>{authReady=true;const params=new URLSearchParams(location.search);if(params.has('auth')){state.page=profile?.role==='seller'?'seller':profile?'market':'profile';if(params.get('auth')==='failed')authError='Не удалось войти через Google. Попробуйте ещё раз.';history.replaceState(null,'','/');}refresh();});

document.addEventListener('tarozi:offer',event=>{
 const offer=event.detail;const product=byId(offer?.productId);if(!product||!supplierById(offer?.supplierId))return;
 const canonical=offersFor(product).find(item=>item.id===offer.supplierId);if(!canonical)return;
 state.page='market';state.market='all';state.category='all';state.query='';state.productId=product.id;state.supplierId=canonical.id;state.quantity=Math.max(product.min,Math.min(canonical.stock,Number(offer.quantity)||product.quantity));state.feedback='';refresh();
});
