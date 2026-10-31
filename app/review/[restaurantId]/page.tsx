"use client";

// Screen 1 — Write a review (/review/[restaurantId]).
// The dining room never cooks: this file collects, it does not calculate or
// validate business rules. It sends three facts and steps back. If the
// backend rejects, it shows exactly what the backend said.

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

type Restaurant = { name: string };

export default function ReviewPage({ params }: { params: Promise<{ restaurantId: string }> }) {
  const { restaurantId } = use(params); // Next.js hands params as a promise; use() unwraps it
  const router = useRouter();

  const [name, setName] = useState<string | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`/api/restaurants/${restaurantId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setName(d ? d.name : null))
      .catch(() => setName(null));
  }, [restaurantId]);

  const canSubmit = rating !== null && comment.trim().length > 0 && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId: Number(restaurantId), rating, comment }),
      });
      if (res.ok) {
        router.push(`/restaurant/${restaurantId}`);
        return;
      }
      // Show what the backend said. Do not invent a message.
      const data = await res.json().catch(() => null);
      setError((data && data.error) || "Something went wrong.");
    } catch {
      setError("Could not reach the kitchen.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-[560px] flex-col px-6 py-16">
      <p className="text-sm text-neutral-500">Write a review</p>
      <div className="mt-1 flex items-center gap-3">
        <Image
          src="/burrito.jpg"
          alt=""
          width={56}
          height={56}
          priority
          className="h-9 w-9 rounded-lg object-cover"
        />
        <h1 className="text-xl font-semibold tracking-tight">
          {name ?? (name === null ? "…" : "Restaurant not found")}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="mt-10 flex flex-col gap-10">
        <div>
          <p className="text-sm font-medium">Your rating</p>
          <div className="mt-2 flex gap-1" role="radiogroup" aria-label="Rating">
            {[1, 2, 3, 4, 5].map((star) => {
              const active = (hovered ?? rating ?? 0) >= star;
              return (
                <button
                  key={star}
                  type="button"
                  role="radio"
                  aria-checked={rating === star}
                  aria-label={`${star} star${star > 1 ? "s" : ""}`}
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHovered(star)}
                  onMouseLeave={() => setHovered(null)}
                  disabled={submitting}
                  className={`h-10 w-10 rounded-lg border text-lg transition-colors ${
                    active
                      ? "border-amber-600 bg-amber-600 text-white"
                      : "border-neutral-300 bg-white text-neutral-400 hover:border-amber-600"
                  }`}
                >
                  ★
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label htmlFor="comment" className="text-sm font-medium">
            Your review
          </label>
          <textarea
            id="comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            disabled={submitting}
            rows={4}
            placeholder="What did you think?"
            className="mt-2 w-full resize-none rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none placeholder:text-neutral-400 focus:border-amber-600"
          />
        </div>

        {error && (
          <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          onClick={handleSubmit}
          className="rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-stone-300 disabled:hover:bg-stone-300"
        >
          {submitting ? "Sending…" : "Submit review"}
        </button>
      </form>
    </div>
  );
}
