import { AdminPage } from "@/components/admin/ui";
import { s } from "./styles";

// Loading placeholders for the product and inventory screens.

function Bar({ className = "" }: { className?: string }) {
  return <div className={`${s.skeleton} rounded-lg ${className}`} />;
}

export function ListSkeleton({ title }: { title: string }) {
  return (
    <AdminPage>
      <div aria-busy="true" aria-label={`Loading ${title.toLowerCase()}`}>
        <h1 className="display text-[26px] md:text-[30px]">{title}</h1>
        <Bar className="mt-2 h-4 w-64" />
        <div className="mt-6 flex gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Bar key={i} className="h-9 w-24 rounded-full" />
          ))}
        </div>
        <Bar className="mt-4 h-[74px] w-full rounded-2xl" />
        <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-white">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 border-b border-line px-4 py-3 last:border-0">
              <Bar className="h-12 w-12 shrink-0 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Bar className="h-3.5 w-1/3" />
                <Bar className="h-3 w-1/4" />
              </div>
              <Bar className="hidden h-8 w-24 md:block" />
              <Bar className="hidden h-8 w-28 rounded-full md:block" />
            </div>
          ))}
        </div>
      </div>
    </AdminPage>
  );
}

export function FormSkeleton({ title }: { title: string }) {
  return (
    <AdminPage>
      <div aria-busy="true" aria-label="Loading product">
        <h1 className="display text-[26px] md:text-[30px]">{title}</h1>
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            {[220, 140, 120, 260].map((h, i) => (
              <div key={i} style={{ height: h }} className={`${s.skeleton} rounded-2xl`} />
            ))}
          </div>
          <div className="space-y-6">
            <div style={{ height: 160 }} className={`${s.skeleton} rounded-2xl`} />
            <div style={{ height: 460 }} className={`${s.skeleton} rounded-2xl`} />
          </div>
        </div>
      </div>
    </AdminPage>
  );
}
