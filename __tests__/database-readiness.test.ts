import { afterEach, describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";
import * as schema from "../drizzle/schema";
import { databaseIsReady } from "../server/_core/readiness";

const mocks = vi.hoisted(() => ({ getDb: vi.fn(), execute: vi.fn() }));
vi.mock("../server/db", () => ({ getDb: mocks.getDb }));
afterEach(() => vi.resetAllMocks());

describe("database deployment readiness", () => {
  it("is not ready without a configured database", async () => {
    mocks.getDb.mockResolvedValue(null);
    expect(await databaseIsReady()).toBe(false);
  });
  it("is not ready when a connection fails", async () => {
    mocks.getDb.mockResolvedValue({ execute: mocks.execute });
    mocks.execute.mockRejectedValue(new Error("connection unavailable"));
    expect(await databaseIsReady()).toBe(false);
  });
  it("is not ready when application tables are missing", async () => {
    mocks.getDb.mockResolvedValue({ execute: mocks.execute });
    mocks.execute.mockResolvedValue([[{ name: "users" }], []]);
    expect(await databaseIsReady()).toBe(false);
  });
  it("is ready only when every modeled table is present", async () => {
    mocks.getDb.mockResolvedValue({ execute: mocks.execute });
    mocks.execute.mockResolvedValue([Object.values(schema).map((table) => ({ name: getTableName(table) })), []]);
    expect(await databaseIsReady()).toBe(true);
  });
});
