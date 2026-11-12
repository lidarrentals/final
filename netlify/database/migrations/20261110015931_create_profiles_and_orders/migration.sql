CREATE TABLE "customer_profiles" (
	"user_id" text PRIMARY KEY,
	"email" text NOT NULL,
	"full_name" text DEFAULT '' NOT NULL,
	"company" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"street1" text DEFAULT '' NOT NULL,
	"city" text DEFAULT '' NOT NULL,
	"state" text DEFAULT '' NOT NULL,
	"zip" text DEFAULT '' NOT NULL,
	"country" text DEFAULT 'CA' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY,
	"reference" text NOT NULL UNIQUE,
	"user_id" text,
	"customer_name" text DEFAULT '' NOT NULL,
	"customer_email" text DEFAULT '' NOT NULL,
	"customer_phone" text DEFAULT '' NOT NULL,
	"company" text DEFAULT '' NOT NULL,
	"shipping_address" text DEFAULT '' NOT NULL,
	"items" jsonb NOT NULL,
	"subtotal_cents" integer NOT NULL,
	"shipping_cents" integer DEFAULT 0 NOT NULL,
	"total_cents" integer NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"rental_start" text,
	"rental_end" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"stripe_session_id" text,
	"stripe_payment_intent_id" text,
	"stripe_receipt_url" text,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "orders_user_id_idx" ON "orders" ("user_id");--> statement-breakpoint
CREATE INDEX "orders_stripe_session_idx" ON "orders" ("stripe_session_id");