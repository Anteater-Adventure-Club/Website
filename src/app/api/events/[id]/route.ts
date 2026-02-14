import { NextResponse } from "next/server";
import { deleteEvent, getEventById, updateEvent } from "@/lib/eventsDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, context: RouteContext) {
  const { id } = await context.params;
  const event = getEventById(id);

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  return NextResponse.json({ data: event });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const payload = body?.event;

  if (!payload || typeof payload !== "object") {
    return NextResponse.json(
      { error: "Invalid update payload" },
      { status: 400 },
    );
  }

  const eventPayload = payload as Partial<Omit<AACEvent, "id">>;
  const hasInvalidStatus =
    eventPayload.status !== undefined &&
    eventPayload.status !== "upcoming" &&
    eventPayload.status !== "past";

  if (hasInvalidStatus) {
    return NextResponse.json(
      { error: "Invalid status value" },
      { status: 400 },
    );
  }

  const updatedEvent = updateEvent(id, eventPayload);

  if (!updatedEvent) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  return NextResponse.json({ data: updatedEvent });
}

export async function DELETE(_: Request, context: RouteContext) {
  const { id } = await context.params;
  const deleted = deleteEvent(id);

  if (!deleted) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
