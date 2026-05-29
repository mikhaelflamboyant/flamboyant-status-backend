CREATE TABLE "PhaseHistory" (
  "id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "changed_by" TEXT NOT NULL,
  "from_phase" TEXT NOT NULL,
  "to_phase" TEXT NOT NULL,
  "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PhaseHistory_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PhaseHistory" ADD CONSTRAINT "PhaseHistory_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PhaseHistory" ADD CONSTRAINT "PhaseHistory_changed_by_fkey"
  FOREIGN KEY ("changed_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
