import { writeFile, rename, unlink, existsSync, mkdirSync } from "fs";
import { promisify } from "util";
import path from "path";
import puppeteer from "puppeteer";

const writeFileAsync = promisify(writeFile);
const renameAsync = promisify(rename);
const unlinkAsync = promisify(unlink);

function getSafeFilename(title) {
  const firstWord = title.trim().split(/\s+/)[0];
  return firstWord.replace(/[\/\\?%*:|"<>]/g, "_");
}

export async function POST(req) {
  try {
    const { html, filename = "book" } = await req.json();
    const safeFilename = getSafeFilename(filename);

    const pdfDir = path.join(process.cwd(), "public", "pdfs");
    mkdirSync(pdfDir, { recursive: true });

    const finalPath = path.join(pdfDir, `${safeFilename}.pdf`);
    const backupPath = path.join(pdfDir, `${safeFilename}.old.pdf`);

    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load", timeout: 0 });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "40px", bottom: "60px", left: "40px", right: "40px" },
    });

    await browser.close();

    if (existsSync(backupPath)) {
      await unlinkAsync(backupPath);
    }
    if (existsSync(finalPath)) {
      await renameAsync(finalPath, backupPath);
    }

    await writeFileAsync(finalPath, pdfBuffer);

    return Response.json({ ok: true, url: `/pdfs/${safeFilename}.pdf` });
  } catch (e) {
    console.error("PDF export failed:", e);
    return new Response("Error generating PDF", { status: 500 });
  }
}
