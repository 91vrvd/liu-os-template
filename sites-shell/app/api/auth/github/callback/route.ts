import { NextResponse } from "next/server";
import { authCookies, clearCookie, cookie, createSessionToken, parseCookies } from "../../../../../lib/github-auth";
import { runtimeEnv } from "../../../../../lib/runtime";

export const dynamic = "force-dynamic";

const destination = (request: Request, status: string) => {
  const url = new URL("/desktop/", request.url);
  url.searchParams.set("admin", "1");
  url.searchParams.set("auth", status);
  return url;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookies = parseCookies(request);
  const expectedState = cookies.get(authCookies.state);
  const verifier = cookies.get(authCookies.verifier);

  if (!code || !state || !expectedState || state !== expectedState || !verifier) {
    return NextResponse.redirect(destination(request, "invalid-state"));
  }

  const clientId = runtimeEnv.GITHUB_CLIENT_ID;
  const clientSecret = runtimeEnv.GITHUB_CLIENT_SECRET;
  const allowedLogin = runtimeEnv.ADMIN_GITHUB_LOGIN;
  if (!clientId || !clientSecret || !allowedLogin || !runtimeEnv.AUTH_SESSION_SECRET) {
    return NextResponse.json({ error: "github-auth-not-configured" }, { status: 503 });
  }

  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: new URL("/api/auth/github/callback", request.url).toString(),
      code_verifier: verifier,
    }),
  });
  const tokenPayload = await tokenResponse.json() as { access_token?: string };
  if (!tokenResponse.ok || !tokenPayload.access_token) {
    return NextResponse.redirect(destination(request, "token-failed"));
  }

  const userResponse = await fetch("https://api.github.com/user", {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${tokenPayload.access_token}`,
      "User-Agent": "Liu-OS-Content-Admin",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  const user = await userResponse.json() as { login?: string; avatar_url?: string };

  await fetch(`https://api.github.com/applications/${encodeURIComponent(clientId)}/token`, {
    method: "DELETE",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      "Content-Type": "application/json",
      "User-Agent": "Liu-OS-Content-Admin",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({ access_token: tokenPayload.access_token }),
  }).catch(() => undefined);

  if (!userResponse.ok || !user.login || user.login.toLowerCase() !== allowedLogin.toLowerCase()) {
    return NextResponse.redirect(destination(request, "not-authorized"));
  }

  const sessionToken = await createSessionToken({
    login: user.login,
    avatarUrl: user.avatar_url,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
  });
  const response = NextResponse.redirect(destination(request, "success"));
  response.headers.append("Set-Cookie", cookie(authCookies.session, sessionToken, request, 7 * 24 * 60 * 60));
  response.headers.append("Set-Cookie", clearCookie(authCookies.state, request));
  response.headers.append("Set-Cookie", clearCookie(authCookies.verifier, request));
  return response;
}
