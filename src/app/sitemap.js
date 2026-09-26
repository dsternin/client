import { getSiteUrl } from "@/lib/siteUrl";

export default async function sitemap() {
  const siteUrl = await getSiteUrl();
  if (!siteUrl) return [];

  return [
    {
      url: new URL("/reader?book=intro", siteUrl).toString(),
    },
  ];
}