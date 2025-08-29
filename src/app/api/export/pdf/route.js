import { writeFile, mkdirSync, existsSync, unlinkSync, renameSync, rmSync } from "fs";
import { promisify } from "util";
import path from "path";
import puppeteer from "puppeteer";
import PDFMerger from "pdf-merger-js";

const writeFileAsync = promisify(writeFile);

function getSafeFilename(title) {
  const firstWord = title.trim().split(/\s+/)[0];
  return firstWord.replace(/[\/\\?%*:|"<>]/g, "_");
}

function extractHeadAndBody(html) {
  const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const head = headMatch ? headMatch[1] : "";
  const body = bodyMatch ? bodyMatch[1] : "";
  return { head, body };
}

function splitHTMLWithHead(html, maxLength = 200000) {
  const { head, body } = extractHeadAndBody(html);
  const chunks = [];
  let start = 0;
  while (start < body.length) {
    let end = start + maxLength;
    if (end > body.length) end = body.length;
    const bodyChunk = body.slice(start, end);
    const fullHtml = `<html><head>${head}</head><body>${bodyChunk}</body></html>`;
    chunks.push(fullHtml);
    start = end;
  }
  return chunks;
}

export async function POST(req) {
  const { html, filename = "book" } = await req.json();
  const safeFilename = getSafeFilename(filename);
  const pdfDir = path.join(process.cwd(), "storage", "pdfs");
  mkdirSync(pdfDir, { recursive: true });

  const finalPath = path.join(pdfDir, `${safeFilename}.pdf`);
  const backupPath = path.join(pdfDir, `${safeFilename}.old.pdf`);

  if (existsSync(backupPath)) unlinkSync(backupPath);
  if (existsSync(finalPath)) renameSync(finalPath, backupPath);

  const tempFolder = path.join(pdfDir, `${safeFilename}-${Date.now()}`);
  mkdirSync(tempFolder, { recursive: true });

  setTimeout(() => generatePDFParts(html, safeFilename, pdfDir, tempFolder), 0);

  return Response.json({ ok: true, url: `/api/pdf/${safeFilename}` });
}

async function generatePDFParts(html, safeFilename, pdfDir, tempFolder) {
  try {
    const parts = splitHTMLWithHead(html);
    const merger = new PDFMerger();

    const browser = await puppeteer.launch({
      headless: "old",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(0);

    for (let i = 0; i < parts.length; i++) {
      const partHtml = parts[i];
      const partPath = path.join(tempFolder, `part${i + 1}.pdf`);
      await page.setContent(partHtml, { waitUntil: "load" });
      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "40px", bottom: "60px", left: "40px", right: "40px" },
      });
      await writeFileAsync(partPath, pdfBuffer);
      await merger.add(partPath);
    }

    await browser.close();

    const finalPath = path.join(pdfDir, `${safeFilename}.pdf`);
    await merger.save(finalPath);

    rmSync(tempFolder, { recursive: true, force: true });

    console.log(`✅ PDF збережено: ${finalPath}`);
  } catch (e) {
    console.error("❌ Помилка при генерації PDF:", e);
  }
}
