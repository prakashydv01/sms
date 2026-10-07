import { relations } from "drizzle-orm";
import { schools } from "./schools";
import { users } from "./users";
import { academicYears, classes, sections } from "./academic";
import { students } from "./students";
import { importBatches } from "./imports";
import {
  feeTypes,
  studentFeeAssignments,
  feeInvoices,
  feePayments,
  feeTypeClassRates,
  feePackages,
  feePackageItems,
} from "./fees";

export const schoolsRelations = relations(schools, ({ many }) => ({
  users: many(users),
  academicYears: many(academicYears),
  classes: many(classes),
  students: many(students),
}));

export const academicYearsRelations = relations(academicYears, ({ one, many }) => ({
  school: one(schools, {
    fields: [academicYears.schoolId],
    references: [schools.id],
  }),
  classes: many(classes),
}));

export const classesRelations = relations(classes, ({ one, many }) => ({
  school: one(schools, { fields: [classes.schoolId], references: [schools.id] }),
  academicYear: one(academicYears, {
    fields: [classes.academicYearId],
    references: [academicYears.id],
  }),
  sections: many(sections),
  students: many(students),
}));

export const sectionsRelations = relations(sections, ({ one, many }) => ({
  class: one(classes, { fields: [sections.classId], references: [classes.id] }),
  students: many(students),
}));

export const studentsRelations = relations(students, ({ one, many }) => ({
  school: one(schools, { fields: [students.schoolId], references: [schools.id] }),
  class: one(classes, { fields: [students.classId], references: [classes.id] }),
  section: one(sections, { fields: [students.sectionId], references: [sections.id] }),
  importBatch: one(importBatches, {
    fields: [students.importBatchId],
    references: [importBatches.id],
  }),
  feeAssignments: many(studentFeeAssignments),
  invoices: many(feeInvoices),
}));

export const importBatchesRelations = relations(importBatches, ({ one, many }) => ({
  school: one(schools, { fields: [importBatches.schoolId], references: [schools.id] }),
  uploadedByUser: one(users, {
    fields: [importBatches.uploadedBy],
    references: [users.id],
  }),
  students: many(students),
}));

export const feeTypesRelations = relations(feeTypes, ({ one, many }) => ({
  school: one(schools, { fields: [feeTypes.schoolId], references: [schools.id] }),
  assignments: many(studentFeeAssignments),
  classRates: many(feeTypeClassRates),
}));

export const feeTypeClassRatesRelations = relations(feeTypeClassRates, ({ one }) => ({
  feeType: one(feeTypes, { fields: [feeTypeClassRates.feeTypeId], references: [feeTypes.id] }),
  class: one(classes, { fields: [feeTypeClassRates.classId], references: [classes.id] }),
}));

export const studentFeeAssignmentsRelations = relations(studentFeeAssignments, ({ one, many }) => ({
  student: one(students, { fields: [studentFeeAssignments.studentId], references: [students.id] }),
  feeType: one(feeTypes, { fields: [studentFeeAssignments.feeTypeId], references: [feeTypes.id] }),
  invoices: many(feeInvoices),
}));

export const feeInvoicesRelations = relations(feeInvoices, ({ one, many }) => ({
  school: one(schools, { fields: [feeInvoices.schoolId], references: [schools.id] }),
  student: one(students, { fields: [feeInvoices.studentId], references: [students.id] }),
  assignment: one(studentFeeAssignments, {
    fields: [feeInvoices.studentFeeAssignmentId],
    references: [studentFeeAssignments.id],
  }),
  payments: many(feePayments),
}));

export const feePaymentsRelations = relations(feePayments, ({ one }) => ({
  invoice: one(feeInvoices, { fields: [feePayments.invoiceId], references: [feeInvoices.id] }),
  recordedByUser: one(users, { fields: [feePayments.recordedBy], references: [users.id] }),
}));

export const feePackagesRelations = relations(feePackages, ({ one, many }) => ({
  school: one(schools, { fields: [feePackages.schoolId], references: [schools.id] }),
  items: many(feePackageItems),
}));

export const feePackageItemsRelations = relations(feePackageItems, ({ one }) => ({
  package: one(feePackages, { fields: [feePackageItems.packageId], references: [feePackages.id] }),
  feeType: one(feeTypes, { fields: [feePackageItems.feeTypeId], references: [feeTypes.id] }),
}));
