CREATE TABLE "TaskAssignee" (
  "id" TEXT NOT NULL,
  "task_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  CONSTRAINT "TaskAssignee_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "TaskAssignee" ADD CONSTRAINT "TaskAssignee_task_id_fkey"
  FOREIGN KEY ("task_id") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TaskAssignee" ADD CONSTRAINT "TaskAssignee_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "TaskAssignee_task_id_user_id_key" ON "TaskAssignee"("task_id", "user_id");

CREATE TABLE "ScopeItemAssignee" (
  "id" TEXT NOT NULL,
  "scope_item_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  CONSTRAINT "ScopeItemAssignee_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ScopeItemAssignee" ADD CONSTRAINT "ScopeItemAssignee_scope_item_id_fkey"
  FOREIGN KEY ("scope_item_id") REFERENCES "ScopeItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ScopeItemAssignee" ADD CONSTRAINT "ScopeItemAssignee_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "ScopeItemAssignee_scope_item_id_user_id_key" ON "ScopeItemAssignee"("scope_item_id", "user_id");
