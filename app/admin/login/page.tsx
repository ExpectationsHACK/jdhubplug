import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { adminConfigured, usingDevPassword } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Admin sign in", robots: { index: false, follow: false } };

export default function LoginPage({ searchParams }: PageProps<"/admin/login">) {
  return (
    <div className="grid min-h-screen place-items-center bg-[#f6f7f9] px-4">
      <div className="w-full max-w-sm">
        <p className="display text-center text-[26px] font-extrabold uppercase tracking-[0.14em]">JDHub</p>
        <p className="mt-1 text-center text-[13px] font-bold text-accent">Admin</p>
        <div className="mt-8 rounded-2xl border border-line bg-white p-6">
          <Suspense fallback={<div className="h-56 animate-pulse rounded-xl bg-stage" />}>
            <LoginBody next={searchParams.then((s) => (typeof s.next === "string" ? s.next : ""))} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

// Checked at request time so adding ADMIN_PASSWORD takes effect without a rebuild.
async function LoginBody({ next }: { next: Promise<string> }) {
  await connection();
  if (!adminConfigured()) {
    return (
      <div className="text-[14px] text-ink-2">
        <p className="font-bold text-ink">The admin isn&apos;t set up yet.</p>
        <p className="mt-2">
          In Vercel, open your project → Settings → Environment Variables and add <code>ADMIN_PASSWORD</code> (and a long random{" "}
          <code>AUTH_SECRET</code>), then redeploy.
        </p>
      </div>
    );
  }
  return <LoginForm next={next} devHint={usingDevPassword()} />;
}
