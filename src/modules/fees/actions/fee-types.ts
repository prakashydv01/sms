"use server";

import { db } from "@/db";
import { feeTypes, feeTypeClassRates } from "@/db/schema";
import { feeTypeSchema, validateWith } from "../schemas/fee.schema";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

/**
 * Creates a fee type, optionally with per-class rates set right away.
 * classRates is a map of classId -> amount (main currency units, e.g.
 * "1000.00") for any classes that should NOT use the flat defaultAmount.
 * defaultAmount is still required as the fallback for any class not
 * listed here - it's a floor to fall back on, not meant to imply every
 * class actually charges that amount.
 */
export async function createFeeType(
  schoolId: string,
  formData: FormData,
  classRates?: Record<string, string>
): Promise<{ success: true } | { success: false; errors: Record<string, string> }> {
  const parsed = validateWith(feeTypeSchema, {
    name: formData.get("name"),
    frequency: formData.get("frequency"),
    defaultAmount: formData.get("defaultAmount"),
  });
  if (!parsed.success) return parsed;

  try {
    await db.transaction(async (tx) => {
      const [feeType] = await tx
        .insert(feeTypes)
        .values({
          schoolId,
          name: parsed.data.name,
          frequency: parsed.data.frequency,
          defaultAmount: Math.round(parsed.data.defaultAmount * 100),
        })
        .returning();

      if (classRates) {
        const rateRows = Object.entries(classRates)
          .filter(([, amount]) => amount && amount.trim() !== "")
          .map(([classId, amount]) => ({
            feeTypeId: feeType.id,
            classId,
            amount: Math.round(Number(amount) * 100),
          }))
          .filter((r) => Number.isFinite(r.amount) && r.amount > 0);

        if (rateRows.length > 0) {
          await tx.insert(feeTypeClassRates).values(rateRows);
        }
      }
    });
  } catch {
    return { success: false, errors: { form: "Could not save fee type. Please try again." } };
  }
  revalidatePath("/fees");
  return { success: true };
}

/**
 * Edits an existing fee type's name/frequency/default amount. Changing
 * these does NOT retroactively change amounts on invoices already
 * generated or fee assignments already made - those keep whatever amount
 * they were assigned at, which is correct: a fee type edit is a
 * going-forward change, not a rewrite of history.
 */
export async function updateFeeType(
  feeTypeId: string,
  formData: FormData
): Promise<{ success: true } | { success: false; errors: Record<string, string> }> {
  const parsed = validateWith(feeTypeSchema, {
    name: formData.get("name"),
    frequency: formData.get("frequency"),
    defaultAmount: formData.get("defaultAmount"),
  });
  if (!parsed.success) return parsed;

  try {
    await db
      .update(feeTypes)
      .set({
        name: parsed.data.name,
        frequency: parsed.data.frequency,
        defaultAmount: Math.round(parsed.data.defaultAmount * 100),
      })
      .where(eq(feeTypes.id, feeTypeId));
  } catch {
    return { success: false, errors: { form: "Could not update fee type. Please try again." } };
  }
  revalidatePath("/fees");
  return { success: true };
}

export async function getFeeTypes(schoolId: string) {
  return db.query.feeTypes.findMany({
    where: (f, { eq, and }) => and(eq(f.schoolId, schoolId), eq(f.isActive, true)),
    orderBy: (f, { asc }) => [asc(f.name)],
  });
}

export async function deactivateFeeType(feeTypeId: string) {
  await db.update(feeTypes).set({ isActive: false }).where(eq(feeTypes.id, feeTypeId));
  revalidatePath("/fees");
}

/**
 * Deletes a fee type outright - only allowed when it has never been
 * assigned to any student (no studentFeeAssignments reference it). A fee
 * type that's actually been used has real invoices/payments hanging off
 * it via those assignments; deleting it out from under them would orphan
 * that history. Deactivate instead in that case - same "waive, don't
 * delete" principle used for invoices and students throughout the app.
 */
export async function deleteFeeType(
  feeTypeId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const usage = await db.query.studentFeeAssignments.findFirst({
    where: (a, { eq }) => eq(a.feeTypeId, feeTypeId),
  });

  if (usage) {
    return {
      success: false,
      error:
        "This fee type has been assigned to at least one student and can't be deleted - deactivate it instead to hide it from future use while keeping existing records intact.",
    };
  }

  try {
    await db.delete(feeTypes).where(eq(feeTypes.id, feeTypeId));
  } catch {
    return { success: false, error: "Could not delete fee type. Please try again." };
  }

  revalidatePath("/fees");
  return { success: true };
}
