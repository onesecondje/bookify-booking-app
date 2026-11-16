BEGIN;

-- UUID and integer equality in the GiST exclusion constraint require btree_gist.
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public;

CREATE TABLE "specialist_working_periods" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "business_id" UUID NOT NULL,
    "specialist_id" UUID NOT NULL,
    "weekday" INTEGER NOT NULL,
    "start_minute" INTEGER NOT NULL,
    "end_minute" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "specialist_working_periods_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "specialist_working_periods_weekday_check" CHECK ("weekday" BETWEEN 1 AND 7),
    CONSTRAINT "specialist_working_periods_minutes_check"
        CHECK ("start_minute" >= 0 AND "start_minute" < "end_minute" AND "end_minute" <= 1440),
    CONSTRAINT "specialist_working_periods_specialist_fkey"
        FOREIGN KEY ("business_id", "specialist_id") REFERENCES "specialists"("business_id", "id")
        ON DELETE RESTRICT ON UPDATE NO ACTION,
    CONSTRAINT "specialist_working_periods_no_overlap" EXCLUDE USING gist (
        "business_id" public.gist_uuid_ops WITH =,
        "specialist_id" public.gist_uuid_ops WITH =,
        "weekday" public.gist_int4_ops WITH =,
        int4range("start_minute", "end_minute", '[)') WITH &&
    )
);

CREATE INDEX "specialist_working_periods_lookup_idx"
    ON "specialist_working_periods"("business_id", "specialist_id", "weekday", "start_minute");

COMMIT;
