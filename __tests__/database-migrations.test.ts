import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { migrateDatabase, MigrationHistoryError } from "../server/_core/migrations";

const mocks = vi.hoisted(() => ({
  connect: vi.fn(), query: vi.fn(), end: vi.fn(), migrate: vi.fn(),
}));
vi.mock("mysql2/promise", () => ({ createConnection: mocks.connect }));
vi.mock("drizzle-orm/mysql2", () => ({ drizzle: () => ({}) }));
vi.mock("drizzle-orm/mysql2/migrator", () => ({ migrate: mocks.migrate }));
beforeEach(() => {
  mocks.connect.mockResolvedValue({ query: mocks.query, end: mocks.end });
  mocks.end.mockResolvedValue(undefined);
  mocks.migrate.mockResolvedValue(undefined);
});
afterEach(() => vi.resetAllMocks());

describe("versioned database migrations", () => {
  it("initializes a fresh database with the committed migrations", async () => {
    mocks.query.mockResolvedValueOnce([[], []]);
    await migrateDatabase("mysql://test@localhost/test");
    expect(mocks.migrate).toHaveBeenCalledWith({}, { migrationsFolder: "./drizzle" });
    expect(mocks.end).toHaveBeenCalledOnce();
  });
  it("allows a database with recorded migration history", async () => {
    mocks.query.mockResolvedValueOnce([[{ name: "users" }, { name: "__drizzle_migrations" }], []]);
    mocks.query.mockResolvedValueOnce([[{ id: 1 }], []]);
    await migrateDatabase("mysql://test@localhost/test");
    expect(mocks.migrate).toHaveBeenCalledOnce();
    expect(mocks.end).toHaveBeenCalledOnce();
  });
  it("refuses to alter existing tables with no migration history", async () => {
    mocks.query.mockResolvedValueOnce([[{ name: "users" }], []]);
    await expect(migrateDatabase("mysql://test@localhost/test")).rejects.toBeInstanceOf(MigrationHistoryError);
    expect(mocks.migrate).not.toHaveBeenCalled();
    expect(mocks.end).toHaveBeenCalledOnce();
  });
  it("refuses existing application tables with an empty migration journal", async () => {
    mocks.query.mockResolvedValueOnce([[{ name: "users" }, { name: "__drizzle_migrations" }], []]);
    mocks.query.mockResolvedValueOnce([[], []]);
    await expect(migrateDatabase("mysql://test@localhost/test")).rejects.toThrow("empty migration history");
    expect(mocks.migrate).not.toHaveBeenCalled();
    expect(mocks.end).toHaveBeenCalledOnce();
  });
  it("closes its connection if the migration fails", async () => {
    mocks.query.mockResolvedValueOnce([[], []]);
    mocks.migrate.mockRejectedValue(new Error("migration failed"));
    await expect(migrateDatabase("mysql://test@localhost/test")).rejects.toThrow("migration failed");
    expect(mocks.end).toHaveBeenCalledOnce();
  });
  it("requires an explicit database URL", async () => {
    await expect(migrateDatabase("")).rejects.toThrow("DATABASE_URL is required");
    expect(mocks.connect).not.toHaveBeenCalled();
  });
});
