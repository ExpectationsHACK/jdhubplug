import { AdminPage } from "../ui";

// Loading placeholders for the order, customer and request screens.

const bar = "animate-pulse rounded-lg bg-line/70 motion-reduce:animate-none";

export function ListSkeleton({ stats = 0, rows = 8 }: { stats?: number; rows?: number }) {
  return (
    <AdminPage>
      <div role="status" aria-label="Loading">
        <div className={`${bar} h-8 w-44`} />
        <div className={`${bar} mt-2 h-4 w-64`} />
        {stats > 0 && (
          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: stats }).map((_, i) => (
              <div key={i} className="h-[104px] animate-pulse rounded-2xl border border-line bg-white motion-reduce:animate-none" />
            ))}
          </div>
        )}
        <div className="mt-6 flex gap-6 border-b border-line pb-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={`${bar} h-4 w-20`} />
          ))}
        </div>
        <div className={`${bar} mt-4 h-10 w-full max-w-md rounded-full`} />
        <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-white">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 border-b border-line px-4 py-4 last:border-0">
              <div className={`${bar} h-10 w-10 rounded-xl`} />
              <div className="flex-1 space-y-2">
                <div className={`${bar} h-3.5 w-1/3`} />
                <div className={`${bar} h-3 w-1/4`} />
              </div>
              <div className={`${bar} hidden h-5 w-20 rounded-full sm:block`} />
            </div>
          ))}
        </div>
        <span className="sr-only">Loading…</span>
      </div>
    </AdminPage>
  );
}

export function DetailSkeleton() {
  return (
    <AdminPage>
      <div role="status" aria-label="Loading">
        <div className={`${bar} h-4 w-24`} />
        <div className={`${bar} mt-3 h-8 w-56`} />
        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4">
            <div className="h-56 animate-pulse rounded-2xl border border-line bg-white motion-reduce:animate-none" />
            <div className="h-72 animate-pulse rounded-2xl border border-line bg-white motion-reduce:animate-none" />
          </div>
          <div className="space-y-4">
            <div className="h-48 animate-pulse rounded-2xl border border-line bg-white motion-reduce:animate-none" />
            <div className="h-40 animate-pulse rounded-2xl border border-line bg-white motion-reduce:animate-none" />
          </div>
        </div>
        <span className="sr-only">Loading…</span>
      </div>
    </AdminPage>
  );
}
