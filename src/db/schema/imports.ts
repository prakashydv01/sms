import { pgTable, uuid, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { schools } from "./schools";
import { users } from "./users";

export const importStatusEnum = pgEnum("import_status", [
  "pending",
  "processing",
  "completed",
  "completed_with_errors",
  "failed",
]);

/**
 * Every row created via bulk import (and optionally manual entry) is tagged
 * with an import_batch_id. This gives us an audit trail and makes "undo this
 * import" possible later without extra design work now.
 */
export const importBatches = pgTable("import_batches", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id")
    .notNull()
    .references(() => schools.id, { onDelete: "cascade" }),
  entityType: text("entity_type").notNull(), // "students", "staff", "fees" etc - kept generic for reuse
  fileName: text("file_name"),
  uploadedBy: uuid("uploaded_by").references(() => users.id),
  status: importStatusEnum("status").notNull().default("pending"),
  totalRows: integer("total_rows").notNull().default(0),
  successRows: integer("success_rows").notNull().default(0),
  failedRows: integer("failed_rows").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ImportBatch = typeof importBatches.$inferSelect;
