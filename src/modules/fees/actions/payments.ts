"use server";

import { db } from "@/db";
import { feeInvoices, feePayments } from "@/db/schema";
import { recordPaymentSchema, validateWith } from "../schemas/fee.schema";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";

/**
 * Records a payment and updates the invoice's running total + status in
 * one transaction, so amountPaid on the invoice never drifts out of sync
 * with the sum of its actual payment rows. Who recorded it comes from the
 * actual logged-in session, not a caller-supplied value - a client
 * component has no legitimate way to assert "I am user X" otherwise.
 */
export async function recordPayment(
  formData: FormData
): Promise<
  | { success: true; paymentId: string; receiptNumber: string }
  | { success: false; errors: Record<string, string> }
> {
  const session = await auth();
  const recordedByUserId = session?.user.id;

  const parsed = validateWith(recordPaymentSchema, {
    invoiceId: formData.get("invoiceId"),
    amount: formData.get("amount"),
    method: formData.get("method"),
    paidDate: formData.get("paidDate"),
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) return parsed;

  const invoice = await db.query.feeInvoices.findFirst({
    where: (i, { eq }) => eq(i.id, parsed.data.invoiceId),
  });
  if (!invoice) return { success: false, errors: { form: "Invoice not found" } };

  const amountInSmallestUnit = Math.round(parsed.data.amount * 100);
  const remaining = invoice.amountDue - invoice.amountPaid;
  if (amountInSmallestUnit > remaining) {
    return {
      success: false,
      errors: { amount: `Payment exceeds remaining balance (${(remaining / 100).toFixed(2)})` },
    };
  }

  // Human-readable receipt number: RCPT-YYYYMMDD-XXXXXX. The random suffix
  // (not a DB sequence) keeps this simple under concurrent writes without
  // needing a separate counter table - collisions are astronomically
  // unlikely at single-school payment volumes.
  const datePart = parsed.data.paidDate.replace(/-/g, "");
  const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();
  const receiptNumber = `RCPT-${datePart}-${randomPart}`;

  const paymentId = await db.transaction(async (tx) => {
    const [payment] = await tx
      .insert(feePayments)
      .values({
        invoiceId: invoice.id,
        amount: amountInSmallestUnit,
        method: parsed.data.method,
        paidDate: parsed.data.paidDate,
        notes: parsed.data.notes || null,
        recordedBy: recordedByUserId,
        receiptNumber,
      })
      .returning();

    const newAmountPaid = invoice.amountPaid + amountInSmallestUnit;
    const newStatus =
      newAmountPaid >= invoice.amountDue ? "paid" : newAmountPaid > 0 ? "partial" : "unpaid";

    await tx
      .update(feeInvoices)
      .set({ amountPaid: newAmountPaid, status: newStatus })
      .where(eq(feeInvoices.id, invoice.id));

    return payment.id;
  });

  revalidatePath("/fees");
  return { success: true, paymentId, receiptNumber };
}
