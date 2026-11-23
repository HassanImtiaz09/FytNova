import { getTableName, sql } from "drizzle-orm";
import { getDb } from "../db";
import * as schema from "../../drizzle/schema";

export async function databaseIsReady(): Promise<boolean> {
  try {
    const db = await getDb();
    if (!db) return false;
    const [rows] = await db.execute(sql`
      SELECT table_name AS name FROM information_schema.tables
      WHERE table_schema = DATABASE()
    `);
    if (!Array.isArray(rows)) return false;
    const names = new Set(rows.map((row) => (row as { name: string }).name));
    return Object.values(schema).every((table) => names.has(getTableName(table)));
  } catch {
    // Public health responses must not expose SQL errors or connection details.
    return false;
  }
}
