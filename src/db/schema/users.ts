import { pgTable, uuid, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { schools } from "./schools";

// Kept as a Postgres enum for data integrity at the DB level.
// Add new roles here as modules grow (e.g. "librarian", "accountant").
export const userRoleEnum = pgEnum("user_role", [
  "super_admin", // you - manages multiple schools
  "school_admin", // runs one school
  "teacher",
  "student",
  "parent",
]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id")
    .notNull()
    .references(() => schools.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: userRoleEnum("role").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
