BEGIN;

-- CreateTable
CREATE TABLE "specialists" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "business_id" UUID NOT NULL,
    "name" TEXT NOT NULL CONSTRAINT "specialists_name_not_blank" CHECK (length(btrim("name")) > 0),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "specialists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "specialist_services" (
    "business_id" UUID NOT NULL,
    "specialist_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "specialist_services_pkey" PRIMARY KEY ("business_id","specialist_id","service_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "specialists_business_id_id_key" ON "specialists"("business_id", "id");

-- CreateIndex
CREATE INDEX "specialist_services_business_id_service_id_idx" ON "specialist_services"("business_id", "service_id");

-- CreateIndex
CREATE UNIQUE INDEX "services_business_id_id_key" ON "services"("business_id", "id");

-- AddForeignKey
ALTER TABLE "specialists" ADD CONSTRAINT "specialists_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "specialist_services" ADD CONSTRAINT "specialist_services_business_id_specialist_id_fkey" FOREIGN KEY ("business_id", "specialist_id") REFERENCES "specialists"("business_id", "id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "specialist_services" ADD CONSTRAINT "specialist_services_business_id_service_id_fkey" FOREIGN KEY ("business_id", "service_id") REFERENCES "services"("business_id", "id") ON DELETE RESTRICT ON UPDATE NO ACTION;

COMMIT;
