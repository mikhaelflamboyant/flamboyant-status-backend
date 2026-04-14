-- DropIndex
DROP INDEX "ProjectMember_project_id_user_id_key";

-- DropIndex
DROP INDEX "ProjectRequester_project_id_user_id_type_key";

-- AlterTable
ALTER TABLE "ProjectMember" ADD COLUMN     "manual_area" TEXT,
ADD COLUMN     "manual_name" TEXT,
ALTER COLUMN "user_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ProjectRequester" ADD COLUMN     "manual_area" TEXT,
ADD COLUMN     "manual_name" TEXT,
ALTER COLUMN "user_id" DROP NOT NULL;
