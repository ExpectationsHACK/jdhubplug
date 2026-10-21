import Link from "next/link";
import { Icon } from "../Icon";
import { TrackForm } from "./TrackForm";

/** Shared body of /track and /account: order lookup with a short reassurance column. */
export function TrackPanel({ title, body }: { title: string; body: string }) {
  return (
    <section className="wrap py-12 md:py-20">
      <div className="mx-auto grid max-w-5xl items-start gap-10 md:grid-cols-2 md:gap-16">
        <div className="jdc-in-up">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-stage">
            <Icon name="truck" size={30} strokeWidth={1.25} />
          </span>
          <h1 className="display mt-6 text-[32px] md:text-[44px]">{title}</h1>
          <p className="mt-3 text-[16px] text-ink-2">{body}</p>
          <ul className="mt-8 space-y-4 text-[14px] text-ink-2">
            {[
              { icon: "shield", t: "Escrow status", b: "See when your payment is held and when it's released." },
              { icon: "pin", t: "Delivery or pickup", b: "Follow your order from inspection to your door or hub." },
              { icon: "chat", t: "Real people on WhatsApp", b: "Questions? Message us with your order number." },
            ].map((x) => (
              <li key={x.t} className="flex gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-stage">
                  <Icon name={x.icon} size={20} />
                </span>
                <span>
                  <span className="block font-bold text-ink">{x.t}</span>
                  {x.b}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="jdc-in-up rounded-tile border border-line p-6 sm:p-8" style={{ animationDelay: "100ms" }}>
          <h2 className="text-[20px] font-bold">Find your order</h2>
          <p className="mb-6 mt-1 text-[14px] text-muted">Use the order number and phone number from checkout.</p>
          <TrackForm />
          <p className="mt-6 border-t border-line pt-5 text-center text-[14px]">
            Selling as a business?{" "}
            <Link href="/vendors" className="font-bold underline underline-offset-4">
              Become a vendor
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
