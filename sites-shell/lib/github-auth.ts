import { runtimeEnv } from "./runtime";

const SESSION_COOKIE = "liu_os_admin_session";
const STATE_COOKIE = "liu_os_github_state";
const VERIFIER_COOKIE = "liu_os_github_verifier";
const encoder = new TextEncoder();

export interface AdminSession {
  login: string;
  avatarUrl?: string;
  exp: number;
}

const bytesToBase64Url = (bytes: Uint8Array) => {
  let value = "";
  bytes.forEach((byte) => { value += String.fromCharCode(byte); });
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const stringToBase64Url = (value: string) => bytesToBase64Url(encoder.encode(value));

const base64UrlToString = (value: string) => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const decoded = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
  return new TextDecoder().decode(Uint8Array.from(decoded, (character) => character.charCodeAt(0)));
};

const randomToken = (length = 32) => {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
};

const hmac = async (value: string) => {
  const secret = runtimeEnv.AUTH_SESSION_SECRET;
  if (!secret) throw new Error("AUTH_SESSION_SECRET is not configured");
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return bytesToBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value))));
};

const safeEqual = (left: string, right: string) => {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return result === 0;
};

export const parseCookies = (request: Request) => {
  const result = new Map<string, string>();
  (request.headers.get("cookie") ?? "").split(";").forEach((part) => {
    const index = part.indexOf("=");
    if (index < 0) return;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) result.set(key, decodeURIComponent(value));
  });
  return result;
};

export const cookie = (name: string, value: string, request: Request, maxAge: number) => {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
};

export const clearCookie = (name: string, request: Request) => cookie(name, "", request, 0);

export const createOAuthState = async () => {
  const state = randomToken();
  const verifier = randomToken(48);
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(verifier));
  return { state, verifier, challenge: bytesToBase64Url(new Uint8Array(digest)) };
};

export const createSessionToken = async (session: AdminSession) => {
  const payload = stringToBase64Url(JSON.stringify(session));
  return `${payload}.${await hmac(payload)}`;
};

export const readAdminSession = async (request: Request): Promise<AdminSession | null> => {
  const token = parseCookies(request).get(SESSION_COOKIE);
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature || !safeEqual(signature, await hmac(payload))) return null;
  try {
    const session = JSON.parse(base64UrlToString(payload)) as AdminSession;
    if (!session.login || !session.exp || session.exp <= Date.now()) return null;
    const allowedLogin = runtimeEnv.ADMIN_GITHUB_LOGIN?.toLowerCase();
    if (!allowedLogin || session.login.toLowerCase() !== allowedLogin) return null;
    return session;
  } catch {
    return null;
  }
};

export const assertSameOrigin = (request: Request) => {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
};

export const authCookies = {
  session: SESSION_COOKIE,
  state: STATE_COOKIE,
  verifier: VERIFIER_COOKIE,
};
