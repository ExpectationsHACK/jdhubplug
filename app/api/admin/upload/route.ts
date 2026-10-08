import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { audit, can, getSession } from "@/lib/auth";
import { jsonError, sameOrigin } from "../products/_lib/http";

// Product photo upload to Vercel Blob. POST multipart/form-data with a "file" field.
// Returns { url } (public blob URL) or { error }.

const MAX_BYTES = 5 * 1024 * 1024;

const TYPES: Record<string, { ext: string; sniff: (b: Uint8Array) => boolean }> = {
  "image/jpeg": { ext: "jpg", sniff: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  "image/png": { ext: "png", sniff: (b) => [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((x, i) => b[i] === x) },
  "image/webp": { ext: "webp", sniff: (b) => ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WEBP" },
  "image/avif": { ext: "avif", sniff: (b) => ascii(b, 4, 8) === "ftyp" && ["avif", "avis", "mif1", "msf1"].includes(ascii(b, 8, 12)) },
};

const ascii = (b: Uint8Array, from: number, to: number) => String.fromCharCode(...b.slice(from, to));

const fail = (status: number, error: string) => jsonError(status, error);

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return fail(401, "Sign in again to upload photos.");
  if (!can(s.role, "products:write")) return fail(403, "Your role can't upload product photos.");
  if (!sameOrigin(req)) return fail(403, "Cross-site uploads aren't allowed.");

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return fail(501, "Photo uploads aren't set up. In Vercel, add a Blob store to this project (it sets BLOB_READ_WRITE_TOKEN) and redeploy.");
  }

  // Cheap early reject before reading the body (multipart adds a little overhead).
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_BYTES + 64 * 1024) return fail(413, "That image is over 5 MB.");

  let file: FormDataEntryValue | null;
  try {
    file = (await req.formData()).get("file");
  } catch {
    return fail(400, "Send the image as multipart/form-data in a field named “file”.");
  }
  if (!(file instanceof File)) return fail(400, "No file received.");
  if (!file.size) return fail(400, "That file is empty.");
  if (file.size > MAX_BYTES) return fail(413, "That image is over 5 MB.");

  const type = TYPES[file.type];
  if (!type) return fail(415, "Use a JPG, PNG, WebP or AVIF image.");
  // Check the file really is the image type it claims to be.
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (!type.sniff(head)) return fail(415, "That file isn't a valid image of the type it claims to be.");

  try {
    const blob = await put(`products/${crypto.randomUUID()}.${type.ext}`, file, {
      access: "public",
      contentType: file.type,
      cacheControlMaxAge: 60 * 60 * 24 * 365,
    });
    await audit(s, "product.image-upload", blob.pathname, `${file.name.slice(0, 80)} · ${Math.round(file.size / 1024)} KB`);
    return NextResponse.json({ url: blob.url }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[upload] blob put failed", e);
    return fail(502, "The image store didn't accept the upload. Try again in a moment.");
  }
}
