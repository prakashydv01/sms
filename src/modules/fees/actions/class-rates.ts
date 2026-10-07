"use server";

import { db } from "@/db";
import { feeTypeClassRates } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

/**
 * Returns the effective rate for a fee type in a given class: the
 * class-specific override if one exists, otherwise the fee type's
 * school-wide default. Callers should always go through this rather
 * than reading feeType.defaultAmount directly once a class is known.
 */
export async function getEffectiveRate(feeTypeId: string, classId: string): Promise<number> {
  const override = await db.query.feeTypeClassRates.findFirst({
    where: and(eq(feeTypeClassRates.feeTypeId, feeTypeId), eq(feeTypeClassRates.classId, classId)),
  });
  if (override) return override.amount;

  const feeType = await db.query.feeTypes.findFirst({
    where: (f, { eq }) => eq(f.id, feeTypeId),
  });
  return feeType?.defaultAmount ?? 0;
}

export async function getClassRatesForFeeType(feeTypeId: string) {
  return db.query.feeTypeClassRates.findMany({
    where: eq(feeTypeClassRates.feeTypeId, feeTypeId),
    with: { class: true },
  });
}

/**
 * Sets (or clears, if amount is null) the per-class rate for a fee type.
 * This is what makes "Monthly Tuition costs 1000 for Grade 1, 2500 for
 * Grade 10" persist and get reused on every future assignment, instead
 * of re-entering the amount by hand each time.
 */
export async function setClassRate(
  feeTypeId: string,
  classId: string,
  amount: number | null
): Promise<{ success: true } | { success: false; error: string }> {
  if (amount !== null && amount <= 0) {
    return { success: false, error: "Amount must be greater than 0" };
  }

  const existing = await db.query.feeTypeClassRates.findFirst({
    where: and(eq(feeTypeClassRates.feeTypeId, feeTypeId), eq(feeTypeClassRates.classId, classId)),
  });

  if (amount === null) {
    if (existing) {
      await db.delete(feeTypeClassRates).where(eq(feeTypeClassRates.id, existing.id));
    }
    revalidatePath("/fees");
    return { success: true };
  }

  const amountInSmallestUnit = Math.round(amount * 100);

  if (existing) {
    await db
      .update(feeTypeClassRates)
      .set({ amount: amountInSmallestUnit })
      .where(eq(feeTypeClassRates.id, existing.id));
  } else {
    await db.insert(feeTypeClassRates).values({ feeTypeId, classId, amount: amountInSmallestUnit });
  }

  revalidatePath("/fees");
  return { success: true };
}
