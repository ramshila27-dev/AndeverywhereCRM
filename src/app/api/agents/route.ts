import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import type { AgentInput } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/agents?search=xxx — autocomplete lookup by company name, agent
// name, or mobile number. Returns full records so selecting a suggestion can
// auto-fill the whole Agent Details block in one round trip.
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim() || "";

  if (!search) {
    const recent = await prisma.agent.findMany({
      orderBy: { updatedAt: "desc" },
      take: 10,
    });
    return NextResponse.json(recent);
  }

  const agents = await prisma.agent.findMany({
    where: {
      OR: [
        { companyName: { contains: search, mode: "insensitive" } },
        { agentName: { contains: search, mode: "insensitive" } },
        { mobile: { contains: search } },
        { email: { contains: search, mode: "insensitive" } },
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: 10,
  });
  return NextResponse.json(agents);
}

// POST /api/agents — create (or reuse) an agent. Mobile number is the dedupe
// key: saving with a mobile that already exists updates that same record
// instead of creating a duplicate, so re-entering a known agent's mobile
// always converges on one record.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: AgentInput;
  try {
    body = (await req.json()) as AgentInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.companyName?.trim() || !body.agentName?.trim() || !body.mobile?.trim()) {
    return NextResponse.json(
      { error: "Agent company name, agent name, and mobile number are required." },
      { status: 400 },
    );
  }

  const data = {
    companyName: body.companyName.trim(),
    agentName: body.agentName.trim(),
    mobile: body.mobile.trim(),
    email: body.email?.trim() || null,
    address: body.address?.trim() || null,
    city: body.city?.trim() || null,
    pincode: body.pincode?.trim() || null,
  };

  const agent = await prisma.agent.upsert({
    where: { mobile: data.mobile },
    update: data,
    create: data,
  });

  return NextResponse.json(agent, { status: 201 });
}
