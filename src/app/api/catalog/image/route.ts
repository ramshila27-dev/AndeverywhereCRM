import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { apiUserWith } from "@/lib/auth";

export const runtime = "nodejs";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

async function setImage(kind: string, id: string, imageUrl: string | null) {
  if (kind === "hotels") return prisma.hotel.update({ where: { id }, data: { imageUrl } });
  if (kind === "transfers") return prisma.transfer.update({ where: { id }, data: { imageUrl } });
  if (kind === "activities") return prisma.activity.update({ where: { id }, data: { imageUrl } });
  throw new Error("Unknown kind.");
}

// POST /api/catalog/image
//   multipart: kind, id, file   → upload a photo and set it
//   or JSON:   { kind, id, url } → set an image URL (or null to clear)
export async function POST(req: Request) {
  if (!(await apiUserWith("rates")))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const ctype = req.headers.get("content-type") || "";

  try {
    if (ctype.includes("multipart/form-data")) {
      const form = await req.formData();
      const kind = String(form.get("kind") || "");
      const id = String(form.get("id") || "");
      const file = form.get("file");
      if (!id || !(file instanceof File)) {
        return NextResponse.json({ error: "kind, id and file are required." }, { status: 400 });
      }
      if (!file.type.startsWith("image/")) {
        return NextResponse.json({ error: "Please upload an image file." }, { status: 400 });
      }
      await fs.mkdir(UPLOAD_DIR, { recursive: true });
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
      const fname = `${kind}-${id}-${crypto.randomBytes(4).toString("hex")}.${ext}`;
      await fs.writeFile(path.join(UPLOAD_DIR, fname), Buffer.from(await file.arrayBuffer()));
      const imageUrl = `/uploads/${fname}`;
      await setImage(kind, id, imageUrl);
      return NextResponse.json({ ok: true, imageUrl });
    }

    const body = (await req.json()) as { kind: string; id: string; url?: string | null };
    if (!body.kind || !body.id) {
      return NextResponse.json({ error: "kind and id are required." }, { status: 400 });
    }
    const imageUrl = body.url?.trim() ? body.url.trim() : null;
    await setImage(body.kind, body.id, imageUrl);
    return NextResponse.json({ ok: true, imageUrl });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update image." },
      { status: 422 },
    );
  }
}
