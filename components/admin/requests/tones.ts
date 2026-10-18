import type { LeadStatus } from "@/lib/types";
import type { Tone } from "../ui";

/** Badge colour per lead status / trade-in stage. */
export const STAGE_TONE: Record<LeadStatus, Tone> = {
  new: "amber",
  contacted: "blue",
  inspection_booked: "purple",
  inspected: "purple",
  offer_sent: "blue",
  accepted: "green",
  declined: "red",
  paid: "green",
  closed: "neutral",
  cancelled: "neutral",
};
