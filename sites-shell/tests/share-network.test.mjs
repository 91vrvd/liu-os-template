import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { normalizedNetworkAddress } from "../lib/network-identity.ts";

const shellRoot = new URL("../", import.meta.url);
const projectRoot = new URL("../../", import.meta.url);

test("network identity matches public IPv4 and IPv6 /64 peers", () => {
  assert.equal(normalizedNetworkAddress("203.0.113.8"), "ipv4:203.0.113.8");
  assert.equal(normalizedNetworkAddress("::ffff:203.0.113.8"), "ipv4:203.0.113.8");
  assert.equal(
    normalizedNetworkAddress("2001:db8:1234:5678:aaaa:bbbb:cccc:dddd"),
    "ipv6-64:2001:0db8:1234:5678",
  );
  assert.equal(
    normalizedNetworkAddress("2001:db8:1234:5678::9"),
    "ipv6-64:2001:0db8:1234:5678",
  );
  assert.equal(normalizedNetworkAddress("not-an-address"), null);
});

test("LAN rooms bind signaling to one network while WebRTC remains peer-to-peer", async () => {
  const [route, provider, roomCreate, signalServer, trustedProxy] = await Promise.all([
    readFile(new URL("app/api/share/rooms/[code]/route.ts", shellRoot), "utf8"),
    readFile(new URL("src/share/ShareProvider.tsx", projectRoot), "utf8"),
    readFile(new URL("app/api/share/rooms/route.ts", shellRoot), "utf8"),
    readFile(new URL("lib/share-signal.ts", shellRoot), "utf8"),
    readFile(new URL("lib/trusted-proxy.ts", shellRoot), "utf8"),
  ]);
  assert.match(route, /requestMatchesLanNetwork/);
  assert.match(route, /lan-network-mismatch/);
  assert.match(roomCreate, /requestNetworkHash/);
  assert.match(signalServer, /trustedClientNetwork/);
  assert.match(trustedProxy, /CHINA_MIRROR_PROXY_SECRET/);
  assert.match(trustedProxy, /x-liu-mirror-signature/);
  assert.match(trustedProxy, /HMAC/);
  assert.match(provider, /stun:stun\.cloudflare\.com:3478/);
  assert.doesNotMatch(provider, /verifyLanDirectPath|selected\.local === 'host'/);
  assert.doesNotMatch(route, /typ\\s\+\(\?:srflx\|prflx\|relay\)/);
  assert.match(provider, /channel\.readyState !== 'open' \|\| !peer\.pathVerified/);
});

test("share links open the correct app and replace stale room sessions", async () => {
  const [desktop, shareApp, provider] = await Promise.all([
    readFile(new URL("src/components/layout/Desktop.tsx", projectRoot), "utf8"),
    readFile(new URL("src/components/apps/ShareRoomApp.tsx", projectRoot), "utf8"),
    readFile(new URL("src/share/ShareProvider.tsx", projectRoot), "utf8"),
  ]);
  assert.match(desktop, /params\.get\('share'\) === 'private'[\s\S]*params\.get\('share'\) === 'lan'[\s\S]*openApp\('lanShare'\)/);
  assert.match(shareApp, /if \(sessionCode\)[\s\S]*leaveRoom\(mode\)[\s\S]*joinRoom\(mode,/);
  assert.match(shareApp, /searchParams\.delete\('share'\)[\s\S]*searchParams\.delete\('code'\)/);
  assert.match(provider, /liu-os-share-sessions-v5/);
  assert.match(provider, /liu-os-share-sessions-v4/);
  assert.match(provider, /liu-os-share-sessions-v3/);
  assert.match(provider, /liu-os-share-sessions-v2/);
});

test("the desktop replaces the sharing Dock icon with Maps while preserving share links", async () => {
  const [dock, windows] = await Promise.all([
    readFile(new URL("src/components/layout/Dock.tsx", projectRoot), "utf8"),
    readFile(new URL("src/components/os/WindowManager.tsx", projectRoot), "utf8"),
  ]);
  assert.match(dock, /id: 'maps'/);
  assert.doesNotMatch(dock, /id: 'lanShare'/);
  assert.match(windows, /lanShare: LanShareApp/);
  assert.doesNotMatch(dock, /id: 'privateShare'/);
  assert.doesNotMatch(windows, /privateShare:/);
});

test("share signaling resumes from a durable cursor and skips stale broken events", async () => {
  const [provider, signalClient, signalServer] = await Promise.all([
    readFile(new URL("src/share/ShareProvider.tsx", projectRoot), "utf8"),
    readFile(new URL("src/lib/shareSignalClient.ts", projectRoot), "utf8"),
    readFile(new URL("lib/share-signal.ts", shellRoot), "utf8"),
  ]);
  assert.match(signalClient, /cursor:\s*number/);
  assert.match(provider, /signalCursor:\s*response\.cursor/);
  assert.match(provider, /currentCursor[\s\S]*session\.signalCursor/);
  assert.match(provider, /for \(const event of polled\.events\)[\s\S]*finally[\s\S]*handledCursor = event\.id/);
  assert.match(provider, /window\.setTimeout[\s\S]*announcedPeersRef\.current\.delete/);
  assert.match(signalClient, /localEventsKey[\s\S]*readLocalEvents[\s\S]*pollSignalEvents/);
  assert.match(signalServer, /COALESCE\(MAX\(id\), 0\) AS cursor/);
});

test("private text has an encrypted short-lived relay fallback without enabling LAN relay", async () => {
  const [route, provider, shareApp] = await Promise.all([
    readFile(new URL("app/api/share/rooms/[code]/route.ts", shellRoot), "utf8"),
    readFile(new URL("src/share/ShareProvider.tsx", projectRoot), "utf8"),
    readFile(new URL("src/components/apps/ShareRoomApp.tsx", projectRoot), "utf8"),
  ]);
  assert.match(route, /"chat-relay"/);
  assert.match(route, /payload\.type === "chat-relay" && room\.mode !== "private"/);
  assert.match(provider, /AES-GCM/);
  assert.match(provider, /PBKDF2/);
  assert.match(provider, /sendSignalEvent\(session, 'chat-relay'/);
  assert.match(shareApp, /mode === 'private'[\s\S]*remoteMembers\.length > 0/);
});
