import { db } from "@/db";

export async function getClassesWithSections(schoolId: string) {
  return db.query.classes.findMany({
    where: (c, { eq }) => eq(c.schoolId, schoolId),
    with: { sections: true },
    orderBy: (c, { asc }) => [asc(c.name)],
  });
}
