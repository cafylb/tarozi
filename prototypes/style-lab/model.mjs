// Illustrative prices and supplier identities, not live market information.
export const suppliers = [
  { id: 'baraka', name: 'Baraka Savdo', market: 'Куйлюк', initials: 'BS' },
  { id: 'chorsu', name: 'Chorsu Opt', market: 'Чорсу', initials: 'CO' },
  { id: 'fayz', name: 'Fayz Trade', market: 'Фархадский', initials: 'FT' },
  { id: 'ravnaq', name: 'Ravnaq Agro', market: 'Куйлюк', initials: 'RA' },
  { id: 'hamkor', name: 'Hamkor Savdo', market: 'Ипподром', initials: 'HS' }
];

export const products = [
  { id: 'sugar', name: 'Сахар-песок', short: 'Сахар', category: 'grocery', origin: 'Белый, кристаллический', unit: 'кг', pack: 'Мешок 50 кг', quantity: 50, min: 25, stock: 1400, prices: [9800, 10100, 10400, 9900, 10200], history: [10500, 10400, 10600, 10300, 10200, 10000, 9800], month: [11200, 11100, 11300, 10900, 10800, 11000, 10600, 10800, 10500, 10400, 10600, 10300, 10200, 10000, 9800] },
  { id: 'rice', name: 'Рис «Лазер»', short: 'Рис', category: 'grocery', origin: 'Хорезм, первый сорт', unit: 'кг', pack: 'Мешок 25 кг', quantity: 25, min: 5, stock: 600, prices: [15200, 14500, 14900, 15000, 14700], history: [14200, 14400, 14300, 14600, 14700, 14600, 14500], month: [13800, 13700, 13900, 14100, 14000, 14200, 14400, 14300, 14200, 14400, 14300, 14600, 14700, 14600, 14500] },
  { id: 'oil', name: 'Масло подсолнечное', short: 'Масло', category: 'oil', origin: 'Рафинированное, 1 л', unit: 'л', pack: 'Коробка 12 × 1 л', quantity: 12, min: 6, stock: 480, prices: [17800, 18500, 18100, 17600, 18300], history: [18900, 18600, 18700, 18400, 18200, 18000, 17800], month: [19500, 19400, 19600, 19200, 19300, 19100, 19000, 18900, 18900, 18600, 18700, 18400, 18200, 18000, 17800] },
  { id: 'flour', name: 'Мука пшеничная', short: 'Мука', category: 'grocery', origin: 'Высший сорт', unit: 'кг', pack: 'Мешок 25 кг', quantity: 25, min: 25, stock: 1200, prices: [7200, 7100, 6900, 7000, 7300], history: [7100, 7100, 7000, 7200, 7000, 7000, 6900], month: [7500, 7600, 7400, 7300, 7500, 7200, 7300, 7200, 7100, 7100, 7000, 7200, 7000, 7000, 6900] },
  { id: 'onion', name: 'Лук репчатый', short: 'Лук', category: 'vegetables', origin: 'Урожай 2026, местный', unit: 'кг', pack: 'Сетка 20 кг', quantity: 20, min: 20, stock: 2000, prices: [3200, 2800, 3000, 3100, 2900], history: [3200, 3400, 3100, 3000, 2900, 3000, 2800], month: [3600, 3500, 3700, 3400, 3500, 3300, 3400, 3200, 3200, 3400, 3100, 3000, 2900, 3000, 2800] },
  { id: 'potato', name: 'Картофель', short: 'Картофель', category: 'vegetables', origin: 'Самарканд, отборный', unit: 'кг', pack: 'Сетка 20 кг', quantity: 20, min: 20, stock: 1600, prices: [4500, 4400, 4200, 4600, 4300], history: [3900, 4000, 4100, 4000, 4300, 4100, 4200], month: [3800, 3900, 3700, 3900, 4000, 3800, 4000, 3900, 3900, 4000, 4100, 4000, 4300, 4100, 4200] },
  { id: 'carrot', name: 'Морковь', short: 'Морковь', category: 'vegetables', origin: 'Ташкент, свежий урожай', unit: 'кг', pack: 'Сетка 10 кг', quantity: 10, min: 10, stock: 900, prices: [5200, 5500, 5000, 5300, 5100], history: [5800, 5600, 5500, 5400, 5300, 5100, 5200], month: [6200, 6100, 6000, 5900, 5800, 5700, 5700, 5600, 5600, 5500, 5500, 5400, 5300, 5100, 5200] },
  { id: 'tomato-paste', name: 'Томатная паста', short: 'Т. паста', category: 'grocery', origin: 'Иссыккуль, 1 кг', unit: 'кг', pack: 'Банка 1 кг × 12', quantity: 12, min: 6, stock: 720, prices: [22000, 23500, 21800, 22400, 23000], history: [24000, 23500, 23200, 22800, 22500, 22200, 22000], month: [25500, 25200, 24800, 24500, 24200, 24000, 23800, 23500, 23500, 23200, 23200, 22800, 22500, 22200, 22000] },
  { id: 'butter', name: 'Масло сливочное', short: 'Сл. масло', category: 'oil', origin: '82.5%, 200 г', unit: 'кг', pack: 'Коробка 10 × 200 г', quantity: 2, min: 2, stock: 300, prices: [95000, 98000, 92000, 96000, 94000], history: [97000, 96000, 95500, 95000, 94500, 94000, 95000], month: [102000, 101000, 100000, 99500, 99000, 98000, 97500, 97000, 96000, 95500, 95000, 94500, 94500, 94000, 95000] },
  { id: 'tea', name: 'Чай чёрный', short: 'Чай', category: 'grocery', origin: 'Tess, 100 пак.', unit: 'кг', pack: 'Упаковка 100 пак.', quantity: 4, min: 2, stock: 500, prices: [28000, 29500, 27500, 28500, 29000], history: [30000, 29500, 29200, 28800, 28500, 28200, 28000], month: [31500, 31200, 30800, 30500, 30200, 30000, 29800, 29500, 29500, 29200, 29200, 28800, 28500, 28200, 28000] },
  { id: 'egg', name: 'Яйца куриные', short: 'Яйца', category: 'grocery', origin: '30 шт., первая категория', unit: 'кг', pack: 'Лоток 30 шт.', quantity: 30, min: 30, stock: 1800, prices: [32000, 33500, 31500, 32500, 33000], history: [35000, 34200, 33800, 33200, 32800, 32500, 32000], month: [37000, 36500, 36000, 35500, 35200, 35000, 34500, 34200, 34000, 33800, 33800, 33200, 32800, 32500, 32000] },
  { id: 'pasta', name: 'Макароны', short: 'Макароны', category: 'grocery', origin: 'Спагетти, 500 г', unit: 'кг', pack: 'Пачка 500 г × 20', quantity: 10, min: 5, stock: 800, prices: [11500, 12000, 11200, 11800, 11600], history: [12500, 12200, 12000, 11800, 11600, 11500, 11500], month: [13500, 13200, 13000, 12800, 12600, 12500, 12300, 12200, 12200, 12000, 12000, 11800, 11600, 11500, 11500] }
];

