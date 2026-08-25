const path = require('node:path');
const express = require('express');
const compression = require('compression');
const helmet = require('helmet');
const { services, serviceMap } = require('./data/services');

const app = express();
const port = Number(process.env.PORT) || 4173;
const siteUrl = (process.env.SITE_URL || `http://localhost:${port}`).replace(/\/$/, '');

const company = {
  name: 'СпецТехОснастка',
  legalName: 'ЧПУП «СпецТехОснастка»',
  tagline: 'Точное производство деталей',
  phone: '8 017 294 02 12',
  phoneHref: '+375172940212',
  mobile: '8 044 784 41 93',
  mobileHref: '+375447844193',
  email: 'Rogachov89@mail.ru',
  address: 'г. Минск, ул. Зм. Бядули, д. 13, корп. 4, пом. 214',
  postalCode: '220034',
  unp: '192327800',
  bankAccount: 'BY76MTBK30120001077500107696',
  bank: 'ЗАО «МТБанк»',
  bic: 'MTBKBY22'
};

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
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: process.env.NODE_ENV === 'production' ? '7d' : 0 }));
app.use('/fonts', express.static(path.join(__dirname, 'node_modules/@fontsource/manrope/files'), { maxAge: '1y', immutable: true }));
app.use('/icons', express.static(path.join(__dirname, 'node_modules/bootstrap-icons/font'), { maxAge: '1y', immutable: true }));

app.use((req, res, next) => {
  res.locals.company = company;
  res.locals.services = services;
  res.locals.siteUrl = siteUrl;
  res.locals.currentPath = req.path;
  res.locals.year = new Date().getFullYear();
  next();
});

const renderPage = (res, view, meta = {}, data = {}) => res.render(view, {
  meta: {
    title: meta.title || 'СпецТехОснастка — металлообработка в Минске',
    description: meta.description || 'Изготовление деталей, шестерён и технологической оснастки по чертежам и образцам в Минске.',
    canonical: meta.canonical || siteUrl,
    image: meta.image || `${siteUrl}/images/hero-gears.jpg`,
    type: meta.type || 'website',
    noindex: Boolean(meta.noindex)
  },
  ...data
});

app.get('/', (req, res) => renderPage(res, 'index', {
  title: 'Металлообработка и изготовление деталей в Минске | СпецТехОснастка',
  description: 'ЧПУ-обработка, шестерни, пресс-формы, резка и электроэрозия. Изготовление деталей по чертежам и образцам в Минске.',
  canonical: `${siteUrl}/`
}));

app.get('/services', (req, res) => renderPage(res, 'services', {
  title: 'Услуги металлообработки в Минске | СпецТехОснастка',
  description: 'Все услуги ЧПУП «СпецТехОснастка»: ЧПУ, зубчатые передачи, пресс-формы, раскрой, электроэрозия, шлифовка и гибка.',
  canonical: `${siteUrl}/services`
}));

app.get('/services/:slug', (req, res, next) => {
  const service = serviceMap.get(req.params.slug);
  if (!service) return next();
  return renderPage(res, 'service', {
    title: `${service.title} в Минске | СпецТехОснастка`,
    description: service.description,
    canonical: `${siteUrl}/services/${service.slug}`,
    image: `${siteUrl}${service.image}`,
    type: 'article'
  }, { service });
});

app.get('/contacts', (req, res) => renderPage(res, 'contacts', {
  title: 'Контакты и заявка на расчёт | СпецТехОснастка, Минск',
  description: 'Контакты ЧПУП «СпецТехОснастка» в Минске. Пришлите чертёж или описание детали для расчёта стоимости и срока изготовления.',
  canonical: `${siteUrl}/contacts`
}));

app.get('/privacy', (req, res) => renderPage(res, 'privacy', {
  title: 'Политика обработки персональных данных | СпецТехОснастка',
  description: 'Политика обработки персональных данных ЧПУП «СпецТехОснастка».',
  canonical: `${siteUrl}/privacy`,
  noindex: true
}));

app.post('/request', (req, res) => {
  const name = String(req.body.name || '').trim();
  const contact = String(req.body.contact || '').trim();
  const message = String(req.body.message || '').trim();
  const consent = req.body.consent === 'on' || req.body.consent === true || req.body.consent === 'true';
  if (!name || !contact || !consent) {
    return res.status(422).json({ ok: false, message: 'Заполните имя и контакт, затем подтвердите согласие.' });
  }
  if (name.length > 100 || contact.length > 150 || message.length > 3000) {
    return res.status(422).json({ ok: false, message: 'Проверьте длину заполненных полей.' });
  }
  return res.status(200).json({
    ok: true,
    message: 'Заявка подготовлена. Для отправки чертежа продублируйте его на Rogachov89@mail.ru.'
  });
});

app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /privacy\nSitemap: ${siteUrl}/sitemap.xml\n`);
});

app.get('/sitemap.xml', (req, res) => {
  const urls = ['/', '/services', '/contacts', ...services.map((service) => `/services/${service.slug}`)];
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((url) => `  <url><loc>${siteUrl}${url}</loc><changefreq>${url === '/' ? 'weekly' : 'monthly'}</changefreq><priority>${url === '/' ? '1.0' : '0.8'}</priority></url>`).join('\n')}\n</urlset>`);
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

app.listen(port, '0.0.0.0', () => {
  console.log(`СпецТехОснастка: http://localhost:${port}`);
});
