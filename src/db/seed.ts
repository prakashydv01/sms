import "dotenv/config";
import bcrypt from "bcryptjs";
import { db } from "./index";
import { schools, academicYears, classes, sections, users } from "./schema";

async function seed() {
  console.log("Seeding database...");

  const [school] = await db
    .insert(schools)
    .values({
      name: "Green Valley School",
      address: "123 Main Street",
      email: "admin@greenvalley.edu",
    })
    .returning();

  const [year] = await db
    .insert(academicYears)
    .values({
      schoolId: school.id,
      name: "2026-2027",
      startDate: "2026-04-01",
      endDate: "2027-03-31",
      isCurrent: true,
    })
    .returning();

  const classNames = ["Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5"];
  for (const name of classNames) {
    const [cls] = await db
      .insert(classes)
      .values({ schoolId: school.id, academicYearId: year.id, name })
      .returning();

    await db.insert(sections).values([
      { classId: cls.id, name: "A" },
      { classId: cls.id, name: "B" },
    ]);
  }

  console.log(`Seeded school: ${school.name} (${school.id})`);
  console.log(`Seeded academic year: ${year.name}`);
  console.log(`Seeded ${classNames.length} classes with sections A & B each.`);

  const adminEmail = "admin@greenvalley.edu";
  const adminPassword = "admin123";
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  await db.insert(users).values({
    schoolId: school.id,
    name: "School Admin",
    email: adminEmail,
    passwordHash,
    role: "school_admin",
  });

  console.log(`Seeded admin login: ${adminEmail} / ${adminPassword}`);
  console.log("(change this password before using real data)");

  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
