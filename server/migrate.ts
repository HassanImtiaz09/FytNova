import "dotenv/config";
import { migrateDatabase, MigrationHistoryError } from "./_core/migrations";

migrateDatabase(process.env.DATABASE_URL ?? "")
  .then(() => console.log("[db] Versioned migrations applied successfully"))
  .catch((error: unknown) => {
    if (error instanceof MigrationHistoryError) {
      console.error(`[db] ${error.message}`);
    } else {
      const code = (error as { code?: unknown })?.code;
      console.error("[db] Migration failed:", typeof code === "string" ? code : "DATABASE_ERROR");
    }
    process.exitCode = 1;
  });
