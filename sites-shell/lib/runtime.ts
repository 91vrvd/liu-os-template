import { env } from "cloudflare:workers";

export interface LiuOsRuntimeEnv {
  DB: D1Database;
  MEDIA: R2Bucket;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  AUTH_SESSION_SECRET?: string;
  ADMIN_GITHUB_LOGIN?: string;
  CHINA_MIRROR_PROXY_SECRET?: string;
}

export const runtimeEnv = env as unknown as LiuOsRuntimeEnv;
