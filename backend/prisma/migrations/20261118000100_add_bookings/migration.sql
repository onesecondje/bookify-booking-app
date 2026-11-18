BEGIN;

-- Reuse the btree_gist extension installed by the working periods migration.
CREATE TABLE "bookings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "business_id" UUID NOT NULL,
    "specialist_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6) NOT NULL,
    "cancelled_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "bookings_interval_check" CHECK (
        isfinite("starts_at") AND isfinite("ends_at") AND "starts_at" < "ends_at"
    ),
    CONSTRAINT "bookings_specialist_fkey"
        FOREIGN KEY ("business_id", "specialist_id") REFERENCES "specialists"("business_id", "id")
        ON DELETE RESTRICT ON UPDATE NO ACTION,
    CONSTRAINT "bookings_service_fkey"
        FOREIGN KEY ("business_id", "service_id") REFERENCES "services"("business_id", "id")
        ON DELETE RESTRICT ON UPDATE NO ACTION,
    CONSTRAINT "bookings_no_active_overlap" EXCLUDE USING gist (
        "specialist_id" public.gist_uuid_ops WITH =,
        tstzrange("starts_at", "ends_at", '[)') WITH &&
    ) WHERE ("cancelled_at" IS NULL)
);

CREATE INDEX "bookings_specialist_start_idx" ON "bookings"("business_id", "specialist_id", "starts_at");
CREATE INDEX "bookings_service_idx" ON "bookings"("business_id", "service_id");

COMMIT;
