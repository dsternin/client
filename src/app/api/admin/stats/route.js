import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { ExternalAccountClient } from "google-auth-library";
import { getVercelOidcToken } from "@vercel/oidc";
import { UserSchema } from "@/app/models/user";
import dbConnect from "@/lib/db";

const User = mongoose.models.User || mongoose.model("User", UserSchema);
const GA4_SCOPE = "https://www.googleapis.com/auth/analytics.readonly";

async function getActiveUsers(authClient, propertyId, startDate, endDate) {
  const { data } = await authClient.request({
    url: `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    method: "POST",
    data: {
      dateRanges: [{ startDate, endDate }],
      metrics: [{ name: "activeUsers" }],
    },
  });

  return Number(data.rows?.[0]?.metricValues?.[0]?.value || 0);
}

function getAnalyticsAuthClient() {
  const projectNumber = process.env.GCP_PROJECT_NUMBER;
  const poolId = process.env.GCP_WORKLOAD_IDENTITY_POOL_ID;
  const providerId = process.env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID;
  const serviceAccountEmail = process.env.GCP_SERVICE_ACCOUNT_EMAIL;

  if (!projectNumber || !poolId || !providerId || !serviceAccountEmail) {
    return null;
  }

  const providerAudience =
    `//iam.googleapis.com/projects/${projectNumber}/locations/global/` +
    `workloadIdentityPools/${poolId}/providers/${providerId}`;

  const authClient = ExternalAccountClient.fromJSON({
    type: "external_account",
    audience: providerAudience,
    subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
    token_url: "https://sts.googleapis.com/v1/token",
    service_account_impersonation_url:
      `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/` +
      `${serviceAccountEmail}:generateAccessToken`,
    subject_token_supplier: {
      getSubjectToken: () => getVercelOidcToken(),
    },
  });

  if (authClient) authClient.scopes = [GA4_SCOPE];
  return authClient;
}

export async function GET() {
  const token = (await cookies()).get("token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Не авторизовано" }, { status: 401 });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return NextResponse.json({ error: "Не авторизовано" }, { status: 401 });
  }

  try {
    await dbConnect();

    const admin = await User.findById(decoded.userId).select("role");
    if (!admin || admin.role !== "admin") {
      return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 });
    }

    const [registeredUsersCount, users] = await Promise.all([
      User.countDocuments({}),
      User.find({})
        .select("name email role lastLoginAt")
        .sort({ lastLoginAt: -1, name: 1 })
        .lean(),
    ]);

    const propertyId = process.env.GA4_PROPERTY_ID;
    const authClient = getAnalyticsAuthClient();
    let analytics = null;
    let analyticsStatus = "not_configured";

    if (propertyId && authClient) {
      try {
        const [today, week, month] = await Promise.all([
          getActiveUsers(authClient, propertyId, "today", "today"),
          getActiveUsers(authClient, propertyId, "7daysAgo", "yesterday"),
          getActiveUsers(authClient, propertyId, "30daysAgo", "yesterday"),
        ]);

        analytics = { today, week, month };
        analyticsStatus = "ok";
      } catch (error) {
        console.error("GA4 admin report request failed:", error.message);
        analyticsStatus = "unavailable";
      }
    }

    return NextResponse.json(
      { analytics, analyticsStatus, registeredUsersCount, users },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Admin stats request failed:", error.message);
    return NextResponse.json({ error: "Ошибка загрузки статистики" }, { status: 500 });
  }
}