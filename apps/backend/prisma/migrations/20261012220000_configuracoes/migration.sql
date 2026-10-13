CREATE TABLE "preferences" (
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "timezone" TEXT NOT NULL,
    "theme" TEXT NOT NULL,
    "personal_calendar" BOOLEAN NOT NULL DEFAULT true,
    "work_calendar" BOOLEAN NOT NULL DEFAULT true,
    "show_entries" BOOLEAN NOT NULL DEFAULT true,
    "categorize" TEXT NOT NULL,
    "pending_hours" INTEGER NOT NULL,
    "reminder" TEXT NOT NULL,
    "reminders" BOOLEAN NOT NULL DEFAULT true,
    "due_alerts" BOOLEAN NOT NULL DEFAULT true,
    "email_alerts" BOOLEAN NOT NULL DEFAULT false,
    "app_alerts" BOOLEAN NOT NULL DEFAULT true,
    "history" TEXT NOT NULL,

    CONSTRAINT "preferences_pkey" PRIMARY KEY ("tenant_id")
);
