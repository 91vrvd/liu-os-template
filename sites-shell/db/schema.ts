import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const contentState = sqliteTable("content_state", {
  id: text("id").primaryKey(),
  draftJson: text("draft_json"),
  publishedJson: text("published_json"),
  draftUpdatedAt: text("draft_updated_at"),
  publishedAt: text("published_at"),
  updatedBy: text("updated_by"),
});

export const contentAudit = sqliteTable("content_audit", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  action: text("action").notNull(),
  actor: text("actor").notNull(),
  createdAt: text("created_at").notNull(),
});

export const mediaAssets = sqliteTable("media_assets", {
  id: text("id").primaryKey(),
  objectKey: text("object_key").notNull(),
  fileName: text("file_name").notNull(),
  contentType: text("content_type").notNull(),
  size: integer("size").notNull(),
  uploadedBy: text("uploaded_by").notNull(),
  createdAt: text("created_at").notNull(),
});

export const shareRooms = sqliteTable("share_rooms", {
  code: text("code").primaryKey(),
  mode: text("mode").notNull(),
  hostMemberId: text("host_member_id").notNull(),
  networkHash: text("network_hash"),
  approvalRequired: integer("approval_required", { mode: "boolean" }).notNull().default(false),
  maxMembers: integer("max_members").notNull(),
  fileRecipients: text("file_recipients").notNull().default("selected"),
  createdAt: integer("created_at").notNull(),
  expiresAt: integer("expires_at").notNull(),
}, (table) => [
  index("share_rooms_expires_at_idx").on(table.expiresAt),
]);

export const shareMembers = sqliteTable("share_members", {
  id: text("id").primaryKey(),
  roomCode: text("room_code").notNull().references(() => shareRooms.code, { onDelete: "cascade" }),
  memberId: text("member_id").notNull(),
  secretHash: text("secret_hash").notNull(),
  nickname: text("nickname").notNull(),
  status: text("status").notNull(),
  isHost: integer("is_host", { mode: "boolean" }).notNull().default(false),
  joinedAt: integer("joined_at").notNull(),
  lastSeenAt: integer("last_seen_at").notNull(),
}, (table) => [
  uniqueIndex("share_members_room_member_idx").on(table.roomCode, table.memberId),
  index("share_members_room_idx").on(table.roomCode),
  index("share_members_last_seen_idx").on(table.lastSeenAt),
]);

export const shareSignals = sqliteTable("share_signals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  roomCode: text("room_code").notNull().references(() => shareRooms.code, { onDelete: "cascade" }),
  fromMemberId: text("from_member_id").notNull(),
  toMemberId: text("to_member_id"),
  type: text("type").notNull(),
  payloadJson: text("payload_json").notNull(),
  nonce: text("nonce").notNull(),
  createdAt: integer("created_at").notNull(),
  expiresAt: integer("expires_at").notNull(),
}, (table) => [
  uniqueIndex("share_signals_nonce_idx").on(table.nonce),
  index("share_signals_room_id_idx").on(table.roomCode, table.id),
  index("share_signals_expires_at_idx").on(table.expiresAt),
]);

export const shareRateLimits = sqliteTable("share_rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  windowStartedAt: integer("window_started_at").notNull(),
  expiresAt: integer("expires_at").notNull(),
}, (table) => [
  index("share_rate_limits_expires_at_idx").on(table.expiresAt),
]);
