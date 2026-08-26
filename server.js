const path = require('node:path');
const express = require('express');
const compression = require('compression');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const { services, serviceMap } = require('./data/services');
const company = require('./data/company');

const app = express();
const port = Number(process.env.PORT) || 4173;
const siteUrl = (process.env.SITE_URL || `http://localhost:${port}`).replace(/\/$/, '');
const lastModified = '2026-08-26';
const requestLimit = Number.parseInt(process.env.REQUEST_RATE_LIMIT || '10', 10);
const requestWindowMs = Number.parseInt(process.env.REQUEST_RATE_WINDOW_MS || '900000', 10);
const trustProxyHops = Number.parseInt(process.env.TRUST_PROXY_HOPS || '0', 10);

if (!Number.isInteger(requestLimit) || requestLimit < 1 || requestLimit > 1000) {
  throw new Error('REQUEST_RATE_LIMIT must be an integer between 1 and 1000');
}
if (!Number.isInteger(requestWindowMs) || requestWindowMs < 1000 || requestWindowMs > 2147483647) {
  throw new Error('REQUEST_RATE_WINDOW_MS must be an integer between 1000 and 2147483647');
}
if (!Number.isInteger(trustProxyHops) || trustProxyHops < 0 || trustProxyHops > 10) {
  throw new Error('TRUST_PROXY_HOPS must be an integer between 0 and 10');
}
if (trustProxyHops > 0) app.set('trust proxy', trustProxyHops);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.disable('x-powered-by');

app.use(compression());
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "img-src": ["'self'", 'data:'],
      "script-src": ["'self'"],
      "style-src": ["'self'"],
      "font-src": ["'self'", 'data:'],
      "form-action": ["'self'"],
      "upgrade-insecure-requests": null
    }
  },
  crossOriginEmbedderPolicy: false
}));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: process.env.NODE_ENV === 'production' ? '7d' : 0 }));
app.use('/fonts', express.static(path.join(__dirname, 'node_modules/@fontsource/manrope/files'), { maxAge: '1y', immutable: true }));
app.use('/icons', express.static(path.join(__dirname, 'node_modules/bootstrap-icons/font'), { maxAge: '1y', immutable: true }));

app.use((req, res, next) => {
  res.locals.company = company;
  res.locals.services = services;
  res.locals.siteUrl = siteUrl;
  res.locals.currentPath = req.path.replace(/\/+$/, '') || '/';
  res.locals.year = new Date().getFullYear();
  res.locals.safeJsonLd = (value) => JSON.stringify(value).replace(/</g, '\\u003c');
  next();
});

const renderPage = (res, view, meta = {}, data = {}) => res.render(view, {
  meta: {
    title: meta.title || 'СпецТехОснастка — металлообработка в Минске',
    description: meta.description || 'Изготовление деталей, шестерён и технологической оснастки по чертежам и образцам в Минске.',
    canonical: meta.canonical || siteUrl,
    image: meta.image || `${siteUrl}/images/hero-gears.jpg`,
    imageAlt: meta.imageAlt || 'Шестерни и детали промышленных механизмов',
    preloadImage: meta.preloadImage || '',
    type: meta.type || 'website',
    noindex: Boolean(meta.noindex),
    breadcrumbs: meta.breadcrumbs || []
  },
  ...data
});

app.get('/', (req, res) => renderPage(res, 'index', {
  title: 'Металлообработка и изготовление деталей в Минске | СпецТехОснастка',
  description: 'ЧПУ-обработка, шестерни, зубчатые рейки, пресс-формы и электроэрозия. Изготовление деталей по чертежам и образцам в Минске.',
  canonical: `${siteUrl}/`,
  preloadImage: '/images/hero-gears.jpg'
}));

app.get('/services', (req, res) => renderPage(res, 'services', {
  title: 'Услуги металлообработки в Минске | СпецТехОснастка',
  description: 'Все услуги ЧПУП «СпецТехОснастка»: ЧПУ, зубчатые передачи и рейки, пресс-формы, электроэрозия, шлифовка и гибка.',
  canonical: `${siteUrl}/services/`,
  preloadImage: '/images/hero-gears.jpg',
  breadcrumbs: [{ name: 'Главная', url: `${siteUrl}/` }, { name: 'Услуги', url: `${siteUrl}/services/` }]
}));

app.get('/services/:slug', (req, res, next) => {
  const service = serviceMap.get(req.params.slug);
  if (!service) return next();
  return renderPage(res, 'service', {
    title: service.seoTitle,
    description: service.description,
    canonical: `${siteUrl}/services/${service.slug}/`,
    image: `${siteUrl}${service.image}`,
    imageAlt: service.imageAlt,
    preloadImage: service.image,
    breadcrumbs: [
      { name: 'Главная', url: `${siteUrl}/` },
      { name: 'Услуги', url: `${siteUrl}/services/` },
      { name: service.navTitle, url: `${siteUrl}/services/${service.slug}/` }
    ]
  }, { service, relatedServices: services.filter((item) => item.slug !== service.slug).slice(0, 3) });
});

