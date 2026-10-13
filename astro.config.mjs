// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  // The domain's primary host is www: canonical URLs, Open Graph and the sitemap must match it.
  site: 'https://www.piezasmenores.blog',
  integrations: [mdx(), sitemap()],
  // The site used to be a blog; its old URLs land on the home page.
  redirects: {
    '/blog': '/',
    '/blog/bienvenida-piezas-menores': '/',
    '/blog/el-fin-de-la-secuencia-forzada': '/',
    '/blog/la-partida-no-se-gana-en-la-apertura': '/',
    '/blog/pensar-en-variantes': '/',
    '/blog/zugzwang-cuando-no-mover-es-perder': '/',
    '/about': '/canal',
  },
});
