/*
  Warnings:

  - Added the required column `created_by` to the `ScopeItem` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ScopeItem" ADD COLUMN     "created_by" TEXT NOT NULL,
ADD COLUMN     "pending_action" TEXT,
ADD COLUMN     "pending_completion_pct" INTEGER,
ADD COLUMN     "pending_description" TEXT,
ADD COLUMN     "pending_end_date" TIMESTAMP(3),
ADD COLUMN     "pending_phase" TEXT,
ADD COLUMN     "pending_start_date" TIMESTAMP(3),
ADD COLUMN     "pending_title" TEXT,
ALTER COLUMN "status" SET DEFAULT 'RASCUNHO';

-- AddForeignKey
ALTER TABLE "ScopeItem" ADD CONSTRAINT "ScopeItem_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
