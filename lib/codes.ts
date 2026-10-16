// Offer code normalisation. Isomorphic, so admin forms and the server agree.

export const normalizeCode = (code: string) =>
  code
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
