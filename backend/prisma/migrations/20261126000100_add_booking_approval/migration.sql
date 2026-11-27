BEGIN;

ALTER TABLE "bookings" ADD COLUMN "approved_at" TIMESTAMPTZ(6);

-- Existing bookings were confirmed when they were created, including those later cancelled.
UPDATE "bookings" SET "approved_at" = "created_at";

COMMIT;
