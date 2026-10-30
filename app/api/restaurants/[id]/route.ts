import { NextResponse } from "next/server";
import { getSql } from "@/lib/neon";

// GET /api/restaurants/[id] — load the restaurant page, fully computed.
// The average is ROUND(AVG(rating), 1) at read time. It is NOT stored.
// The response is shaped like the screen: name, big rating, latest review,
// then the older list. The frontend has nothing left to figure out.

type ReviewRow = { id: number; rating: number; comment: string; created_at: string };
type SqlRow = { id: number; name: string; cuisine: string; area: string };

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: idRaw } = await params;
  const id = Number(idRaw);
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: "Restaurant id must be a number." }, { status: 404 });
  }

  const sql = getSql();

  // Does the restaurant exist? 404 if not.
  const [restaurant] = await sql`SELECT id, name, cuisine, area FROM restaurants WHERE id = ${id}`;
  if (!restaurant) {
    return NextResponse.json({ error: "Restaurant not found." }, { status: 404 });
  }

  // FACTS in, ANSWERS out — three computed values, done by the database:
  const [aggregate] = await sql<{ avg_rating: string | null; total: number }>`
    SELECT ROUND(AVG(rating)::numeric, 1) AS avg_rating, COUNT(*)::int AS total
    FROM reviews
    WHERE restaurant_id = ${id}
  `;

  const [latestRaw] = await sql<ReviewRow>`
    SELECT id, rating, comment, created_at
    FROM reviews
    WHERE restaurant_id = ${id}
    ORDER BY created_at DESC
    LIMIT 1
  `;

  const olderRaw = await sql<ReviewRow>`
    SELECT id, rating, comment, created_at
    FROM reviews
    WHERE restaurant_id = ${id}
      ${latestRaw ? sql`AND id <> ${latestRaw.id}` : sql``}
    ORDER BY created_at DESC
  `;

  const toReview = (r: ReviewRow) => ({
    id: r.id,
    rating: r.rating,
    comment: r.comment,
    createdAt: new Date(r.created_at).toISOString(),
  });

  // "What happens when there is nothing yet": averageRating and latestReview
  // are null, totalReviews is 0, reviews is []. AVG/COUNT/LIMIT 1 all degrade
  // to null/0/null naturally, and the empty state below reflects that.
  const body = {
    name: restaurant.name,
    cuisine: restaurant.cuisine,
    area: restaurant.area,
    averageRating: aggregate.avg_rating === null ? null : Number(aggregate.avg_rating),
    totalReviews: aggregate.total,
    latestReview: latestRaw ? toReview(latestRaw) : null,
    reviews: olderRaw.map(toReview),
  };

  return NextResponse.json(body);
}

export type { SqlRow };
