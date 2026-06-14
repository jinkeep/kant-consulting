import { getDb } from "@/lib/db/client";
import { reports } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { chromium } from "playwright";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

export const runtime = "nodejs";
export const maxDuration = 60;

type GeneratePDFRequest = {
  reportId: string;
};

export async function POST(req: Request) {
  const { reportId } = (await req.json()) as GeneratePDFRequest;

  if (!reportId) {
    return Response.json({ error: "Missing reportId" }, { status: 400 });
  }

  const db = getDb();

  try {
    const [report] = await db
      .select()
      .from(reports)
      .where(eq(reports.id, reportId))
      .limit(1);

    if (!report) {
      return Response.json({ error: "Report not found" }, { status: 404 });
    }

    // Update status to generating
    await db
      .update(reports)
      .set({ pdfStatus: "generating" })
      .where(eq(reports.id, reportId));

    // Generate PDF
    const markdown = report.content;

    const browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-software-rasterizer",
        "--disable-extensions",
        "--disable-background-networking",
        "--disable-background-timer-throttling",
        "--disable-backgrounding-occluded-windows",
        "--disable-breakpad",
        "--disable-component-extensions-with-background-pages",
        "--disable-features=TranslateUI,BlinkGenPropertyTrees",
        "--disable-ipc-flooding-protection",
        "--disable-renderer-backgrounding",
        "--enable-features=NetworkService,NetworkServiceInProcess",
        "--force-color-profile=srgb",
        "--hide-scrollbars",
        "--metrics-recording-only",
        "--mute-audio",
        "--no-first-run",
      ],
    });

    const page = await browser.newPage();

    const host = req.headers.get("host") || "localhost:3000";
    const protocol = host.includes("localhost") ? "http" : "https";
    const baseUrl = `${protocol}://${host}`;
    const reportUrl = `${baseUrl}/report?__pdf=1&content=${encodeURIComponent(markdown)}`;

    await page.goto(reportUrl, { waitUntil: "domcontentloaded", timeout: 25000 });
    await page.waitForTimeout(3000);

    await page.addStyleTag({
      content: `
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&display=swap');
        body, * {
          font-family: 'Noto Sans SC', ui-sans-serif, system-ui, -apple-system, sans-serif !important;
        }
      `,
    });

    await page.evaluate(() => document.fonts.ready);
    await page.waitForSelector('[data-print="report"]', { timeout: 20000 });

    const pdfBuffer = await page.pdf({
      format: "A4",
      margin: { top: "1cm", right: "1.5cm", bottom: "1cm", left: "1.5cm" },
      printBackground: true,
    });

    await browser.close();

    // Save PDF to /tmp directory (Render persistent disk)
    const pdfDir = join(process.cwd(), "public", "pdfs");
    await mkdir(pdfDir, { recursive: true });

    const filename = `report-${reportId}.pdf`;
    const filepath = join(pdfDir, filename);
    await writeFile(filepath, pdfBuffer);

    const pdfUrl = `/pdfs/${filename}`;

    // Update report with PDF URL and completed status
    await db
      .update(reports)
      .set({
        pdfStatus: "completed",
        pdfUrl: pdfUrl
      })
      .where(eq(reports.id, reportId));

    return Response.json({
      success: true,
      pdfUrl,
      reportId
    });

  } catch (err) {
    console.error("[POST /api/report/generate-pdf] Error details:", {
      reportId,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      name: err instanceof Error ? err.name : undefined,
    });

    // Update status to failed
    await db
      .update(reports)
      .set({ pdfStatus: "failed" })
      .where(eq(reports.id, reportId));

    return Response.json(
      {
        error: err instanceof Error ? err.message : "PDF generation failed",
        details: err instanceof Error ? err.stack : undefined
      },
      { status: 500 }
    );
  }
}
