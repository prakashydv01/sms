import { db } from "@/db";
import { students } from "@/db/schema";
import {
  studentSchema,
  type StudentFormValues,
} from "../schemas/student.schema";
import { generateStudentId } from "./generate-student-id";

export type CreateStudentResult =
  | { success: true; studentId: string; generatedStudentCode: string }
  | { success: false; errors: Record<string, string> };

/**
 * The one function that actually writes a student to the database.
 * Both the manual entry Server Action and the Excel importer's row
 * processor call this - so validation and insert logic only exist in
 * one place.
 *
 * The Student ID (admissionNumber column) is generated here, not
 * supplied by the caller - see generateStudentId(). This means there's
 * no "duplicate admission number" failure mode to handle anymore; the
 * atomic per-school counter guarantees uniqueness by construction.
 */
export async function createStudent(
  schoolId: string,
  input: StudentFormValues,
  importBatchId?: string
): Promise<CreateStudentResult> {
  const parsed = studentSchema.safeParse(input);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      errors[issue.path.join(".") || "form"] = issue.message;
    }
    return { success: false, errors };
  }

  const data = parsed.data;

  const school = await db.query.schools.findFirst({
    where: (s, { eq }) => eq(s.id, schoolId),
  });
  if (!school) {
    return { success: false, errors: { form: "School not found" } };
  }

  const generatedStudentCode = await generateStudentId(schoolId, school.name);

  const [row] = await db
    .insert(students)
    .values({
      schoolId,
      admissionNumber: generatedStudentCode,
      firstName: data.firstName,
      lastName: data.lastName,
      dateOfBirth: data.dateOfBirth,
      gender: data.gender,
      classId: data.classId,
      sectionId: data.sectionId || null,
      guardianName: data.guardianName,
      guardianPhone: data.guardianPhone,
      guardianEmail: data.guardianEmail || null,
      fatherName: data.fatherName || null,
      motherName: data.motherName || null,
      address: data.address || null,
      extraFields: data.extraFields && Object.keys(data.extraFields).length > 0 ? data.extraFields : null,
      admissionDate: data.admissionDate,
      importBatchId: importBatchId || null,
    })
    .returning({ id: students.id });

  return { success: true, studentId: row.id, generatedStudentCode };
}
