import "server-only";
import { NextResponse } from "next/server";

const MAX_BODY = 32_000;

/** JSON del cuerpo, con límite de tamaño; null si no es válido. */
export async function readJson(request: Request): Promise<unknown> {
  const text = await request.text();
  if (text.length > MAX_BODY) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export const badRequest = (error: string) => NextResponse.json({ error }, { status: 400 });
export const noStore = { "Cache-Control": "no-store" };
