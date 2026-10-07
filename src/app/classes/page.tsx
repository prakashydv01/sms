import { db } from "@/db";
import { auth } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { getClassesWithSections } from "@/modules/students/actions/get-classes";
import { getCurrentAcademicYear } from "@/modules/students/actions/manage-classes";
import { ClassesPageClient } from "@/modules/students/components/classes-page-client";

export default async function ClassesPage() {
  const session = await auth();
  const schoolId = session?.user.schoolId ?? "";

  const school = schoolId
    ? await db.query.schools.findFirst({ where: (s, { eq }) => eq(s.id, schoolId) })
    : undefined;

  const [classes, academicYear] = schoolId
    ? await Promise.all([getClassesWithSections(schoolId), getCurrentAcademicYear(schoolId)])
    : [[], undefined];

  // Count students per class/section so deletion guidance is visible up front
  const studentCounts = schoolId
    ? await db.query.students.findMany({
        where: (s, { eq }) => eq(s.schoolId, schoolId),
        columns: { classId: true, sectionId: true },
      })
    : [];

  const classesWithCounts = classes.map((c) => ({
    id: c.id,
    name: c.name,
    studentCount: studentCounts.filter((s) => s.classId === c.id).length,
    sections: c.sections.map((s) => ({
      id: s.id,
      name: s.name,
      studentCount: studentCounts.filter((st) => st.sectionId === s.id).length,
    })),
  }));

  return (
    <AppShell schoolName={school?.name} userName={session?.user.name ?? undefined} activeNav="classes">
      <ClassesPageClient
        schoolId={schoolId}
        academicYearId={academicYear?.id ?? ""}
        academicYearName={academicYear?.name}
        classes={classesWithCounts}
      />
    </AppShell>
  );
}
