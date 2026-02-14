import { NextResponse } from "next/server";
import { seedPastFallbackIfEmpty } from "@/lib/eventsDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: Request): boolean {
  const configuredToken = process.env.EVENTS_SEED_TOKEN;

  if (!configuredToken) {
    return process.env.NODE_ENV !== "production";
  }

  return request.headers.get("x-seed-token") === configuredToken;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      {
        error:
          "Unauthorized. Set EVENTS_SEED_TOKEN and send it in x-seed-token header.",
      },
      { status: 401 },
    );
  }

  const result = seedPastFallbackIfEmpty();
  return NextResponse.json({ data: result });
}
