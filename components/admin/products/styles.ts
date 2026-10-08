// Class names for admin-products.css (global CSS, prefixed jdp-). Import `s` instead
// of hard-coding strings so a typo is a type error.

import "./admin-products.css";

export const s = {
  bar: "jdp-bar",
  bulkbar: "jdp-bulkbar",
  checkIn: "jdp-check-in",
  dialog: "jdp-dialog",
  dropActive: "jdp-drop-active",
  flash: "jdp-flash",
  pending: "jdp-pending",
  previewCard: "jdp-preview-card",
  previewPop: "jdp-preview-pop",
  qty: "jdp-qty",
  rise: "jdp-rise",
  skeleton: "jdp-skeleton",
  stage: "jdp-stage",
  toast: "jdp-toast",
  track: "jdp-track",
} as const;
