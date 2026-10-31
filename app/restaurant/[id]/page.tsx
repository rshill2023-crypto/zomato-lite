"use client";

// Screen 2 — Restaurant page (/restaurant/[id]).
// This page calls GET /api/restaurants/[id] and prints what it was handed.
// NOTE, READ THIS LINE: the average below is <p>{data.averageRating}</p> —
// rendered as received. There is no add, no divide, no sort anywhere here.

import { useEffect, useState, use } from "react";
import Link from "next/link";
import Image from "next/image";

type Review = { id: number; rating: number; comment: string; createdAt: string };
type Data = {
  name: string;
  cuisine: string;
  area: string;
  averageRating: number | null;
  totalReviews: number;
  latestReview: Review | null;
  reviews: Review[];
};

function Stars({ value }: { value: number }) {
  return <span aria-hidden> {"★".repeat(value)}{"☆".repeat(5 - value)}</span>;
}

export default function RestaurantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<Data | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/restaurants/${id}`).then((r) => {
      if (r.status === 404) {
        setNotFound(true);
        return null;
      }
      return r.json();
    }).then((d) => d && setData(d)).catch(() => setNotFound(true));
  }, [id]);

  if (notFound) {
    return (
      <div className="mx-auto flex min-h-screen max-w-[560px] flex-col justify-center px-6">
        <h1 className="text-xl font-semibold">Restaurant not found</h1>
        <p className="mt-2 text-sm text-neutral-500">The address may be wrong.</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto flex min-h-screen max-w-[560px] flex-col justify-center px-6 text-sm text-neutral-500">
        Loading…
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-[560px] px-6 py-16">
      {/* --- header --- */}
      <h1 className="text-2xl font-semibold tracking-tight">{data.name}</h1>
      <p className="mt-1 text-sm text-neutral-500">
        {data.cuisine} · {data.area}
      </p>

      {/* --- the food, quietly --- */}
      <Image
        src="/burrito.jpg"
        alt="A Ludhiana-style burrito, sliced open, with lime"
        width={1000}
        height={562}
        priority
        className="mt-6 h-44 w-full rounded-xl object-cover"
      />

      {/* --- the average: received from the backend, printed as-is --- */}
      <div className="mt-10 flex items-baseline gap-3">
        <span className="text-7xl font-semibold tracking-tight">
          {data.averageRating === null ? "—" : data.averageRating}
        </span>
        <div className="text-sm text-neutral-500">
          <div>
            <Stars value={Math.round(data.averageRating ?? 0)} />
          </div>
          <div className="mt-0.5">
            {data.totalReviews === 0
              ? "No reviews yet"
              : `${data.totalReviews} review${data.totalReviews === 1 ? "" : "s"}`}
          </div>
        </div>
      </div>

      {/* --- latest review, set apart --- */}
      {data.latestReview && (
        <section className="mt-10 rounded-xl border border-amber-600/60 bg-amber-50/60 px-5 py-5">
          <p className="text-xs font-medium uppercase tracking-wide text-amber-700">
            Latest review
          </p>
          <p className="mt-2 text-lg">
            <Stars value={data.latestReview.rating} />
          </p>
          <p className="mt-1 leading-relaxed">{data.latestReview.comment}</p>
          <p className="mt-2 text-xs text-neutral-400">
            {new Date(data.latestReview.createdAt).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </p>
        </section>
      )}

      {/* --- older reviews, plain list --- */}
      {data.reviews.length > 0 && (
        <section className="mt-8">
          {data.reviews.map((r) => (
            <div key={r.id} className="border-b border-neutral-200 py-4">
              <p className="text-sm">
                <Stars value={r.rating} />
              </p>
              <p className="mt-1 text-sm text-neutral-700">{r.comment}</p>
              <p className="mt-1 text-xs text-neutral-400">
                {new Date(r.createdAt).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </p>
            </div>
          ))}
        </section>
      )}

      {/* --- empty state: invite the first review --- */}
      {data.totalReviews === 0 && (
        <p className="mt-10 rounded-xl border border-dashed border-neutral-300 px-5 py-8 text-center text-sm text-neutral-500">
          Nobody has reviewed {data.name} yet. Be the first.
        </p>
      )}

      <div className="mt-10">
        <Link
          href={`/review/${id}`}
          className="rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-700"
        >
          Write a review
        </Link>
      </div>
    </div>
  );
}
