"use server";

import { db } from "@/db";
import { classes, sections } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function getCurrentAcademicYear(schoolId: string) {
  return db.query.academicYears.findFirst({
    where: (a, { eq, and }) => and(eq(a.schoolId, schoolId), eq(a.isCurrent, true)),
  });
}

export async function createClass(
  schoolId: string,
  academicYearId: string,
  name: string
): Promise<{ success: true } | { success: false; error: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { success: false, error: "Class name is required" };

  try {
    await db.insert(classes).values({ schoolId, academicYearId, name: trimmed });
  } catch {
    return { success: false, error: `A class named "${trimmed}" already exists` };
  }

  revalidatePath("/classes");
  revalidatePath("/students");
  revalidatePath("/fees");
  return { success: true };
}

export async function createSection(
  classId: string,
  name: string
): Promise<{ success: true } | { success: false; error: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { success: false, error: "Section name is required" };

  try {
    await db.insert(sections).values({ classId, name: trimmed });
  } catch {
    return { success: false, error: `A section named "${trimmed}" already exists in this class` };
  }

  revalidatePath("/classes");
  revalidatePath("/students");
  revalidatePath("/fees");
  return { success: true };
}

/**
 * Deletes a class outright - only allowed when no students are currently
 * in it. A class with students should have them moved/promoted out
 * first (see Promote class), rather than deleting the class and orphaning
 * their classId reference.
 */
export async function deleteClass(
  classId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const hasStudents = await db.query.students.findFirst({
    where: (s, { eq }) => eq(s.classId, classId),
  });
  if (hasStudents) {
    return {
      success: false,
      error: "This class has students in it - move or promote them out first before deleting the class.",
    };
  }

  await db.delete(classes).where(eq(classes.id, classId));
  revalidatePath("/classes");
  revalidatePath("/students");
  return { success: true };
}

export async function deleteSection(
  sectionId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const hasStudents = await db.query.students.findFirst({
    where: (s, { eq }) => eq(s.sectionId, sectionId),
  });
  if (hasStudents) {
    return {
      success: false,
      error: "This section has students in it - move them to another section first before deleting.",
    };
  }

  await db.delete(sections).where(eq(sections.id, sectionId));
  revalidatePath("/classes");
  revalidatePath("/students");
  return { success: true };
}
