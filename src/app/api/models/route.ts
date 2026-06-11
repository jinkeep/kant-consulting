import { NextResponse } from "next/server";
import { getDefaults, listPublicProviders } from "@/lib/providers";

export const runtime = "nodejs";

export async function GET() {
  const showPicker = process.env.NEXT_PUBLIC_SHOW_MODEL_PICKER === "1";
  if (!showPicker) {
    return NextResponse.json({ providers: [], defaults: getDefaults() });
  }
  return NextResponse.json({
    providers: listPublicProviders(),
    defaults: getDefaults(),
  });
}
