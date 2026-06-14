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
    const markdown =
      typeof report.content === "string"
        ? report.content
        : JSON.stringify(report.content);

    const browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });

    const page = await browser.newPage();

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
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
    console.error("[POST /api/report/generate-pdf]", err);

    // Update status to failed
    await db
      .update(reports)
      .set({ pdfStatus: "failed" })
      .where(eq(reports.id, reportId));

    return Response.json(
      { error: err instanceof Error ? err.message : "PDF generation failed" },
      { status: 500 }
    );
  }
}
