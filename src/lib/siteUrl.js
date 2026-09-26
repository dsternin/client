import { headers } from "next/headers";

export function getConfiguredSiteUrl() {
  const configuredUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL;

  if (!configuredUrl) return null;

  return new URL(
    configuredUrl.startsWith("http") ? configuredUrl : `https://${configuredUrl}`
  );
}

export async function getSiteUrl() {
  const configuredUrl = getConfiguredSiteUrl();
  if (configuredUrl) return configuredUrl;

  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host")?.split(",")[0].trim() ||
    requestHeaders.get("host");
  if (!host) return null;

  const protocol =
    requestHeaders.get("x-forwarded-proto")?.split(",")[0].trim() ||
    (process.env.NODE_ENV === "development" ? "http" : "https");

  return new URL(`${protocol}://${host}`);
}