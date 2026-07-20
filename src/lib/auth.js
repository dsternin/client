import jwt from "jsonwebtoken";

export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 36;
export const SESSION_REFRESH_INTERVAL_MS = 60 * 60 * 1000;

export function createToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: SESSION_MAX_AGE_SECONDS,
  });
}

export function setAuthCookie(response, token) {
  response.cookies.set("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}