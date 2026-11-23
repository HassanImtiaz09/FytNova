import { createConnection, type RowDataPacket } from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";

export class MigrationHistoryError extends Error {}

export async function migrateDatabase(databaseUrl: string): Promise<void> {
  if (!databaseUrl.trim()) throw new MigrationHistoryError("DATABASE_URL is required for migrations");
  const connection = await createConnection(databaseUrl);
  try {
    const [tables] = await connection.query<RowDataPacket[]>(
      "SELECT table_name AS name FROM information_schema.tables WHERE table_schema = DATABASE()",
    );
    if (tables.length) {
      if (!tables.some((table) => table.name === "__drizzle_migrations")) {
        throw new MigrationHistoryError(
          "Existing database has no Drizzle migration history. Back up and reconcile its schema before deploying.",
        );
      }
      const [history] = await connection.query<RowDataPacket[]>(
        "SELECT id FROM __drizzle_migrations LIMIT 1",
      );
      if (!history.length && tables.some((table) => table.name !== "__drizzle_migrations")) {
        throw new MigrationHistoryError(
          "Existing tables have an empty migration history. Back up and reconcile the database before deploying.",
        );
      }
    }
    await migrate(drizzle(connection), { migrationsFolder: "./drizzle" });
  } finally {
    await connection.end();
  }
}
