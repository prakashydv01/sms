"use server";

import { db } from "@/db";

export async function getStudentsForPromotion(
  schoolId: string,
  classId: string,
  sectionId?: string
) {
  return db.query.students.findMany({
    where: (s, { eq, and }) =>
      and(
        eq(s.schoolId, schoolId),
        eq(s.classId, classId),
        sectionId ? eq(s.sectionId, sectionId) : undefined,
        eq(s.status, "active")
      ),
    with: { section: true },
    orderBy: (s, { asc }) => [asc(s.firstName)],
  });
}