// Keep illustrative histories and supplier stock aligned with current quotes.
for(const product of products){if(product.id==='egg'){product.unit='шт';product.prices=product.prices.map(price=>Math.round(price/30/10)*10);product.history=product.history.map(price=>Math.round(price/30/10)*10);product.month=product.month.map(price=>Math.round(price/30/10)*10);}product.history[product.history.length-1]=Math.min(...product.prices);product.month.splice(-7,7,...product.history);}

export const categories = [{ id: 'all', name: 'Все товары' }, { id: 'grocery', name: 'Бакалея' }, { id: 'vegetables', name: 'Овощи' }, { id: 'oil', name: 'Масла' }];
export const money = value => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(value);
export function matchesSearch(text,query){
  const words=value=>String(value).normalize('NFKC').toLocaleLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const haystack=words(text);return words(query).every(token=>haystack.some(word=>word.startsWith(token)));
}
export const byId = id => products.find(product => product.id === id);
export const supplierById = id => suppliers.find(supplier => supplier.id === id);
export const offersFor = (product, market = 'all') => suppliers.map((supplier, index) => ({ ...supplier, price: product.prices[index], stock: Math.max(product.min,product.stock - index * 50) })).filter(offer => market === 'all' || offer.id === market).sort((a, b) => a.price - b.price);
export const average = product => Math.round(product.prices.reduce((sum, price) => sum + price, 0) / product.prices.length);
export const change = product => Math.min(...product.prices) - product.history[0];
export const initialCart = () => [
  { productId: 'sugar', supplierId: 'baraka', quantity: 50 },
  { productId: 'rice', supplierId: 'chorsu', quantity: 25 },
  { productId: 'oil', supplierId: 'baraka', quantity: 12 },
  { productId: 'flour', supplierId: 'fayz', quantity: 25 },
  { productId: 'onion', supplierId: 'ravnaq', quantity: 20 },
  { productId: 'potato', supplierId: 'hamkor', quantity: 20 },
  { productId: 'carrot', supplierId: 'baraka', quantity: 10 },
  { productId: 'egg', supplierId: 'chorsu', quantity: 30 },
  { productId: 'pasta', supplierId: 'fayz', quantity: 10 }
];
export function cartSummary(cart) {
  const goods = cart.reduce((sum, item) => sum + byId(item.productId).prices[suppliers.findIndex(supplier => supplier.id === item.supplierId)] * item.quantity, 0);
  const benchmark = cart.reduce((sum, item) => sum + average(byId(item.productId)) * item.quantity, 0);
  return { goods, total: goods, benchmark, difference: benchmark - goods, count: cart.length, supplierCount: new Set(cart.map(item => item.supplierId)).size };
}
export function filteredProducts({ query = '', category = 'all', favorites, favoriteOnly = false, sort = 'default' }) {
  const normalized = query.trim().toLocaleLowerCase('ru');
  const result = products.filter(product => (category === 'all' || product.category === category) && (!favoriteOnly || favorites.has(product.id)) && matchesSearch(`${product.name} ${product.origin}`,normalized));
  if (sort === 'price') result.sort((a, b) => Math.min(...a.prices) - Math.min(...b.prices));
  if (sort === 'name') result.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  return result;
}
