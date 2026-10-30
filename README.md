# Zomato Lite

A tiny restaurant-review app built to learn how a real product fits together:
two screens, two APIs, two database tables, one live URL.

- **Live:** https://zomato-lite-topaz-three.vercel.app
- Restaurant page: `/restaurant/1` — computed rating, latest review featured
- Write a review: `/review/1`

## The one big idea

**Store facts, compute answers.**

There is no `average_rating` column and no `latest_review` column. Ratings are
facts — "Priya gave 4 stars on 14 August" — and they are stored forever. The
average is computed fresh from `AVG(rating)` the moment somebody opens the
page. If the average were stored, every new review would need extra work and,
one forgetful day, the app would lie.

## The layers

| Layer | Files |
| --- | --- |
| Frontend (renders, never computes) | `app/page.tsx`, `app/restaurant/[id]/page.tsx`, `app/review/[restaurantId]/page.tsx` |
| Backend (validation, raw SQL, no ORM) | `app/api/reviews/route.ts`, `app/api/restaurants/[id]/route.ts` |
| Database (facts only) | `db/schema.sql`, `db/setup.mjs` → `npm run db:setup` |
| Config/secrets | `.env.local` (git-ignored — it is never committed) |
| Deployment | GitHub + Vercel (pushes from `main` go live automatically) |

Stack: Next.js 15 (App Router, TypeScript), Tailwind CSS, Neon Postgres via
`@neondatabase/serverless`, raw SQL only.
