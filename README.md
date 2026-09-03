# СпецТехОснастка — сайт производственных услуг

Многостраничный сайт на Express, EJS, JavaScript и CSS. Контент и структура рассчитаны на B2B-заказы деталей по чертежам и образцам.

## Запуск

```bash
npm install
npm run dev
```

По умолчанию сайт доступен на `http://localhost:4173`. Порт можно изменить переменной `PORT`.

Для корректных canonical URL, Open Graph и sitemap на сервере задайте публичный адрес. Настройки берутся только из окружения; локальный `.env` исключён из Git:

```bash
SITE_URL=https://your-domain.by npm start
```

## GitHub Pages

Статическая версия публикуется из каталога `docs/`:

```bash
npm run build:pages
```

Публичный адрес: <https://razilkik-ops.github.io/detali/>

Для сборки под отдельный домен можно переопределить адрес, URL-префикс и каталог вывода:

```bash
STATIC_SITE_URL=https://your-domain.by \
STATIC_BASE_PATH=/ \
STATIC_OUTPUT_DIR=dist \
STATIC_APACHE=1 \
node scripts/build-pages.js
```

## Страницы

- Главная и каталог всех услуг.
- 8 SEO-посадочных: ЧПУ, шестерни, червячные передачи, пресс-формы и штампы, звёздочки и валы, зубчатые рейки, электроэрозия, шлифовка и полировка.
- Контакты и реквизиты.
- Политика обработки данных, 404, `robots.txt`, `sitemap.xml`.

## Заявки в Telegram

На всех основных страницах доступна форма заявки, при этом кнопки прямого звонка сохранены. Браузер отправляет данные в `hosting/api/submit.php`, а PHP-обработчик валидирует поля, ограничивает частоту запросов и передаёт заявку через Telegram Bot API.

Секреты запрещено размещать в `public/`, `docs/` или Git. На HostFly обработчик сначала читает переменные окружения `TELEGRAM_BOT_TOKEN` и `TELEGRAM_CHAT_ID`. Если окружение недоступно, он читает `/home/spetsteh/telegram.env` — обычный текстовый файл за пределами `public_html`. Образец находится в `hosting/telegram.env.example`; реальному файлу задайте права `600`.

Для production-сборки PHP-обработчик автоматически копируется в `api/`:

```bash
STATIC_SITE_URL=https://spetstehosnastka.by \
STATIC_BASE_PATH=/ \
STATIC_OUTPUT_DIR=dist \
STATIC_APACHE=1 \
node scripts/build-pages.js
```

## Проверки

```bash
npm run check
npm run build:pages
npm audit --omit=dev
```

`build:pages` автоматически проверяет title, description, canonical, H1, JSON-LD, внутренние ссылки, sitemap, типы публичных файлов и сигнатуры секретов. Те же проверки запускаются GitHub Actions на push и pull request; Dependabot еженедельно проверяет npm-зависимости.

## Где редактировать

- Услуги и SEO-тексты: `data/services.js`.
- Контакты и реквизиты: `data/company.js`.
- Шаблоны: `views/`.
- Стили: `public/css/styles.css`.
- Интерактивность: `public/js/app.js`.
