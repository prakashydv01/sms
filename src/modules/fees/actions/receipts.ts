"use server";

import { db } from "@/db";

export async function getReceiptData(paymentId: string) {
  const payment = await db.query.feePayments.findFirst({
    where: (p, { eq }) => eq(p.id, paymentId),
    with: {
      recordedByUser: true,
      invoice: {
        with: {
          student: { with: { class: true, section: true, school: true } },
          assignment: { with: { feeType: true } },
        },
      },
    },
  });
  return payment ?? null;
}
