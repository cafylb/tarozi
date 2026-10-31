// Illustrative prices and supplier identities, not live market information.
export const suppliers = [
  { id: 'baraka', name: 'Baraka Savdo', market: 'Куйлюк', initials: 'BS' },
  { id: 'chorsu', name: 'Chorsu Opt', market: 'Чорсу', initials: 'CO' },
  { id: 'fayz', name: 'Fayz Trade', market: 'Фархадский', initials: 'FT' }
];

export const products = [
  { id: 'sugar', name: 'Сахар-песок', short: 'Сахар', category: 'grocery', origin: 'Белый, кристаллический', unit: 'кг', pack: 'Мешок 50 кг', quantity: 50, min: 25, stock: 1400, prices: [9800, 10100, 10400], history: [10500, 10400, 10600, 10300, 10200, 10000, 9800], month: [11200, 11100, 11300, 10900, 10800, 11000, 10600, 10800, 10500, 10400, 10600, 10300, 10200, 10000, 9800] },
  { id: 'rice', name: 'Рис «Лазер»', short: 'Рис', category: 'grocery', origin: 'Хорезм, первый сорт', unit: 'кг', pack: 'Мешок 25 кг', quantity: 25, min: 5, stock: 600, prices: [15200, 14500, 14900], history: [14200, 14400, 14300, 14600, 14700, 14600, 14500], month: [13800, 13700, 13900, 14100, 14000, 14200, 14400, 14300, 14200, 14400, 14300, 14600, 14700, 14600, 14500] },
  { id: 'oil', name: 'Масло подсолнечное', short: 'Масло', category: 'oil', origin: 'Рафинированное, 1 л', unit: 'л', pack: 'Коробка 12 × 1 л', quantity: 12, min: 6, stock: 480, prices: [17800, 18500, 18100], history: [18900, 18600, 18700, 18400, 18200, 18000, 17800], month: [19500, 19400, 19600, 19200, 19300, 19100, 19000, 18900, 18900, 18600, 18700, 18400, 18200, 18000, 17800] },
  { id: 'flour', name: 'Мука пшеничная', short: 'Мука', category: 'grocery', origin: 'Высший сорт', unit: 'кг', pack: 'Мешок 25 кг', quantity: 25, min: 25, stock: 1200, prices: [7200, 7100, 6900], history: [7100, 7100, 7000, 7200, 7000, 7000, 6900], month: [7500, 7600, 7400, 7300, 7500, 7200, 7300, 7200, 7100, 7100, 7000, 7200, 7000, 7000, 6900] },
  { id: 'onion', name: 'Лук репчатый', short: 'Лук', category: 'vegetables', origin: 'Урожай 2026, местный', unit: 'кг', pack: 'Сетка 20 кг', quantity: 20, min: 20, stock: 2000, prices: [3200, 2800, 3000], history: [3200, 3400, 3100, 3000, 2900, 3000, 2800], month: [3600, 3500, 3700, 3400, 3500, 3300, 3400, 3200, 3200, 3400, 3100, 3000, 2900, 3000, 2800] },
  { id: 'potato', name: 'Картофель', short: 'Картофель', category: 'vegetables', origin: 'Самарканд, отборный', unit: 'кг', pack: 'Сетка 20 кг', quantity: 20, min: 20, stock: 1600, prices: [4500, 4400, 4200], history: [3900, 4000, 4100, 4000, 4300, 4100, 4200], month: [3800, 3900, 3700, 3900, 4000, 3800, 4000, 3900, 3900, 4000, 4100, 4000, 4300, 4100, 4200] }
];

export const categories = [{ id: 'all', name: 'Все товары' }, { id: 'grocery', name: 'Бакалея' }, { id: 'vegetables', name: 'Овощи' }, { id: 'oil', name: 'Масла' }];
export const money = value => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(value);
export function matchesSearch(text,query){
 const words=value=>String(value).normalize('NFKC').toLocaleLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
 const haystack=words(text);return words(query).every(token=>haystack.some(word=>word.startsWith(token)));
}
export const byId = id => products.find(product => product.id === id);
export const supplierById = id => suppliers.find(supplier => supplier.id === id);
export const offersFor = (product, market = 'all') => suppliers.map((supplier, index) => ({ ...supplier, price: product.prices[index], stock: product.stock - index * 100 })).filter(offer => market === 'all' || offer.id === market).sort((a, b) => a.price - b.price);
export const average = product => Math.round(product.prices.reduce((sum, price) => sum + price, 0) / product.prices.length);
export const change = product => Math.min(...product.prices) - product.history[0];
export const initialCart = () => [
  { productId: 'sugar', supplierId: 'baraka', quantity: 50 },
  { productId: 'rice', supplierId: 'chorsu', quantity: 25 },
  { productId: 'oil', supplierId: 'baraka', quantity: 12 }
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
