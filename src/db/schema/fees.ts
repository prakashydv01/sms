import {
  pgTable,
  uuid,
  text,
  integer,
  date,
  timestamp,
  pgEnum,
  unique,
  boolean,
} from "drizzle-orm/pg-core";
import { schools } from "./schools";
import { students } from "./students";
import { users } from "./users";
import { classes } from "./academic";

export const feeFrequencyEnum = pgEnum("fee_frequency", [
  "one_time", // e.g. admission fee, ID card fee
  "monthly", // e.g. tuition
  "termly",
  "annual",
]);

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "unpaid",
  "partial",
  "paid",
  "waived",
]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "cash",
  "bank_transfer",
  "online",
  "cheque",
  "other",
]);

/**
 * A fee a school charges - "Monthly Tuition", "Admit Card Fee", "ID Card Fee",
 * etc. Amounts here are stored in the smallest currency unit (e.g. paisa/cents)
 * to avoid floating point rounding issues in money math.
 */
export const feeTypes = pgTable("fee_types", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id")
    .notNull()
    .references(() => schools.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  frequency: feeFrequencyEnum("frequency").notNull(),
  defaultAmount: integer("default_amount").notNull(), // smallest currency unit
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/**
 * Per-class override of a fee type's rate - e.g. "Monthly Tuition" costs
 * 1000 for Grade 1 but 2500 for Grade 10. If no row exists here for a
 * given (feeType, class) pair, feeType.defaultAmount is used instead.
 * This is set once per class and then reused every time that fee is
 * assigned to that class, rather than re-entering the amount each time.
 */
export const feeTypeClassRates = pgTable(
  "fee_type_class_rates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    feeTypeId: uuid("fee_type_id")
      .notNull()
      .references(() => feeTypes.id, { onDelete: "cascade" }),
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(), // smallest currency unit
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [unique().on(table.feeTypeId, table.classId)]
);

/**
 * Which fee types apply to which student, and at what amount. This is
 * where scholarships/discounts live: `amount` can differ from the fee
 * type's defaultAmount on a per-student basis without touching the
 * school-wide fee type definition.
 */
export const studentFeeAssignments = pgTable(
  "student_fee_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    feeTypeId: uuid("fee_type_id")
      .notNull()
      .references(() => feeTypes.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(), // overridable per student - the actual amount owed
    discountReason: text("discount_reason"), // e.g. "50% merit scholarship" - null if no discount
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [unique().on(table.studentId, table.feeTypeId)]
);

/**
 * A single billable instance - for one_time fees there's exactly one
 * invoice ever; for monthly/termly/annual fees, one invoice is generated
 * per period (periodLabel like "April 2026" keeps recurring fees distinct
 * from each other instead of re-using one row).
 */
export const feeInvoices = pgTable(
  "fee_invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    studentFeeAssignmentId: uuid("student_fee_assignment_id")
      .notNull()
      .references(() => studentFeeAssignments.id, { onDelete: "cascade" }),
    periodLabel: text("period_label"), // e.g. "April 2026" - null for one_time fees
    amountDue: integer("amount_due").notNull(),
    amountPaid: integer("amount_paid").notNull().default(0),
    status: invoiceStatusEnum("status").notNull().default("unpaid"),
    dueDate: date("due_date"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  // Prevents double-generating the same recurring invoice for the same
  // student/period, e.g. clicking "Generate this month" twice.
  (table) => [unique().on(table.studentFeeAssignmentId, table.periodLabel)]
);

/**
 * Ledger of actual money received against an invoice. An invoice can have
 * multiple partial payments; amountPaid on the invoice is a denormalized
 * running total kept in sync whenever a payment is recorded.
 */
export const feePayments = pgTable("fee_payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  invoiceId: uuid("invoice_id")
    .notNull()
    .references(() => feeInvoices.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(),
  method: paymentMethodEnum("method").notNull().default("cash"),
  paidDate: date("paid_date").notNull(),
  notes: text("notes"),
  recordedBy: uuid("recorded_by").references(() => users.id),
  receiptNumber: text("receipt_number").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type FeeType = typeof feeTypes.$inferSelect;
export type FeeTypeClassRate = typeof feeTypeClassRates.$inferSelect;
export type StudentFeeAssignment = typeof studentFeeAssignments.$inferSelect;

/**
 * A named bundle of fee types - e.g. "Annual Package" grouping Monthly
 * Tuition + Admit Card Fee + ID Card Fee. A package has no price of its
 * own; it's a saved preset of WHICH fee types to assign together. Each
 * fee type keeps its own amount/frequency/per-class rate exactly as if
 * assigned individually - this avoids a second, parallel pricing system
 * that could drift out of sync with the fee types it's built from.
 */
export const feePackages = pgTable("fee_packages", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id")
    .notNull()
    .references(() => schools.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const feePackageItems = pgTable(
  "fee_package_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    packageId: uuid("package_id")
      .notNull()
      .references(() => feePackages.id, { onDelete: "cascade" }),
    feeTypeId: uuid("fee_type_id")
      .notNull()
      .references(() => feeTypes.id, { onDelete: "cascade" }),
  },
  (table) => [unique().on(table.packageId, table.feeTypeId)]
);

export type FeePackage = typeof feePackages.$inferSelect;
export type FeeInvoice = typeof feeInvoices.$inferSelect;
export type FeePayment = typeof feePayments.$inferSelect;
