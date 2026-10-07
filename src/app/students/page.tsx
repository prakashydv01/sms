import { db } from "@/db";
import { auth } from "@/lib/auth";
import { getClassesWithSections } from "@/modules/students/actions/get-classes";
import { StudentsPageClient } from "@/modules/students/components/students-page-client";
import { AppShell } from "@/components/app-shell";

export default async function StudentsPage() {
  const session = await auth();
  const schoolId = session?.user.schoolId ?? "";

  const classes = schoolId ? await getClassesWithSections(schoolId) : [];

  const school = schoolId
    ? await db.query.schools.findFirst({ where: (s, { eq }) => eq(s.id, schoolId) })
    : undefined;

  const students = schoolId
    ? await db.query.students.findMany({
        where: (s, { eq }) => eq(s.schoolId, schoolId),
        with: { class: true, section: true },
        orderBy: (s, { desc }) => [desc(s.createdAt)],
      })
    : [];

  const rows = students.map((s) => ({
    id: s.id,
    admissionNumber: s.admissionNumber,
    firstName: s.firstName,
    lastName: s.lastName,
    dateOfBirth: s.dateOfBirth,
    gender: s.gender,
    classId: s.classId,
    sectionId: s.sectionId,
    className: s.class?.name,
    sectionName: s.section?.name,
    guardianName: s.guardianName,
    guardianPhone: s.guardianPhone,
    guardianEmail: s.guardianEmail,
    fatherName: s.fatherName,
    motherName: s.motherName,
    address: s.address,
    admissionDate: s.admissionDate,
    status: s.status,
  }));

  return (
    <AppShell schoolName={school?.name} userName={session?.user.name ?? undefined} activeNav="students">
      <StudentsPageClient schoolId={schoolId} classes={classes} students={rows} />
    </AppShell>
  );
}
