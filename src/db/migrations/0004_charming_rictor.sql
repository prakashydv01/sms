CREATE TABLE "fee_package_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"package_id" uuid NOT NULL,
	"fee_type_id" uuid NOT NULL,
	CONSTRAINT "fee_package_items_package_id_fee_type_id_unique" UNIQUE("package_id","fee_type_id")
);
--> statement-breakpoint
CREATE TABLE "fee_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fee_package_items" ADD CONSTRAINT "fee_package_items_package_id_fee_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."fee_packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_package_items" ADD CONSTRAINT "fee_package_items_fee_type_id_fee_types_id_fk" FOREIGN KEY ("fee_type_id") REFERENCES "public"."fee_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_packages" ADD CONSTRAINT "fee_packages_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;