const fs = require('node:fs/promises');
const path = require('node:path');
const ejs = require('ejs');
const company = require('../data/company');
const { services } = require('../data/services');

const projectRoot = path.resolve(__dirname, '..');
const outputRoot = path.resolve(projectRoot, process.env.STATIC_OUTPUT_DIR || 'docs');
const viewsRoot = path.join(projectRoot, 'views');
const siteUrl = (process.env.STATIC_SITE_URL || 'https://razilkik-ops.github.io/detali').replace(/\/$/u, '');
const formAction = process.env.FORM_ACTION || 'https://spetstehosnastka.by/api/submit.php';
const configuredBasePath = process.env.STATIC_BASE_PATH ?? '/detali';
const basePath = configuredBasePath === '/' ? '' : `/${configuredBasePath.replace(/^\/+|\/+$/gu, '')}`;
const year = new Date().getFullYear();
const lastModified = '2026-09-03';
const safeJsonLd = (value) => JSON.stringify(value).replace(/</g, '\\u003c');

const metaDefaults = {
  title: 'СпецТехОснастка — металлообработка в Минске',
  description: 'Изготовление деталей, шестерён и технологической оснастки по чертежам и образцам в Минске.',
  canonical: `${siteUrl}/`,
  image: `${siteUrl}/images/hero-gears.jpg`,
  imageAlt: 'Шестерни и детали промышленных механизмов',
  preloadImage: '',
  type: 'website',
  noindex: false,
  redirectTarget: '',
  breadcrumbs: []
};

const pages = [
  {
    view: 'index.ejs',
    output: 'index.html',
    currentPath: '/',
    meta: {
      title: 'Металлообработка и изготовление деталей в Минске | СпецТехОснастка',
      description: 'ЧПУ-обработка, шестерни, зубчатые рейки, пресс-формы и электроэрозия. Изготовление деталей по чертежам и образцам в Минске.',
      canonical: `${siteUrl}/`,
      preloadImage: '/images/hero-gears.jpg'
    }
  },
  {
    view: 'services.ejs',
    output: 'services/index.html',
    currentPath: '/services',
    meta: {
      title: 'Услуги металлообработки в Минске | СпецТехОснастка',
      description: 'Все услуги ЧПУП «СпецТехОснастка»: ЧПУ, зубчатые передачи и рейки, пресс-формы, электроэрозия, шлифовка и полировка.',
      canonical: `${siteUrl}/services/`,
      preloadImage: '/images/hero-gears.jpg',
      breadcrumbs: [{ name: 'Главная', url: `${siteUrl}/` }, { name: 'Услуги', url: `${siteUrl}/services/` }]
    }
  },
  {
    view: 'contacts.ejs',
    output: 'contacts/index.html',
    currentPath: '/contacts',
    meta: {
      title: 'Контакты производства | СпецТехОснастка, Минск',
      description: 'Телефоны и контакты ЧПУП «СпецТехОснастка» в Минске. Позвоните Евгению, чтобы обсудить изготовление деталей.',
      canonical: `${siteUrl}/contacts/`,
      breadcrumbs: [{ name: 'Главная', url: `${siteUrl}/` }, { name: 'Контакты', url: `${siteUrl}/contacts/` }]
    }
  },
  {
    view: 'privacy.ejs',
    output: 'privacy/index.html',
    currentPath: '/privacy',
    meta: {
      title: 'Политика обработки персональных данных | СпецТехОснастка',
      description: 'Политика обработки персональных данных ЧПУП «СпецТехОснастка».',
      canonical: `${siteUrl}/privacy/`,
      noindex: true
    }
  },
  {
    view: '404.ejs',
    output: '404.html',
    currentPath: '/404',
    meta: {
      title: 'Страница не найдена | СпецТехОснастка',
      description: 'Запрашиваемая страница не найдена.',
      canonical: `${siteUrl}/404.html`,
      noindex: true
    }
  },
  {
    view: 'redirect.ejs',
    output: 'services/grinding-bending/index.html',
    currentPath: '/services/grinding-polishing',
    meta: {
      title: 'Шлифовка и полировка | СпецТехОснастка',
      description: 'Страница услуги перемещена на новый URL.',
      canonical: `${siteUrl}/services/grinding-polishing/`,
      redirectTarget: `${siteUrl}/services/grinding-polishing/`,
      noindex: true
    }
  },
  ...services.map((service) => ({
    view: 'service.ejs',
    output: `services/${service.slug}/index.html`,
    currentPath: `/services/${service.slug}`,
    service,
    relatedServices: services.filter((item) => item.slug !== service.slug).slice(0, 3),
    meta: {
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
    }
  }))
];

