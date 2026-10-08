import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/Icon";

export const metadata: Metadata = { title: "Sign in" };

export default function AccountPage() {
  return (
    <section className="wrap grid min-h-[60vh] place-items-center py-16">
      <div className="w-full max-w-md text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-stage">
          <Icon name="user" size={30} />
        </span>
        <h1 className="display mt-6 text-[32px]">Sign in to JDHub</h1>
        <p className="mt-2 text-ink-2">Track orders, manage swaps and get Trade-Up offers.</p>
        <form className="mt-8 space-y-3 text-left">
          <label className="block text-[14px] font-bold" htmlFor="phone">
            Phone number
          </label>
          <input id="phone" type="tel" inputMode="tel" placeholder="0803 123 4567" className="field" />
          <button type="button" className="btn btn-primary btn-lg w-full">
            Send code
          </button>
        </form>
        <p className="mt-4 text-[13px] text-muted">We&apos;ll text you a one-time code. No password needed.</p>
        <p className="mt-8 text-[14px]">
          Selling as a business?{" "}
          <Link href="/vendors" className="font-bold underline underline-offset-4">
            Become a vendor
          </Link>
        </p>
      </div>
    </section>
  );
}
