import { NextResponse } from "next/server";
import { authCookies, cookie, createOAuthState } from "../../../../../lib/github-auth";
import { runtimeEnv } from "../../../../../lib/runtime";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!runtimeEnv.GITHUB_CLIENT_ID || !runtimeEnv.GITHUB_CLIENT_SECRET || !runtimeEnv.AUTH_SESSION_SECRET) {
    return NextResponse.json({ error: "github-auth-not-configured" }, { status: 503 });
  }

  const { state, verifier, challenge } = await createOAuthState();
  const callbackUrl = new URL("/api/auth/github/callback", request.url).toString();
  const authorizeUrl = new URL("https://github.com/login/oauth/authorize");
  authorizeUrl.searchParams.set("client_id", runtimeEnv.GITHUB_CLIENT_ID);
  authorizeUrl.searchParams.set("redirect_uri", callbackUrl);
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("code_challenge", challenge);
  authorizeUrl.searchParams.set("code_challenge_method", "S256");

  const response = NextResponse.redirect(authorizeUrl);
  response.headers.append("Set-Cookie", cookie(authCookies.state, state, request, 600));
  response.headers.append("Set-Cookie", cookie(authCookies.verifier, verifier, request, 600));
  return response;
}
