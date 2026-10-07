CREATE TABLE "fee_type_class_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fee_type_id" uuid NOT NULL,
	"class_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "fee_type_class_rates_fee_type_id_class_id_unique" UNIQUE("fee_type_id","class_id")
);
--> statement-breakpoint
ALTER TABLE "fee_payments" ADD COLUMN "receipt_number" text NOT NULL;--> statement-breakpoint
ALTER TABLE "fee_type_class_rates" ADD CONSTRAINT "fee_type_class_rates_fee_type_id_fee_types_id_fk" FOREIGN KEY ("fee_type_id") REFERENCES "public"."fee_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_type_class_rates" ADD CONSTRAINT "fee_type_class_rates_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;