import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma, QueryStatus, User } from "@prisma/client";
import { QUERY_TRANSITIONS, type QueryInput, type QueryStatusValue } from "@/lib/types";
import { getCurrentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";

export const runtime = "nodejs";

type Params = { params: { id: string } };

// An employee may only act on queries assigned to them (any one of possibly
// several assignees); admins on any.
function canAccess(user: User, assigneeIds: string[]): boolean {
  return isAdmin(user.roles) || assigneeIds.includes(user.id);
}

// GET /api/queries/:id — the query plus any linked quotes.
export async function GET(_req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const query = await prisma.query.findUnique({
    where: { id: params.id },
    include: {
      assignees: { select: { id: true, name: true } },
      quotes: {
        orderBy: { createdAt: "desc" },
        select: { id: true, title: true, status: true, total: true, currency: true },
      },
    },
  });
  if (!query) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!canAccess(user, query.assignees.map((a) => a.id)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json(query);
}

interface PatchBody extends Partial<QueryInput> {
  status?: QueryStatusValue;
  assigneeIds?: string[];
}

// PATCH /api/queries/:id — advance the lifecycle or edit a couple of fields.
export async function PATCH(req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const current = await prisma.query.findUnique({
    where: { id: params.id },
    include: { assignees: { select: { id: true } } },
  });
  if (!current) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!canAccess(user, current.assignees.map((a) => a.id)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const data: Prisma.QueryUpdateInput = {};

  if (body.status !== undefined) {
    const allowed = QUERY_TRANSITIONS[current.status as QueryStatusValue] ?? [];
    if (body.status !== current.status && !allowed.includes(body.status)) {
      return NextResponse.json(
        {
          error: `Cannot move from ${current.status} to ${body.status}.`,
          allowed,
        },
        { status: 409 },
      );
    }
    data.status = body.status as QueryStatus;
  }
  if (body.salesTeam !== undefined) data.salesTeam = body.salesTeam;
  if (body.comments !== undefined) data.comments = body.comments;
  // Only admins may (re)assign a query to one or more employees.
  if (body.assigneeIds !== undefined && isAdmin(user.roles)) {
    data.assignees = { set: body.assigneeIds.filter(Boolean).map((id) => ({ id })) };
  }

  // Full query edit (destination, dates, pax, guest details, agent, etc.) —
  // admin only, from the query edit page. A regular assignee can still
  // update status/comments above without hitting this branch.
  if (isAdmin(user.roles) && (body.guestName !== undefined || body.destinations !== undefined)) {
    let agentId: string | null = current.agentId;
    if (body.agent?.mobile?.trim() && body.agent?.companyName?.trim() && body.agent?.agentName?.trim()) {
      const agentData = {
        companyName: body.agent.companyName.trim(),
        agentName: body.agent.agentName.trim(),
        mobile: body.agent.mobile.trim(),
        email: body.agent.email?.trim() || null,
        address: body.agent.address?.trim() || null,
        city: body.agent.city?.trim() || null,
        pincode: body.agent.pincode?.trim() || null,
      };
      const savedAgent = await prisma.agent.upsert({
        where: { mobile: agentData.mobile },
        update: agentData,
        create: agentData,
      });
      agentId = savedAgent.id;
    }

    data.source = body.source?.trim() || null;
    data.referenceId = body.referenceId?.trim() || null;
    data.agentId = agentId;
    data.tags = Array.isArray(body.tags) ? body.tags : [];
    data.destinations = Array.isArray(body.destinations) ? body.destinations : [];
    data.startDate = body.startDate ? new Date(body.startDate) : null;
    data.nights = Math.max(1, Number(body.nights) || 1);
    data.adults = Math.max(1, Number(body.adults) || 1);
    data.childAges = Array.isArray(body.childAges) ? body.childAges.map((a) => Number(a) || 0) : [];
    data.infants = Math.max(0, Number(body.infants) || 0);
    data.totalFoc = Math.max(0, Number(body.totalFoc) || 0);
    data.salutation = body.salutation?.trim() || null;
    data.guestName = body.guestName?.trim() || "Guest";
    data.phones = (Array.isArray(body.phones) ? body.phones.filter((p) => p.number?.trim()) : []) as unknown as Prisma.InputJsonValue;
    data.email = body.email?.trim() || null;
    data.location = body.location?.trim() || null;
  }

  const updated = await prisma.query.update({ where: { id: params.id }, data });
  return NextResponse.json(updated);
}

// DELETE /api/queries/:id
export async function DELETE(_req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const current = await prisma.query.findUnique({
    where: { id: params.id },
    include: { assignees: { select: { id: true } } },
  });
  if (!current) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!canAccess(user, current.assignees.map((a) => a.id)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.query.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
