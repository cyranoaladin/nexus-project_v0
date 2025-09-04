-- CreateTable
CREATE TABLE "public"."pricing" (
    "id" SERIAL NOT NULL,
    "service" TEXT NOT NULL,
    "variable" TEXT NOT NULL,
    "valeur" DOUBLE PRECISION NOT NULL,
    "devise" TEXT NOT NULL DEFAULT 'TND',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pricing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pricing_service_variable_key" ON "public"."pricing"("service", "variable");
