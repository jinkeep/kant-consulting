import {
  mysqlTable,
  varchar,
  text,
  json,
  timestamp,
  mysqlEnum,
  index,
  boolean,
  unique,
} from "drizzle-orm/mysql-core";
import { NODE_IDS } from "@/lib/conversation/nodes";

export const users = mysqlTable(
  "users",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    phone: varchar("phone", { length: 20 }).notNull(),
    inviteCode: varchar("invite_code", { length: 50 }).notNull(),
    role: mysqlEnum("role", ["admin", "user"]).notNull().default("user"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [unique("users_phone_unique").on(t.phone)]
);

export const inviteCodes = mysqlTable("invite_codes", {
  id: varchar("id", { length: 36 }).primaryKey(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  role: mysqlEnum("role", ["admin", "user"]).notNull().default("user"),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: varchar("created_by", { length: 36 }).references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const sessions = mysqlTable("sessions", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userPhone: varchar("user_phone", { length: 20 }),
  currentNode: mysqlEnum("current_node", NODE_IDS)
    .notNull()
    .default("greeting"),
  facts: json("facts").$type<string[]>().notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

export const messages = mysqlTable(
  "messages",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    sessionId: varchar("session_id", { length: 36 })
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    role: mysqlEnum("role", ["user", "assistant", "system"]).notNull(),
    content: text("content").notNull(),
    nodeId: mysqlEnum("node_id", NODE_IDS),
    metadata: json("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("messages_session_idx").on(t.sessionId, t.createdAt)]
);

export const leads = mysqlTable(
  "leads",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    sessionId: varchar("session_id", { length: 36 }).references(
      () => sessions.id,
      { onDelete: "set null" }
    ),
    userPhone: varchar("user_phone", { length: 20 }),
    email: varchar("email", { length: 255 }).notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("leads_email_idx").on(t.email)]
);

export const reports = mysqlTable(
  "reports",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userPhone: varchar("user_phone", { length: 20 }).notNull(),
    sessionId: varchar("session_id", { length: 36 }).references(
      () => sessions.id,
      { onDelete: "set null" }
    ),
    content: json("content").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("reports_phone_idx").on(t.userPhone, t.createdAt)]
);

export const appSettings = mysqlTable("app_settings", {
  key: varchar("key", { length: 100 }).primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type InviteCode = typeof inviteCodes.$inferSelect;
export type NewInviteCode = typeof inviteCodes.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
export type Report = typeof reports.$inferSelect;
export type NewReport = typeof reports.$inferInsert;
export type AppSetting = typeof appSettings.$inferSelect;
export type NewAppSetting = typeof appSettings.$inferInsert;
