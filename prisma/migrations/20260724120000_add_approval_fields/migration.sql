ALTER TABLE "StatusUpdate" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'APROVADO';
ALTER TABLE "StatusUpdate" ADD COLUMN "pending_action" TEXT;
ALTER TABLE "StatusUpdate" ADD COLUMN "pending_data" JSONB;

ALTER TABLE "Task" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'APROVADO';
ALTER TABLE "Task" ADD COLUMN "pending_action" TEXT;
ALTER TABLE "Task" ADD COLUMN "pending_data" JSONB;

ALTER TABLE "Requirement" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'APROVADO';
ALTER TABLE "Requirement" ADD COLUMN "pending_action" TEXT;
ALTER TABLE "Requirement" ADD COLUMN "pending_data" JSONB;
