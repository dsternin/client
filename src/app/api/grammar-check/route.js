import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";

const MAX_TEXT_LENGTH = 20_000;
const LANGUAGE_TOOL_URL = "https://api.languagetool.org/v2/check";

export async function POST(request) {
  if (!process.env.JWT_SECRET) {
    console.error("JWT_SECRET is not configured");
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }

  const token = (await cookies()).get("token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  try {
    jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  if (typeof body?.text !== "string" || !body.text.trim()) {
    return NextResponse.json({ error: "Введите текст для проверки" }, { status: 400 });
  }
  if (body.text.length > MAX_TEXT_LENGTH) {
    return NextResponse.json(
      { error: "Текст не должен превышать 20 000 символов" },
      { status: 413 },
    );
  }

  const formData = new URLSearchParams({
    text: body.text,
    language: "ru-RU",
  });

  let response;
  try {
    response = await fetch(LANGUAGE_TOOL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData,
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    console.error("LanguageTool request failed:", error);
    return NextResponse.json(
      { error: "Сервис проверки грамматики временно недоступен" },
      { status: 502 },
    );
  }

  if (!response.ok) {
    console.error(`LanguageTool returned status ${response.status}`);
    return NextResponse.json(
      { error: "Сервис проверки грамматики временно недоступен" },
      { status: response.status === 429 ? 503 : 502 },
    );
  }

  let result;
  try {
    result = await response.json();
  } catch (error) {
    console.error("Invalid response from LanguageTool:", error);
    return NextResponse.json(
      { error: "Получен некорректный ответ от сервиса проверки" },
      { status: 502 },
    );
  }

  const matches = Array.isArray(result?.matches)
    ? result.matches.map((match) => ({
        message: match.message,
        offset: match.offset,
        length: match.length,
        context: match.context
          ? {
              text: match.context.text,
              offset: match.context.offset,
              length: match.context.length,
            }
          : undefined,
        replacements: Array.isArray(match.replacements)
          ? match.replacements
              .filter((replacement) => typeof replacement?.value === "string")
              .slice(0, 5)
              .map((replacement) => ({ value: replacement.value }))
          : [],
      }))
    : [];

  return NextResponse.json({ matches });
}
