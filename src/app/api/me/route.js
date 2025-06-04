import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import dbConnect from "@/lib/db";
import { UserSchema } from "@/app/models/user";
import mongoose from "mongoose";

const User = mongoose.models?.User || mongoose.model("User", UserSchema);

export async function GET() {
  const token = (await cookies()).get("token")?.value;

  if (!token) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { userId } = decoded;
    await dbConnect();
    const { name, email, role } = await User.findById(userId).select(
      "name email role"
    );
    return NextResponse.json({ user: { userId, email, name, role } });
  } catch (err) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
}
