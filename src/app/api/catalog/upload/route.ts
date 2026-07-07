import { NextResponse } from "next/server";
import { importHotels, importTransfers, importActivities } from "@/lib/importer";
import { apiUserWith } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 120;

// POST /api/catalog/upload  (multipart: kind, file)
// kind = "hotels" | "transfers" | "activities"
export async function POST(req: Request) {
  if (!(await apiUserWith("rates")))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data." }, { status: 400 });
  }

  const kind = String(form.get("kind") || "");
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  }
  if (!file.name.match(/\.(xlsx|xls)$/i)) {
    return NextResponse.json({ error: "Please upload an .xlsx / .xls file." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    let result: Record<string, number>;
    if (kind === "hotels") result = await importHotels(buffer);
    else if (kind === "transfers") result = await importTransfers(buffer);
    else if (kind === "activities") result = await importActivities(buffer);
    else return NextResponse.json({ error: "Unknown kind." }, { status: 400 });

    return NextResponse.json({ ok: true, kind, result });
  } catch (err) {
    console.error("Upload import failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to import the file." },
      { status: 422 },
    );
  }
}
