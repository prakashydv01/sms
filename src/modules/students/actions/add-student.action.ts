"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { createStudent, type CreateStudentResult } from "./create-student";

export async function addStudentAction(
  formData: FormData
): Promise<CreateStudentResult> {
  const input = {
    firstName: String(formData.get("firstName") ?? ""),
    lastName: String(formData.get("lastName") ?? ""),
    dateOfBirth: String(formData.get("dateOfBirth") ?? ""),
    gender: String(formData.get("gender") ?? ""),
    classId: String(formData.get("classId") ?? ""),
    sectionId: String(formData.get("sectionId") ?? ""),
    guardianName: String(formData.get("guardianName") ?? ""),
    guardianPhone: String(formData.get("guardianPhone") ?? ""),
    guardianEmail: String(formData.get("guardianEmail") ?? ""),
    fatherName: String(formData.get("fatherName") ?? ""),
    motherName: String(formData.get("motherName") ?? ""),
    address: String(formData.get("address") ?? ""),
    admissionDate: String(formData.get("admissionDate") ?? ""),
  };

  const session = await auth();
  const schoolId = session?.user.schoolId;

  if (!schoolId) {
    return {
      success: false,
      errors: { form: "You must be signed in to a school to add a student." },
    };
  }

  const result = await createStudent(schoolId, input as never);

  if (result.success) {
    revalidatePath("/students");
  }

  return result;
}
