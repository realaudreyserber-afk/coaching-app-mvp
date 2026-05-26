/**
 * Shared auth helper for session routes.
 * Pulls Bearer token from Authorization header, verifies via Firebase Admin,
 * and supports dev-bypass tokens (mock-token, ENABLE_MOCK_AUTH).
 */
import { NextRequest } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";

export type AuthOk = { ok: true; uid: string };
export type AuthErr = { ok: false; status: number; error: string };

export async function authenticateRequest(
  req: NextRequest,
): Promise<AuthOk | AuthErr> {
  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return { ok: false, status: 401, error: "Missing Bearer token" };
  }
  const idToken = authHeader.slice(7);

  const isMockEnabled =
    process.env.ENABLE_MOCK_AUTH === "1" ||
    process.env.NODE_ENV !== "production";

  if (
    isMockEnabled &&
    (idToken === "mock-token" ||
      idToken === "mock-token-non-admin" ||
      idToken === "mock-token-no-profile")
  ) {
    const uid =
      idToken === "mock-token-non-admin"
        ? "non-admin-user-id"
        : idToken === "mock-token-no-profile"
          ? "no-profile-user-id"
          : "dev-user-id";
    return { ok: true, uid };
  }

  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    return { ok: true, uid: decoded.uid };
  } catch (err) {
    console.error("[sessions/auth] token verify failed:", err);
    return { ok: false, status: 401, error: "Invalid token" };
  }
}
