-- CreateTable
CREATE TABLE "GoLiveHistory" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "changed_by" TEXT NOT NULL,
    "previous_date" TIMESTAMP(3) NOT NULL,
    "new_date" TIMESTAMP(3) NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoLiveHistory_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "GoLiveHistory" ADD CONSTRAINT "GoLiveHistory_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoLiveHistory" ADD CONSTRAINT "GoLiveHistory_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
