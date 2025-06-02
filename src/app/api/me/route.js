import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";

export async function GET() {
  const token = (await cookies()).get("token")?.value;

  if (!token) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { userId, email, name } = decoded;

    return NextResponse.json({ user: { userId, email, name } });
  } catch (err) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
}
