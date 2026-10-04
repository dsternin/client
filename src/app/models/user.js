import mongoose from "mongoose";

export const UserSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  lastLoginAt: { type: Date, default: null },
  role: {
    type: String,
    enum: ["user", "admin"],
    default: "user",
  },
});
