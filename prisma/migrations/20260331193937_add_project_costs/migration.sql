-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "requester_name" TEXT NOT NULL DEFAULT '',
    "execution_type" TEXT NOT NULL DEFAULT 'INTERNA',
    "priority" INTEGER NOT NULL DEFAULT 3,
    "description" TEXT NOT NULL,
    "budget_planned" REAL,
    "budget_actual" REAL,
    "go_live" DATETIME NOT NULL,
    "current_phase" TEXT NOT NULL DEFAULT 'RECEBIDA',
    "traffic_light" TEXT NOT NULL DEFAULT 'VERDE',
    "completion_pct" INTEGER NOT NULL DEFAULT 0,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "archived_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "owner_id" TEXT,
    CONSTRAINT "Project_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Project" ("archived", "archived_at", "area", "budget_actual", "budget_planned", "completion_pct", "created_at", "current_phase", "description", "execution_type", "go_live", "id", "owner_id", "priority", "requester_name", "title", "traffic_light") SELECT "archived", "archived_at", "area", "budget_actual", "budget_planned", "completion_pct", "created_at", "current_phase", "description", "execution_type", "go_live", "id", "owner_id", "priority", "requester_name", "title", "traffic_light" FROM "Project";
DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
