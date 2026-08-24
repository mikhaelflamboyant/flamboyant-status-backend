CREATE TABLE "ProjectPriority" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProjectPriority_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProjectPriority_user_id_project_id_key" ON "ProjectPriority"("user_id", "project_id");
CREATE INDEX "ProjectPriority_user_id_position_idx" ON "ProjectPriority"("user_id", "position");

ALTER TABLE "ProjectPriority" ADD CONSTRAINT "ProjectPriority_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectPriority" ADD CONSTRAINT "ProjectPriority_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
