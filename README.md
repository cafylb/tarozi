# Tarozi

## Помощник

Раздел Chat в header открывает отдельную страницу помощника на RU/EN/UZ. Переписка сохраняется при переходах между разделами; плавающей кнопки и модального окна нет. Поиск использует демонстрационный каталог Tarozi и сортирует предложения по стоимости товаров с доставкой. Карточка позволяет выбрать товар, поставщика и количество в интерфейсе, без оформления заказа.

Для свободных ИИ-ответов указать `GEMINI_API_KEY` в `.env.local`. Модель по умолчанию — `gemini-3.5-flash-lite`, её можно задать через `GEMINI_MODEL`. Использовать ключ проекта Free Tier, если цель — бесплатное демо: подписки ChatGPT Plus и Google AI Pro не являются API-биллингом. Ключ остаётся на сервере. Приложение не включает биллинг и не переключается на платный провайдер при ошибках.

Без ключа и при ошибках провайдера работает явно обозначенный поиск по каталогу. При ответе Gemini 402 повторные запросы к модели прекращаются до смены ключа или перезапуска сервера. Перезапуск сам по себе не исправляет биллинг. Лимиты endpoint: 12 запросов в минуту с IP, не более 3 параллельных генераций. Переписка не записывается сервером; провайдер получает последние сообщения и демо-каталог, без автоматической передачи профиля аккаунта. Условия обработки запросов определяются тарифом Gemini.

Проверки помощника: `node --test scripts/assistant.test.mjs`. Полная генерация живой моделью зависит от доступности квоты проекта; успешная проверка mocked API не означает успешного живого запроса.

## Установка и компоненты

Требуется Node.js 22+. Первый запуск: `npm ci`, `npm run build`, `npm start`. Проверки: `npm run check` и `npx tsc --noEmit`.

`components/ui/nav-header.tsx` — адаптация предоставленного header на React/TypeScript и Framer Motion. `components/ui/chart.tsx` — адаптация графиков Recharts. Общие стили и токены находятся в `prototypes/style-lab/styles.css`. В компонентах использован обычный CSS проекта вместо классов Tailwind; shadcn и Tailwind для этой реализации не нужны.

Палитра: чёрный, белый, синий и яркий бирюзовый. Светлая и тёмная темы сохраняются.

Скопировать `.env.example` в `.env.local` и задать собственные Google client ID/secret. Для другого домена настроить `APP_URL` и разрешённый redirect URI в Google Cloud. Локальная база, секреты и исследовательские материалы исключены из Git. Сервер предназначен для локального демо; сессии сбрасываются после перезапуска.

Выбран Studio, логотип сохранён. Светлая/тёмная тема и ru/en/uz.

Запуск: `npm start`, адрес http://localhost:4173. Сборка: `npm run build`.

Аккаунты перенесены по подходу Adamant Solar: email/пароль, scrypt, серверная HttpOnly-сессия, Google OAuth, редактирование профиля и выход. Tarozi использует отдельное локальное хранилище `.local/accounts.json`; данные Adamant Solar не изменяются. Сессии живут в памяти процесса и сбрасываются при перезапуске.

Google client ID и secret загружаются сервером из `.env.local` (не включается в Git и HTML). Адрес возврата: `http://localhost:4173/api/auth/google/callback`. Он должен быть разрешён в настройках этого клиента Google. Полный вход реальным аккаунтом не проверялся. До изменения брендинга OAuth-клиента окно согласия может показывать название исходного приложения.

Для аккаунтов требуется локальный сервер. Открытие HTML как файла поддерживает демо закупок, но не серверную авторизацию.

Проверены сборка и локальные API: регистрация, пароль, сессия, редактирование профиля, выход, вход, повторный email, защита Origin, отказ поддельному callback. Браузер автоматически не открывался.

## Grocery intelligence backend

The separate [backend](backend/README.md) adds a Fastify/TypeScript API, Supabase/PostgreSQL schema, seller approval, dated offers/history, Restock Advisor, private saved lists, alerts and moderation. See [API integration](backend/docs/API.md) for connecting the frontend. Its Supabase bearer sessions are separate from the existing local demo account cookies. No existing accounts or secrets are migrated automatically.

Run its offline checks with `cd backend && npm ci && npm run check`. A configured Supabase project or local Supabase stack is needed to run the persistent API; cloud hosting is not provisioned by the source code alone.
Иконки интерфейса: Phosphor (SVG и `@phosphor-icons/react`), включая робота помощника. Полоса товаров использует отдельные переключатели с выбранным товаром; видимая полоса прокрутки страницы скрыта, прокрутка доступна.

## Market research and seller demo

