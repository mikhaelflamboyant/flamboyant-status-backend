-- AlterTable
ALTER TABLE "ActivityLog" ADD COLUMN "project_name" TEXT NOT NULL DEFAULT '',
ADD COLUMN "previous_value" TEXT,
ADD COLUMN "new_value" TEXT,
ALTER COLUMN "project_id" DROP NOT NULL;

-- DropForeignKey
ALTER TABLE "ActivityLog" DROP CONSTRAINT "ActivityLog_project_id_fkey";

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "ActivityLog_created_at_idx" ON "ActivityLog"("created_at");

-- CreateIndex
CREATE INDEX "ActivityLog_user_id_created_at_idx" ON "ActivityLog"("user_id", "created_at");
