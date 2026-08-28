const path = require('node:path');
const express = require('express');
const compression = require('compression');
const helmet = require('helmet');
const { services, serviceMap } = require('./data/services');
const company = require('./data/company');

const app = express();
const port = Number(process.env.PORT) || 4173;
const siteUrl = (process.env.SITE_URL || `http://localhost:${port}`).replace(/\/$/, '');
const lastModified = '2026-08-28';

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
      "form-action": ["'none'"],
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
  description: 'Все услуги ЧПУП «СпецТехОснастка»: ЧПУ, зубчатые передачи и рейки, пресс-формы, электроэрозия, шлифовка и полировка.',
  canonical: `${siteUrl}/services/`,
  preloadImage: '/images/hero-gears.jpg',
  breadcrumbs: [{ name: 'Главная', url: `${siteUrl}/` }, { name: 'Услуги', url: `${siteUrl}/services/` }]
}));

app.get('/services/grinding-bending', (req, res) => {
  res.redirect(301, '/services/grinding-polishing/');
});

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
  title: 'Контакты производства | СпецТехОснастка, Минск',
  description: 'Телефоны и контакты ЧПУП «СпецТехОснастка» в Минске. Позвоните Евгению, чтобы обсудить изготовление деталей.',
  canonical: `${siteUrl}/contacts/`,
  breadcrumbs: [{ name: 'Главная', url: `${siteUrl}/` }, { name: 'Контакты', url: `${siteUrl}/contacts/` }]
}));

app.get('/privacy', (req, res) => renderPage(res, 'privacy', {
  title: 'Политика обработки персональных данных | СпецТехОснастка',
  description: 'Политика обработки персональных данных ЧПУП «СпецТехОснастка».',
  canonical: `${siteUrl}/privacy/`,
  noindex: true
}));

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