Guests see a buyer/seller selector. By request, **Continue with Google now opens a demo session in the selected role immediately**, without contacting Google or verifying identity. Its color logo is bundled from Google's public branding assets. Email registration and server OAuth routes remain separate. Demo users never receive authenticated server-seller access.

The Market page adds monthly averages, daily changes, store-price comparisons, multi-store histories and individual store charts. Sample prices, availability and history are illustrative (October 2026), not live quotes. History averages use sample stores offering the selected product. Registered sellers' prices appear separately, with actual price history starting at publication.

Stores uses Leaflet/OpenStreetMap tiles (network required; attribution retained). Twenty-four real sample locations, including: [Abay](https://uz.near-place.com/korzinkauz-13-abay-kochasi-toskent), [Alay](https://orgcatalog.com/en/orgs/korzinka-alay/), [TTZ](https://orgcatalog.com/en/orgs/korzinka-ttz/), [Bogishamol](https://narxbozor.uz/oz/orgs/korzinka-bogishamol/). These are examples, not registered partners. The Tarozi filter lists sellers; a marker appears after a seller saves their map location.

Seller workspace supports adding/editing name, catalog product, price and stock. Zero stock removes public availability. Searches and explicit offer opens drive 30-day demand/view charts, starting at zero. Market benchmarks are labeled demo. Google-button demo sessions store inventory, store and measured events in this browser, including on GitHub Pages. Email-authenticated accounts use server-side roles and ownership checks with private `.local/accounts.json` and `.local/market-events.json`. This does not alter or integrate the separate Supabase backend.

Checks: `node --test scripts/commerce.test.mjs scripts/assistant.test.mjs` covers roles, ownership, stock, price history, analytics counts, Origin, restart persistence and assistant regression. Map rendering and live OAuth have not been browser-tested.

Additional Korzinka sample locations: [Boz Bozor](https://orgcatalog.com/en/orgs/korzinka-boz-bozor/), [TTZ-2](https://orgcatalog.com/en/orgs/korzinka-ttz-2/), [Habib Abdullayev](https://orgcatalog.com/en/orgs/korzinka-mahalla-habib-abdullayev/), [Riyoziy](https://orgcatalog.com/en/orgs/korzinka-rivoziy/). Their prices and availability are illustrative. Product search matches word prefixes, so «рис» excludes «кристаллический»; results focus the matching product and hide the unrelated basket preview. Monthly averages use the actual number of sample offers, rather than a fixed store count.

Price-alert product names now open a dedicated statistics screen with a return link; the alert threshold and tracking state remain intact. The market basket-preview block has been removed. More sample map locations: [Sampi Mall](https://orgcatalog.com/en/orgs/korzinka-sampi-mall/), [Asaka](https://orgcatalog.com/en/orgs/korzinka-mahalla-asaka/), [Hamid Olimjon](https://narxbozor.uz/orgs/smart-mustaqillik/), [Elbek](https://narxbozor.uz/orgs/korzinka-go-elbek/), [Salom](https://orgcatalog.com/orgs/korzinka-salom/), [Amore Mio](https://commons.wikimedia.org/wiki/File:Korzinka_Amore_Mio_supermarketi.jpg), [Yunusabad](https://uz.geoview.info/korzinka,11455129821n); the Kuyluk source link is stored with its map record. Sample prices and availability remain illustrative.

Chart styling now varies line, area and bar presentations for existing price series; store comparisons use horizontal bars. No extra analytics categories were added. Sample store histories have independent deterministic trends, promotion dips and local variation; these remain demo prices. The repeated supplier-count caption under the main chart is removed. The store map now includes 24 sample locations, adding [Karasu-2](https://orgcatalog.com/en/orgs/korzinka-karasu-2/), [Mashhadiy](https://orgcatalog.com/en/orgs/korzinka-mashhadiy/), [Oltintepa](https://orgcatalog.com/en/orgs/korzinka-oltintepa/), [Beruniy](https://mapcarta.com/W685675146), [Sergeli](https://uz.geoview.info/korzinka,6393717370n), [Airport](https://mapcarta.com/N1807867306), [Family Market](https://orgcatalog.com/en/orgs/family-market-yalangach/) and [Olma](https://narxbozor.uz/orgs/olma-yalangach/).

Store-offer charts now share one area-chart style while retaining their individual values. Offers remain sorted by unit price; the first, lowest-priced offer has a turquoise highlight and localized Best price badge. Removed the market greeting/date/location, price-spread block, history demo/date caption and global text footer at the user’s request. Per-offer demo labels remain.

Product comparison excludes delivery: offer ranking, assistant totals and saved-list totals use product cost only. Delivery UI and the demo order-submission control are removed; the service searches and compares products. Checks assert no delivery field in returned assistant offers.
