import { NextResponse } from "next/server";
import { createEvent, listEvents } from "@/lib/eventsDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isValidEventPayload(payload: unknown): payload is Omit<AACEvent, "id"> {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const event = payload as Partial<Omit<AACEvent, "id">>;

  return (
    typeof event.name === "string" &&
    typeof event.date === "string" &&
    typeof event.description === "string" &&
    typeof event.imagePath === "string" &&
    (event.signUpLink === undefined || typeof event.signUpLink === "string") &&
    (event.type === undefined ||
      event.type === "regular" ||
      event.type === "potlock picnic" ||
      event.type === "weekly meeting") &&
    (event.status === undefined ||
      event.status === "upcoming" ||
      event.status === "past")
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status =
    searchParams.get("status") ??
    searchParams.get("category") ??
    undefined;

  const events = await listEvents(status);
  return NextResponse.json({ data: events });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const payload = body?.event;
  const status = body?.status ?? body?.category;

  if (!isValidEventPayload(payload)) {
    return NextResponse.json(
      { error: "Invalid event payload" },
      { status: 400 },
    );
  }

  try {
    const createdEvent = await createEvent({ ...payload, status });
    return NextResponse.json({ data: createdEvent }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to create event",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
