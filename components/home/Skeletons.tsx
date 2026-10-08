// Shimmer placeholders that match the real layouts, so nothing jumps when data lands.

export function CardSkeleton() {
  return (
    <div className="rounded-tile bg-stage p-5" aria-hidden>
      <div className="skeleton h-5 w-16 rounded-full" />
      <div className="skeleton my-3 aspect-square w-full" />
      <div className="mx-auto mt-4 h-4 w-3/5 skeleton" />
      <div className="mx-auto mt-2 h-3 w-4/5 skeleton" />
      <div className="mx-auto mt-4 h-5 w-2/5 skeleton" />
      <div className="mt-4 h-10 w-full skeleton rounded-full" />
    </div>
  );
}

export function ShopSkeleton() {
  return (
    <div role="status" aria-label="Loading products">
      <section className="wrap pb-10 pt-6">
        <div className="skeleton h-4 w-40" />
        <div className="flex flex-col items-center pt-10">
          <div className="skeleton h-4 w-24" />
          <div className="skeleton mt-3 h-10 w-72 max-w-full md:h-12 md:w-[28rem]" />
          <div className="skeleton mt-4 h-4 w-80 max-w-full" />
          <div className="mt-10 flex gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton aspect-square w-[clamp(104px,24vw,168px)] rounded-2xl" />
            ))}
          </div>
        </div>
      </section>
      <div className="wrap grid gap-8 lg:grid-cols-[260px_1fr]">
        <div className="hidden space-y-4 lg:block">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton h-6 w-full" />
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}

export function ProductSkeleton() {
  return (
    <div role="status" aria-label="Loading product">
      <div className="wrap pt-6">
        <div className="skeleton h-4 w-56" />
      </div>
      <section className="wrap grid gap-10 pt-8 md:grid-cols-[1.2fr_1fr] lg:gap-16">
        <div className="skeleton aspect-square w-full rounded-tile" />
        <div>
          <div className="skeleton h-4 w-20" />
          <div className="skeleton mt-3 h-9 w-4/5" />
          <div className="skeleton mt-3 h-4 w-32" />
          <div className="skeleton mt-6 h-28 w-full rounded-tile" />
          <div className="skeleton mt-6 h-10 w-1/2" />
          <div className="skeleton mt-6 h-12 w-full rounded-full" />
          <div className="skeleton mt-3 h-12 w-full rounded-full" />
        </div>
      </section>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
