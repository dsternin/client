import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

export async function POST(request) {
  const { email, password } = await request.json();
  console.log(process.env.JWT_SECRET);

  // TODO: валідація через базу
  // const isValid = email === "test@example.com" && password === "123456";

  // if (!isValid) {
  //   return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  // }

  const token = jwt.sign({ email }, process.env.JWT_SECRET, {
    expiresIn: "1d",
  });

  (await cookies()).set("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
  });

  return NextResponse.json({ message: "Login successful" });
}