app.get('/contacts', (req, res) => renderPage(res, 'contacts', {
  title: 'Контакты и заявка на расчёт | СпецТехОснастка, Минск',
  description: 'Контакты ЧПУП «СпецТехОснастка» в Минске. Пришлите чертёж или описание детали для расчёта стоимости и срока изготовления.',
  canonical: `${siteUrl}/contacts/`,
  breadcrumbs: [{ name: 'Главная', url: `${siteUrl}/` }, { name: 'Контакты', url: `${siteUrl}/contacts/` }]
}));

app.get('/privacy', (req, res) => renderPage(res, 'privacy', {
  title: 'Политика обработки персональных данных | СпецТехОснастка',
  description: 'Политика обработки персональных данных ЧПУП «СпецТехОснастка».',
  canonical: `${siteUrl}/privacy/`,
  noindex: true
}));

const requestLimiter = rateLimit({
  windowMs: requestWindowMs,
  limit: requestLimit,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { ok: false, message: 'Слишком много запросов. Повторите позже или свяжитесь с нами по телефону.' }
});

const controlCharacters = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const phonePattern = /^\+?[\d\s()-]{7,30}$/u;

function normalizeField(value, maxLength, required = true) {
  if (typeof value !== 'string') return null;
  const normalized = value.normalize('NFKC').replace(/\r\n?/g, '\n').trim();
  if (controlCharacters.test(normalized) || normalized.length > maxLength) return null;
  if (required && normalized.length === 0) return null;
  return normalized;
}

app.post(
  '/request',
  (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  },
  requestLimiter,
  express.urlencoded({ extended: false, limit: '32kb', parameterLimit: 10 }),
  express.json({ limit: '32kb', strict: true }),
  (req, res) => {
    if (!req.is(['application/json', 'application/x-www-form-urlencoded'])) {
      return res.status(415).json({ ok: false, message: 'Поддерживаются только JSON и данные HTML-формы.' });
    }
    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
    const name = normalizeField(body.name, 100);
    const contact = normalizeField(body.contact, 150);
    const message = normalizeField(body.message ?? '', 3000, false);
    const consent = body.consent === 'on' || body.consent === true || body.consent === 'true';
    if (!name || !contact || message === null || !consent) {
      return res.status(422).json({ ok: false, message: 'Заполните имя и контакт, затем подтвердите согласие.' });
    }
    if (!emailPattern.test(contact) && !phonePattern.test(contact)) {
      return res.status(422).json({ ok: false, message: 'Укажите корректный телефон или e-mail.' });
    }
    return res.status(200).json({
      ok: true,
      message: `Заявка подготовлена. Для отправки чертежа продублируйте его на ${company.email}.`
    });
  }
);

app.use((error, req, res, next) => {
  if (req.path !== '/request') return next(error);
  res.set('Cache-Control', 'no-store');
  if (error.type === 'entity.too.large' || error.type === 'parameters.too.many') {
    return res.status(413).json({ ok: false, message: 'Данные формы слишком велики.' });
  }
  if (error.type === 'entity.parse.failed' || error instanceof SyntaxError) {
    return res.status(400).json({ ok: false, message: 'Некорректный формат данных.' });
  }
  console.error('Ошибка обработки заявки:', error.message);
  return res.status(500).json({ ok: false, message: 'Не удалось обработать заявку. Свяжитесь с нами по телефону или e-mail.' });
});

app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(`User-agent: *\nAllow: /\nSitemap: ${siteUrl}/sitemap.xml\n`);
});

app.get('/sitemap.xml', (req, res) => {
  const pages = [
    { path: '/', priority: '1.0' },
    { path: '/services/', priority: '0.9' },
    { path: '/contacts/', priority: '0.8' },
    ...services.map((service) => ({ path: `/services/${service.slug}/`, priority: '0.8', image: service.image, imageTitle: service.shortTitle }))
  ];
  const rows = pages.map((page) => {
    const image = page.image ? `<image:image><image:loc>${siteUrl}${page.image}</image:loc><image:title>${page.imageTitle}</image:title></image:image>` : '';
    return `  <url><loc>${siteUrl}${page.path}</loc><lastmod>${lastModified}</lastmod><changefreq>${page.path === '/' ? 'weekly' : 'monthly'}</changefreq><priority>${page.priority}</priority>${image}</url>`;
  });
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${rows.join('\n')}\n</urlset>`);
});

app.use((req, res) => {
  res.status(404);
  return renderPage(res, '404', {
    title: 'Страница не найдена | СпецТехОснастка',
    description: 'Запрашиваемая страница не найдена.',
    canonical: `${siteUrl}${req.path}`,
    noindex: true
  });
});

if (require.main === module) {
  app.listen(port, '0.0.0.0', () => {
    console.log(`СпецТехОснастка: http://localhost:${port}`);
  });
}

module.exports = app;
