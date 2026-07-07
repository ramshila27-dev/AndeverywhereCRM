import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
};

// GET /api/uploads/<file> — serve a runtime-uploaded image from disk.
// (Files added to /public after build are not served by `next start`, so we
// stream them here instead.)
export async function GET(
  _req: Request,
  { params }: { params: { path: string[] } },
) {
  const rel = (params.path || []).join("/");
  const abs = path.join(UPLOAD_DIR, rel);
  // prevent path traversal
  if (!abs.startsWith(UPLOAD_DIR + path.sep)) {
    return new Response("Not found", { status: 404 });
  }
  try {
    const buf = await fs.readFile(abs);
    const ext = path.extname(abs).slice(1).toLowerCase();
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": MIME[ext] || "application/octet-stream",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
