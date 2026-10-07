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

Live at [lawrence-crasto.vercel.app](https://lawrence-crasto.vercel.app).

The site deploys on [Vercel](https://vercel.com) through its GitHub integration. Every push to `main` goes to production. Every pull request gets its own preview URL. Vercel Authentication keeps previews private, and `robots.txt` disallows crawling there as a backup.

No environment variables are needed. Until `NEXT_PUBLIC_SITE_URL` is set, canonical URLs fall back to the Vercel production URL (see `src/lib/seo.ts`). Once a custom domain is bought, set `NEXT_PUBLIC_SITE_URL=https://<domain>` for Production in Vercel and redeploy.
