import { getProviders, getDefaults } from "@/lib/providers";

export const runtime = "nodejs";

export async function GET() {
  try {
    const providers = getProviders();
    const defaults = getDefaults();

    return Response.json({
      ok: true,
      providers: providers.map(p => ({
        name: p.name,
        label: p.label,
        type: p.type,
        base_url: p.base_url,
        api_key_prefix: p.api_key.slice(0, 10) + "...",
        models: p.models,
      })),
      defaults,
      env: {
        CUSTOM_PROVIDERS_JSON: process.env.CUSTOM_PROVIDERS_JSON ? "已设置" : "未设置",
        CUSTOM_PROVIDERS_PATH: process.env.CUSTOM_PROVIDERS_PATH ?? "未设置",
        DATABASE_URL: process.env.DATABASE_URL ? "已设置" : "未设置",
        JWT_SECRET: process.env.JWT_SECRET ? "已设置" : "未设置",
        NODE_ENV: process.env.NODE_ENV,
      },
    });
  } catch (error) {
    return Response.json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}