function prepareForPages(html) {
  const prepared = html
    .replace('<body>', '<body data-static-site="true">')
    .replace(/\b(href|src|action)="\/(?!\/)/g, `$1="${basePath}/`);
  return `${prepared.replace(/[ \t]+$/gm, '').trimEnd()}\n`;
}

async function renderPage(page) {
  const html = await ejs.renderFile(path.join(viewsRoot, page.view), {
    company,
    services,
    siteUrl,
    formAction,
    currentPath: page.currentPath,
    year,
    safeJsonLd,
    meta: { ...metaDefaults, ...page.meta },
    ...(page.service ? { service: page.service, relatedServices: page.relatedServices } : {})
  });
  const target = path.join(outputRoot, page.output);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, prepareForPages(html));
}

async function build() {
  await fs.rm(outputRoot, { recursive: true, force: true });
  await fs.mkdir(outputRoot, { recursive: true });
  await fs.cp(path.join(projectRoot, 'public'), outputRoot, { recursive: true });
  await fs.mkdir(path.join(outputRoot, 'fonts'), { recursive: true });
  for (const weight of [400, 500, 600, 700]) {
    const filename = `manrope-cyrillic-${weight}-normal.woff2`;
    await fs.copyFile(path.join(projectRoot, 'node_modules/@fontsource/manrope/files', filename), path.join(outputRoot, 'fonts', filename));
  }
  await fs.mkdir(path.join(outputRoot, 'icons/fonts'), { recursive: true });
  await fs.copyFile(path.join(projectRoot, 'node_modules/bootstrap-icons/font/bootstrap-icons.css'), path.join(outputRoot, 'icons/bootstrap-icons.css'));
  await fs.copyFile(path.join(projectRoot, 'node_modules/bootstrap-icons/font/fonts/bootstrap-icons.woff'), path.join(outputRoot, 'icons/fonts/bootstrap-icons.woff'));
  await fs.copyFile(path.join(projectRoot, 'node_modules/bootstrap-icons/font/fonts/bootstrap-icons.woff2'), path.join(outputRoot, 'icons/fonts/bootstrap-icons.woff2'));
  const stylesheetPath = path.join(outputRoot, 'css/styles.css');
  const stylesheet = await fs.readFile(stylesheetPath, 'utf8');
  await fs.writeFile(stylesheetPath, stylesheet.replaceAll("url('/fonts/", `url('${basePath}/fonts/`));
  await Promise.all(pages.map(renderPage));

  const indexedPages = [
    { path: '/', priority: '1.0' },
    { path: '/services/', priority: '0.9' },
    { path: '/contacts/', priority: '0.8' },
    ...services.map((service) => ({ path: `/services/${service.slug}/`, priority: '0.8', image: service.image, imageTitle: service.shortTitle }))
  ];
  const sitemapRows = indexedPages.map((page) => {
    const image = page.image ? `<image:image><image:loc>${siteUrl}${page.image}</image:loc><image:title>${page.imageTitle}</image:title></image:image>` : '';
    return `  <url><loc>${siteUrl}${page.path}</loc><lastmod>${lastModified}</lastmod><changefreq>${page.path === '/' ? 'weekly' : 'monthly'}</changefreq><priority>${page.priority}</priority>${image}</url>`;
  });
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${sitemapRows.join('\n')}\n</urlset>\n`;

  await fs.writeFile(path.join(outputRoot, 'sitemap.xml'), sitemap);
  await fs.writeFile(path.join(outputRoot, 'robots.txt'), `User-agent: *\nAllow: ${basePath || '/'}/\nSitemap: ${siteUrl}/sitemap.xml\n`.replace('Allow: //', 'Allow: /'));
  await fs.writeFile(path.join(outputRoot, '.nojekyll'), '');
  if (process.env.STATIC_APACHE === '1') {
    await fs.mkdir(path.join(outputRoot, 'api'), { recursive: true });
    await fs.copyFile(path.join(projectRoot, 'hosting/api/submit.php'), path.join(outputRoot, 'api/submit.php'));
    await fs.copyFile(path.join(projectRoot, 'hosting/.user.ini'), path.join(outputRoot, '.user.ini'));
    const canonicalHostPattern = new URL(siteUrl).hostname.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
    const apacheConfig = `Options -Indexes
DirectoryIndex index.html
ErrorDocument 404 /404.html

<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteCond %{HTTPS} !=on [OR]
  RewriteCond %{HTTP_HOST} !^${canonicalHostPattern}$ [NC]
  RewriteRule ^ ${siteUrl}%{REQUEST_URI} [R=301,L]
</IfModule>

<IfModule mod_headers.c>
  Header always set X-Content-Type-Options "nosniff"
  Header always set X-Frame-Options "SAMEORIGIN"
  Header always set Referrer-Policy "strict-origin-when-cross-origin"
  Header always set Permissions-Policy "camera=(), microphone=(), geolocation=()"
  Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"
  Header always set Content-Security-Policy "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; img-src 'self' data:; script-src 'self'; style-src 'self'; font-src 'self' data:; connect-src 'self' https://spetstehosnastka.by; form-action 'self' https://spetstehosnastka.by"
</IfModule>

<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresByType text/css "access plus 7 days"
  ExpiresByType application/javascript "access plus 7 days"
  ExpiresByType image/jpeg "access plus 30 days"
  ExpiresByType image/svg+xml "access plus 30 days"
  ExpiresByType font/woff2 "access plus 1 year"
</IfModule>
`;
    await fs.writeFile(path.join(outputRoot, '.htaccess'), apacheConfig);
  }
  console.log(`Static build: ${pages.length} HTML pages → ${outputRoot} (${siteUrl})`);
}

build().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
