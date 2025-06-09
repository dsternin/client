import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { Image } from "@/app/models/image";



export async function POST(req) {
  const formData = await req.formData();
  const file = formData.get("file");

  if (!file) {
    return NextResponse.json({ error: "Файл не передан" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  await dbConnect();

  const image = await Image.create({
    data: buffer,
    contentType: file.type || "image/jpeg",
  });

  return NextResponse.json({ url: `/api/content/image/${image._id}` });
}
