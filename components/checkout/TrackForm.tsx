"use client";

import { useActionState } from "react";
import { trackOrder, type TrackState } from "@/app/(store)/track/actions";
import { Icon } from "../Icon";
import { CommerceMotion } from "./Motion";

/** Order number + phone lookup. Opens the order page on a match. */
export function TrackForm() {
  const [state, action, pending] = useActionState<TrackState, FormData>(trackOrder, {});
  return (
    <form action={action} className="space-y-4 text-left" noValidate>
      <CommerceMotion />
      <div>
        <label htmlFor="track-id" className="mb-1.5 block text-[14px] font-bold">
          Order number
        </label>
        <input
          id="track-id"
          name="id"
          required
          defaultValue={state.id}
          placeholder="JDH-10234"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={20}
          className="field uppercase placeholder:normal-case"
          aria-describedby="track-id-hint"
        />
        <p id="track-id-hint" className="mt-1.5 text-[12px] text-muted">
          It&apos;s on your order page and in our WhatsApp messages.
        </p>
      </div>
      <div>
        <label htmlFor="track-phone" className="mb-1.5 block text-[14px] font-bold">
          Phone number
        </label>
        <input
          id="track-phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required
          defaultValue={state.phone}
          placeholder="0803 123 4567"
          maxLength={20}
          className="field"
        />
      </div>
      {state.error && (
        <p key={state.error + (state.id ?? "")} role="alert" className="jdc-shake flex items-start gap-2 rounded-xl bg-sale/10 p-3 text-[13px] font-bold text-sale">
          <Icon name="alert" size={18} className="shrink-0" /> {state.error}
        </p>
      )}
      <button disabled={pending} className="btn btn-primary btn-lg w-full">
        {pending ? "Finding your order…" : "Track order"}
      </button>
    </form>
  );
}
