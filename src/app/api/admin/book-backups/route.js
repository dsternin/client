import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { UserSchema } from "@/app/models/user";
import dbConnect from "@/lib/db";
import { createBookBackup, listBookBackups, restoreBookBackup } from "@/lib/bookBackups";
import { progressResponse } from "@/lib/progressResponse";

export const runtime = "nodejs";

const User = mongoose.models.User || mongoose.model("User", UserSchema);

async function isAdmin() {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is not configured");
  const token = (await cookies()).get("token")?.value;
  if (!token) return false;
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return false;
  }
  if (typeof decoded?.userId !== "string" || !mongoose.isValidObjectId(decoded.userId)) return false;
  await dbConnect();
  const user = await User.findById(decoded.userId).select("role").lean();
  return user?.role === "admin";
}

export async function GET() {
  try {
    if (!(await isAdmin())) return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    return NextResponse.json({ backups: await listBookBackups() });
  } catch (error) {
    console.error("Failed to list book backups:", error);
    return NextResponse.json({ error: "Не удалось получить список бекапов" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    if (!(await isAdmin())) return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    const { book } = await request.json();
    if (typeof book !== "string" || !book.trim()) {
      return NextResponse.json({ error: "Книга не выбрана" }, { status: 400 });
    }
    return progressResponse(
      (progress) => createBookBackup(book, progress),
      "Не удалось создать бекап. Редактирование не открыто.",
    );
  } catch (error) {
    console.error("Failed to create book backup:", error);
    return NextResponse.json({ error: "Не удалось создать бекап. Редактирование не открыто." }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    if (!(await isAdmin())) return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    const { id } = await request.json();
    return progressResponse(
      (progress) => restoreBookBackup(id, progress),
      "Не удалось восстановить бекап. Проверьте журнал сервера.",
    );
  } catch (error) {
    console.error("Failed to restore book backup:", error);
    return NextResponse.json({ error: "Не удалось восстановить бекап. Проверьте журнал сервера." }, { status: 500 });
  }
}
