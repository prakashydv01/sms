import {
  pgTable,
  uuid,
  text,
  date,
  timestamp,
  pgEnum,
  unique,
  jsonb,
  integer,
} from "drizzle-orm/pg-core";
import { schools } from "./schools";
import { classes, sections } from "./academic";
import { importBatches } from "./imports";

export const genderEnum = pgEnum("gender", ["male", "female", "other"]);

export const studentStatusEnum = pgEnum("student_status", [
  "active",
  "inactive",
  "graduated",
  "transferred",
]);

export const students = pgTable(
  "students",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),

    // Displayed to users as "Student ID" (e.g. "GVS-000123"). Auto-generated
    // via issueStudentIdNumber() - never manually typed. The column name
    // stays "admission_number" for historical/schema-stability reasons;
    // only the generation mechanism and the UI label changed.
    admissionNumber: text("admission_number").notNull(),

    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    dateOfBirth: date("date_of_birth").notNull(),
    gender: genderEnum("gender").notNull(),

    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id),
    sectionId: uuid("section_id").references(() => sections.id), // nullable - some schools don't split into sections

    guardianName: text("guardian_name").notNull(),
    guardianPhone: text("guardian_phone").notNull(),
    guardianEmail: text("guardian_email"),
    fatherName: text("father_name"),
    motherName: text("mother_name"),
    address: text("address"),

    // Catch-all for imported columns that don't map to any known field
    // (e.g. "Blood Group", "Previous School", "Religion") - stored as raw
    // key/value pairs keyed by the original spreadsheet header, so data
    // the schema doesn't explicitly model yet is preserved rather than
    // silently dropped on import.
    extraFields: jsonb("extra_fields").$type<Record<string, string>>(),

    admissionDate: date("admission_date").notNull(),
    status: studentStatusEnum("status").notNull().default("active"),

    // Nullable - null means manually entered one at a time, not part of a bulk import
    importBatchId: uuid("import_batch_id").references(() => importBatches.id),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [unique().on(table.schoolId, table.admissionNumber)]
);

/**
 * Atomic per-school counter backing auto-generated Student IDs. A single
 * row per school; issuing the next number is one atomic upsert (see
 * issueStudentIdNumber in students/actions/generate-student-id.ts) so
 * concurrent inserts can never issue the same number twice.
 */
export const studentIdSequences = pgTable("student_id_sequences", {
  schoolId: uuid("school_id")
    .primaryKey()
    .references(() => schools.id, { onDelete: "cascade" }),
  nextNumber: integer("next_number").notNull().default(1),
});

export type Student = typeof students.$inferSelect;
export type NewStudent = typeof students.$inferInsert;
