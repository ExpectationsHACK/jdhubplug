import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Icon } from "@/components/Icon";
import { getCurrentCustomer } from "@/lib/customer-auth";
import { signOutAction } from "../signin/actions";

export const metadata: Metadata = { title: "Your account", robots: { index: false } };

export default function AccountPage() {
  return (
    <section className="wrap grid min-h-[60vh] place-items-center py-16">
      <div className="w-full max-w-md text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-stage">
          <Icon name="user" size={30} />
        </span>
        <Suspense fallback={<div className="mx-auto mt-6 h-24 w-64 animate-pulse rounded-xl bg-stage" />}>
          <AccountBody />
        </Suspense>
      </div>
    </section>
  );
}

async function AccountBody() {
  await connection();
  const customer = await getCurrentCustomer();
  if (!customer) {
    return (
      <>
        <h1 className="display mt-6 text-[32px]">Your JDHub account</h1>
        <p className="mt-2 text-ink-2">Sign in with a one-time code to check out faster and keep track of your orders.</p>
        <Link href="/signin?next=/account" className="btn btn-primary btn-lg mt-8 w-full">
          Sign in or create an account
        </Link>
      </>
    );
  }
  return (
    <>
      <h1 className="display mt-6 text-[32px]">{customer.name ? `Hi, ${customer.name.split(" ")[0]}` : "Your account"}</h1>
      <p className="mt-2 text-ink-2">Signed in as {customer.phone ?? customer.email}</p>
      <div className="mt-8 grid gap-3">
        <Link href="/shop" className="btn btn-primary btn-lg">
          Continue shopping
        </Link>
        <form action={signOutAction}>
          <button className="btn btn-outline btn-lg w-full">Sign out</button>
        </form>
      </div>
      <p className="mt-6 text-[13px] text-muted">Order history and tracking are coming to this page shortly.</p>
    </>
  );
}
