-- AlterTable
ALTER TABLE "StatusUpdate" ADD COLUMN     "reported_by_name" TEXT,
ALTER COLUMN "highlights" SET DEFAULT '',
ALTER COLUMN "next_steps" SET DEFAULT '';
