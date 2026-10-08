import Link from "next/link";

export default function NotFound() {
  return (
    <section className="wrap grid min-h-[50vh] place-items-center py-20 text-center">
      <div>
        <p className="text-[14px] font-bold text-accent">404</p>
        <h1 className="display mt-2 text-[36px]">This page has been traded in.</h1>
        <p className="mt-3 text-ink-2">The page you&apos;re looking for isn&apos;t here any more.</p>
        <Link href="/" className="btn btn-primary mt-8">
          Back to home
        </Link>
      </div>
    </section>
  );
}
