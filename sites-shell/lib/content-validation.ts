const MAX_CONTENT_BYTES = 2 * 1024 * 1024;
const MAX_STRING_LENGTH = 80_000;
const MAX_COLLECTION_ITEMS = 500;

const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);

const isPublicUrl = (value: string) => {
  if (!value) return true;
  if (value.startsWith("/media/") || value.startsWith("/desktop/")) return true;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
};

const walk = (value: unknown, depth = 0): boolean => {
  if (depth > 12) return false;
  if (typeof value === "string") return value.length <= MAX_STRING_LENGTH;
  if (value === null || typeof value === "number" || typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.length <= MAX_COLLECTION_ITEMS && value.every((item) => walk(item, depth + 1));
  if (!isObject(value)) return false;
  return Object.entries(value).every(([key, child]) => key.length <= 80 && walk(child, depth + 1));
};

export const validateSiteContent = (content: unknown) => {
  if (!isObject(content)) return { valid: false, error: "invalid-content" } as const;
  const encoded = JSON.stringify(content);
  if (typeof encoded !== "string") return { valid: false, error: "invalid-content" } as const;
  if (new TextEncoder().encode(encoded).byteLength > MAX_CONTENT_BYTES) {
    return { valid: false, error: "content-too-large" } as const;
  }
  if (content.schemaVersion !== 2 || !walk(content)) {
    return { valid: false, error: "invalid-content" } as const;
  }
  if (
    !isObject(content.profile)
    || !Array.isArray(content.projects)
    || !Array.isArray(content.experiences)
    || !Array.isArray(content.skillGroups)
    || !Array.isArray(content.safariBookmarks)
    || !Array.isArray(content.mediaTracks)
    || !Array.isArray(content.desktopShortcuts)
  ) {
    return { valid: false, error: "invalid-shape" } as const;
  }

  const projectUrls = content.projects.flatMap((project) => {
    if (!isObject(project)) return ["invalid:"];
    return [project.screenshot, project.github, project.live].filter((value): value is string => typeof value === "string");
  });
  const bookmarkUrls = content.safariBookmarks.flatMap((bookmark) => {
    if (!isObject(bookmark)) return ["invalid:"];
    return [bookmark.targetUrl, bookmark.icon].filter((value): value is string => typeof value === "string");
  });
  const mediaUrls = content.mediaTracks.flatMap((track) => {
    if (!isObject(track)) return ["invalid:"];
    return [track.sourceUrl, track.embedUrl, track.externalUrl].filter((value): value is string => typeof value === "string");
  });
  const shortcutUrls = content.desktopShortcuts.flatMap((shortcut) => {
    if (!isObject(shortcut)) return ["invalid:"];
    return [shortcut.icon, shortcut.targetUrl].filter((value): value is string => typeof value === "string");
  });

  if (![...projectUrls, ...bookmarkUrls, ...mediaUrls, ...shortcutUrls].every(isPublicUrl)) {
    return { valid: false, error: "unsafe-url" } as const;
  }

  return { valid: true } as const;
};
