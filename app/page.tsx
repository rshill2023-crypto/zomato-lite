export default function Home() {
  return (
    <div className="grid min-h-screen items-center justify-items-center p-8">
      <main className="text-center">
        <p className="text-2xl font-semibold tracking-tight">Zomato Lite</p>
        <p className="mt-2 text-sm text-neutral-500">The app is alive.</p>
        <a
          href="/restaurant/1"
          className="mt-6 inline-block rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-700"
        >
          Open Ludhiana Burrito →
        </a>
      </main>
    </div>
  );
}
