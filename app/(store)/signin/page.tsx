import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { getCurrentCustomer } from "@/lib/customer-auth";
import { customerSignInAvailable, otpChannels } from "@/lib/otp";
import { SignInForm } from "./SignInForm";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default function SignInPage({ searchParams }: PageProps<"/signin">) {
  return (
    <section className="wrap grid min-h-[70vh] place-items-center py-16">
      <div className="w-full max-w-md text-center">
        <h1 className="display text-[32px]">Sign in to JDHub</h1>
        <p className="mt-2 text-ink-2">Check out faster, track every order and keep your delivery details.</p>
        <div className="mt-8 rounded-tile border border-line bg-white p-6 sm:p-8">
          <Suspense fallback={<div className="h-48 animate-pulse rounded-xl bg-stage" />}>
            <SignInBody next={searchParams.then((s) => (typeof s.next === "string" ? s.next : "/account"))} />
          </Suspense>
        </div>
        <p className="mt-6 text-[12px] text-muted">
          By continuing you agree to JDHub&apos;s terms and privacy policy. Every order is escrow-protected.
        </p>
      </div>
    </section>
  );
}

async function SignInBody({ next }: { next: Promise<string> }) {
  await connection();
  const target = await next;
  if (await getCurrentCustomer()) redirect(target.startsWith("/") && !target.startsWith("//") ? target : "/account");
  if (!customerSignInAvailable()) {
    return <p className="text-[14px] text-ink-2">Sign-in is being set up. You can still contact us on WhatsApp to order.</p>;
  }
  return <SignInForm next={target} channels={otpChannels()} />;
}
