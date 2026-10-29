import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { UserSchema } from "@/app/models/user";
import GrammarExclusions from "@/app/models/grammarExclusions";
import dbConnect from "@/lib/db";

const User = mongoose.models.User || mongoose.model("User", UserSchema);
const MAX_EXCLUSIONS = 1_000;
const MAX_PHRASE_LENGTH = 500;
const GLOBAL_EXCLUSIONS_ID = "global";

async function getAuthenticatedUserId() {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
  }

  const token = (await cookies()).get("token")?.value;
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return typeof decoded?.userId === "string" ? decoded.userId : null;
  } catch {
    return null;
  }
}

function normalizePhrases(phrases) {
  if (
    !Array.isArray(phrases) ||
    phrases.length > MAX_EXCLUSIONS ||
    phrases.some(
      (phrase) =>
        typeof phrase !== "string" ||
        phrase.trim().length === 0 ||
        phrase.length > MAX_PHRASE_LENGTH,
    )
  ) {
    return null;
  }

  const uniquePhrases = new Map();
  for (const phrase of phrases) {
    const trimmedPhrase = phrase.trim();
    const key = trimmedPhrase.toLocaleLowerCase("ru-RU");
    if (!uniquePhrases.has(key)) uniquePhrases.set(key, trimmedPhrase);
  }

  return Array.from(uniquePhrases.values());
}

async function getAdminId() {
  const userId = await getAuthenticatedUserId();
  if (!userId) return null;

  await dbConnect();
  const admin = await User.findById(userId).select("role").lean();
  return admin?.role === "admin" ? userId : null;
}

async function getOrCreateGlobalExclusions() {
  const existing = await GrammarExclusions.findById(GLOBAL_EXCLUSIONS_ID).lean();
  if (existing) return existing;

  const admins = await User.find({ role: "admin" })
    .select("ignoredGrammarPhrases")
    .lean();
  const legacyPhrases = normalizePhrases(
    admins.flatMap((admin) =>
      Array.isArray(admin.ignoredGrammarPhrases)
        ? admin.ignoredGrammarPhrases
        : [],
    ),
  ) || [];

  return GrammarExclusions.findOneAndUpdate(
    { _id: GLOBAL_EXCLUSIONS_ID },
    { $setOnInsert: { phrases: legacyPhrases } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();
}

export async function GET() {
  try {
    const adminId = await getAdminId();
    if (!adminId) {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const exclusions = await getOrCreateGlobalExclusions();

    return NextResponse.json({
      ignoredPhrases: Array.isArray(exclusions?.phrases)
        ? exclusions.phrases
        : [],
    });
  } catch (error) {
    console.error("Failed to load grammar exclusions:", error);
    return NextResponse.json({ error: "Не удалось загрузить исключения" }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const adminId = await getAdminId();
    if (!adminId) {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
    }

    const ignoredPhrases = normalizePhrases(body?.ignoredPhrases);
    if (!ignoredPhrases) {
      return NextResponse.json(
        { error: "Некорректный список исключений" },
        { status: 400 },
      );
    }

    const exclusions = await GrammarExclusions.findOneAndUpdate(
      { _id: GLOBAL_EXCLUSIONS_ID },
      { $set: { phrases: ignoredPhrases } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    ).lean();

    return NextResponse.json({ ignoredPhrases: exclusions.phrases || [] });
  } catch (error) {
    console.error("Failed to save grammar exclusions:", error);
    return NextResponse.json({ error: "Не удалось сохранить исключения" }, { status: 500 });
  }
}
