import puppeteer from "puppeteer";

export async function POST(req) {
  try {
    const { html, filename = "book" } = await req.json();

    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await page.setContent(html, {
      waitUntil: "load",
      timeout: 0,
    });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      timeout: 0,
      margin: { top: "40px", bottom: "60px", left: "40px", right: "40px" },
    });

    await browser.close();

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(
          filename
        )}.pdf`,
      },
    });
  } catch (e) {
    console.error("PDF export failed:", e);
    return new Response("Error generating PDF", { status: 500 });
  }
}
