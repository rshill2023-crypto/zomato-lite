import { NextResponse } from "next/server";
import { getSql } from "@/lib/neon";

// POST /api/reviews — save a review.
// Validation order is deliberate: cheap checks first, database lookup last.
// Nothing here trusts the frontend — see section 6 of the guide.

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const { restaurantId, rating, comment } = (body ?? {}) as {
    restaurantId?: unknown;
    rating?: unknown;
    comment?: unknown;
  };

  // 1. rating is an integer from 1 to 5
  if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Rating must be an integer from 1 to 5." }, { status: 400 });
  }

  // 2. comment is a non-empty string after trimming whitespace
  if (typeof comment !== "string" || comment.trim().length === 0) {
    return NextResponse.json({ error: "Comment cannot be empty." }, { status: 400 });
  }

  const sql = getSql();

  // 3. restaurantId refers to a restaurant that actually exists (a real lookup)
  const [restaurant] = await sql`SELECT id FROM restaurants WHERE id = ${restaurantId}`;
  if (!restaurant) {
    return NextResponse.json({ error: "That restaurant does not exist." }, { status: 400 });
  }

  // Success: write exactly one row of FACTS. Nothing derived is stored.
  const [inserted] = await sql`
    INSERT INTO reviews (restaurant_id, rating, comment)
    VALUES (${restaurantId}, ${rating}, ${comment.trim()})
    RETURNING id
  `;
  return NextResponse.json({ success: true, reviewId: inserted.id }, { status: 201 });
}
