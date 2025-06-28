import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { Image } from "@/app/models/image";

export async function GET(request) {
  const id = request.nextUrl.pathname.split("/").pop();
  await dbConnect();

  const image = await Image.findById(id);

  if (!image) {
    return new NextResponse("Not Found", { status: 404 });
  }

  return new NextResponse(image.data, {
    status: 200,
    headers: {
      "Content-Type": image.contentType,
      "Content-Length": image.data.length.toString(),
      "Cache-Control": "public, max-age=31536000",
    },
  });
}
