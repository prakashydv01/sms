CREATE TABLE "student_id_sequences" (
	"school_id" uuid PRIMARY KEY NOT NULL,
	"next_number" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "father_name" text;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "mother_name" text;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "extra_fields" jsonb;--> statement-breakpoint
ALTER TABLE "student_id_sequences" ADD CONSTRAINT "student_id_sequences_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;