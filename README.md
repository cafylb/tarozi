# Tarozi

## Помощник

Кнопка «Помощник» открывает чат на RU/EN/UZ. Поиск использует демонстрационный каталог Tarozi и сортирует предложения по стоимости товаров с доставкой. Карточка позволяет выбрать товар, поставщика и количество в интерфейсе, без оформления заказа.

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
