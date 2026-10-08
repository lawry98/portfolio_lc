# Portfolio

Personal portfolio site for Lawrence Crasto, built with [Next.js](https://nextjs.org) (App Router), React, TypeScript, and Tailwind CSS.

## Getting Started

Install dependencies and run the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view it.

Other scripts:

```bash
npm run build   # production build
npm start       # serve the production build
npm run lint    # run ESLint
```

The app entry point is `src/app/page.tsx`; page sections live under `src/components/sections`.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to load [Inter](https://fonts.google.com/specimen/Inter).

## Deploy

Live at [lawrencecrasto.com](https://lawrencecrasto.com). `www.lawrencecrasto.com` and `lawrence-crasto.vercel.app` both redirect to it (308).

The site deploys on [Vercel](https://vercel.com) through its GitHub integration. Every push to `main` goes to production. Every pull request gets its own preview URL. Vercel Authentication keeps previews private, and `robots.txt` disallows crawling there as a backup.

Production has one environment variable: `NEXT_PUBLIC_SITE_URL=https://lawrencecrasto.com`. It sets the canonical URLs, the sitemap, and the domain line on the preview cards (see `src/lib/seo.ts`). It's read at build time, so redeploy after changing it. Without it, all of those fall back to the Vercel production URL.

DNS is managed at Spaceship, the registrar. An A record on the apex and a CNAME on `www` point to Vercel. The domain sends no email, and its SPF (`-all`) and DMARC (`p=reject`) records say so.
