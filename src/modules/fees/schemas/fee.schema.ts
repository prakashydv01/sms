import { z } from "zod";

export const feeTypeSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  frequency: z.enum(["one_time", "monthly", "termly", "annual"], {
    message: "Select a frequency",
  }),
  // Entered by the user in main currency units (e.g. "500.00"), converted
  // to the smallest unit (paisa/cents) before hitting the database.
  defaultAmount: z.coerce
    .number({ message: "Enter a valid amount" })
    .positive("Amount must be greater than 0"),
});
export type FeeTypeFormValues = z.infer<typeof feeTypeSchema>;

export const feeAssignmentSchema = z.object({
  studentId: z.string().uuid("Select a student"),
  feeTypeId: z.string().uuid("Select a fee type"),
  amount: z.coerce
    .number({ message: "Enter a valid amount" })
    .nonnegative("Amount can't be negative"),
  discountReason: z.string().trim().max(200).optional().or(z.literal("")),
});
export type FeeAssignmentFormValues = z.infer<typeof feeAssignmentSchema>;

export const recordPaymentSchema = z.object({
  invoiceId: z.string().uuid(),
  amount: z.coerce
    .number({ message: "Enter a valid amount" })
    .positive("Payment amount must be greater than 0"),
  method: z.enum(["cash", "bank_transfer", "online", "cheque", "other"]),
  paidDate: z.string().refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date"),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});
export type RecordPaymentFormValues = z.infer<typeof recordPaymentSchema>;

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errors: Record<string, string> };

export function validateWith<T>(schema: z.ZodType<T>, input: unknown): ValidationResult<T> {
  const result = schema.safeParse(input);
  if (result.success) return { success: true, data: result.data };
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const field = issue.path.join(".") || "form";
    if (!errors[field]) errors[field] = issue.message;
  }
  return { success: false, errors };
}
