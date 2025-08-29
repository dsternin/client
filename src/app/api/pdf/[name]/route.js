import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

export async function GET(req, context) {
  const url = new URL(req.url);
  const isOld = url.searchParams.get("old") === "1";

  const params = await context.params; 
  const filename = params.name + (isOld ? ".old.pdf" : ".pdf");
  const filePath = path.join(process.cwd(), "storage", "pdfs", filename);

  try {
    const fileBuffer = await readFile(filePath);

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
