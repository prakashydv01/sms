"use server";

import { db } from "@/db";
import { feePackages, feePackageItems } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function getFeePackages(schoolId: string) {
  return db.query.feePackages.findMany({
    where: eq(feePackages.schoolId, schoolId),
    with: { items: { with: { feeType: true } } },
    orderBy: (p, { asc }) => [asc(p.name)],
  });
}

export async function createFeePackage(
  schoolId: string,
  name: string,
  feeTypeIds: string[]
): Promise<{ success: true } | { success: false; error: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { success: false, error: "Package name is required" };
  if (feeTypeIds.length === 0) return { success: false, error: "Select at least one fee type" };

  const [pkg] = await db.insert(feePackages).values({ schoolId, name: trimmed }).returning();
  await db.insert(feePackageItems).values(feeTypeIds.map((feeTypeId) => ({ packageId: pkg.id, feeTypeId })));

  revalidatePath("/fees");
  return { success: true };
}

export async function deleteFeePackage(packageId: string): Promise<void> {
  await db.delete(feePackages).where(eq(feePackages.id, packageId));
  revalidatePath("/fees");
}
