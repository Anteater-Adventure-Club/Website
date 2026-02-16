import { NextResponse } from "next/server";
import { deleteEvent, getEventById, updateEvent } from "@/lib/eventsDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, context: RouteContext) {
  const { id } = await context.params;
  const event = await getEventById(id);

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

  try {
    const updatedEvent = await updateEvent(id, eventPayload);

    if (!updatedEvent) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    return NextResponse.json({ data: updatedEvent });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to update event",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(_: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    const deleted = await deleteEvent(id);

    if (!deleted) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to delete event",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
