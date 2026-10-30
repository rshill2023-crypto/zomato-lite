import { NextResponse } from "next/server";
import { getSql } from "@/lib/neon";

// GET /api/restaurants/[id] — load the restaurant page, fully computed.
// The average is ROUND(AVG(rating), 1) at read time. It is NOT stored.
// The response is shaped like the screen: name, big rating, latest review,
// then the older list. The frontend has nothing left to figure out.

type AggRow = { avg_rating: string | null; total: number };
type ReviewRow = { id: number; rating: number; comment: string; created_at: Date | string };

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: idRaw } = await params;
  const id = Number(idRaw);
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: "Restaurant id must be a number." }, { status: 404 });
  }

  const sql = getSql();

  // Does the restaurant exist? 404 if not.
  const restaurantRows = (await sql`
    SELECT id, name, cuisine, area
    FROM restaurants
    WHERE id = ${id}
  `) as unknown as { id: number; name: string; cuisine: string; area: string }[];
  if (restaurantRows.length === 0) {
    return NextResponse.json({ error: "Restaurant not found." }, { status: 404 });
  }
  const restaurant = restaurantRows[0];

  // FACTS in, ANSWERS out — three computed values, done by the database:
  const aggRows = (await sql`
    SELECT ROUND(AVG(rating)::numeric, 1) AS avg_rating, COUNT(*)::int AS total
    FROM reviews
    WHERE restaurant_id = ${id}
  `) as unknown as AggRow[];
  const aggregate = aggRows[0];

  const latestRows = (await sql`
    SELECT id, rating, comment, created_at
    FROM reviews
    WHERE restaurant_id = ${id}
    ORDER BY created_at DESC
    LIMIT 1
  `) as unknown as ReviewRow[];
  const latestRaw = latestRows.length > 0 ? latestRows[0] : null;

  const olderRows = latestRaw
    ? ((await sql`
        SELECT id, rating, comment, created_at
        FROM reviews
        WHERE restaurant_id = ${id} AND id <> ${latestRaw.id}
        ORDER BY created_at DESC
      `) as unknown as ReviewRow[])
    : [];

  const toReview = (r: ReviewRow) => ({
    id: r.id,
    rating: r.rating,
    comment: r.comment,
    createdAt: new Date(r.created_at).toISOString(),
  });

  // "What happens when there is nothing yet": averageRating and latestReview
  // are null, totalReviews is 0, reviews is []. COUNT/AVG/LIMIT all degrade to
  // exactly that, and the frontend's empty state reflects it.
  const body = {
    name: restaurant.name,
    cuisine: restaurant.cuisine,
    area: restaurant.area,
    averageRating: aggregate.avg_rating === null ? null : Number(aggregate.avg_rating),
    totalReviews: aggregate.total,
    latestReview: latestRaw ? toReview(latestRaw) : null,
    reviews: olderRows.map(toReview),
  };

  return NextResponse.json(body);
}
