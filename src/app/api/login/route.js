import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { UserSchema } from "@/app/models/user";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import bcrypt from "bcrypt";
import { createToken, setAuthCookie } from "@/lib/auth";

const User = mongoose.models.User || mongoose.model("User", UserSchema);

export async function POST(req) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Введите email и пароль" },
        { status: 400 }
      );
    }

    await dbConnect();

    const user = await User.findOne({ email });
    if (!user) {
      return NextResponse.json(
        { error: "Пользователь не найден" },
        { status: 404 }
      );
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return NextResponse.json({ error: "Неверный пароль" }, { status: 401 });
    }

    const token = createToken(user._id);

    const response = NextResponse.json({ message: "Успешный вход" });
    setAuthCookie(response, token);

    return response;
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
