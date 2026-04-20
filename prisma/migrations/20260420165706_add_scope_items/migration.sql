-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "scope_item_id" TEXT;

-- CreateTable
CREATE TABLE "ScopeItem" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "phase" TEXT,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "completion_pct" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScopeItem_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_scope_item_id_fkey" FOREIGN KEY ("scope_item_id") REFERENCES "ScopeItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScopeItem" ADD CONSTRAINT "ScopeItem_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
