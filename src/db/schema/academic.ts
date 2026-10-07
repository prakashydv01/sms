import {
  pgTable,
  uuid,
  text,
  date,
  boolean,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { schools } from "./schools";

export const academicYears = pgTable("academic_years", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id")
    .notNull()
    .references(() => schools.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // e.g. "2026-2027"
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  isCurrent: boolean("is_current").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const classes = pgTable(
  "classes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    academicYearId: uuid("academic_year_id")
      .notNull()
      .references(() => academicYears.id, { onDelete: "cascade" }),
    name: text("name").notNull(), // e.g. "Grade 5", "Class V" - free text on purpose, schools name classes differently
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    // Same class name can't be created twice in the same school/year
    unique().on(table.schoolId, table.academicYearId, table.name),
  ]
);

export const sections = pgTable(
  "sections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    name: text("name").notNull(), // e.g. "A", "B", "Blue"
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [unique().on(table.classId, table.name)]
);

export type AcademicYear = typeof academicYears.$inferSelect;
export type Class = typeof classes.$inferSelect;
export type Section = typeof sections.$inferSelect;
