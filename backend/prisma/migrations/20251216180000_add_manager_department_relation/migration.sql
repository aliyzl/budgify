-- CreateTable
CREATE TABLE "manager_departments" (
    "id" SERIAL NOT NULL,
    "managerId" INTEGER NOT NULL,
    "departmentId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "manager_departments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "manager_departments_managerId_departmentId_key" ON "manager_departments"("managerId", "departmentId");

-- AddForeignKey
ALTER TABLE "manager_departments" ADD CONSTRAINT "manager_departments_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manager_departments" ADD CONSTRAINT "manager_departments_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate existing currentManagerId data to manager_departments
INSERT INTO "manager_departments" ("managerId", "departmentId", "createdAt")
SELECT "currentManagerId", "id", NOW()
FROM "departments"
WHERE "currentManagerId" IS NOT NULL
ON CONFLICT DO NOTHING;

