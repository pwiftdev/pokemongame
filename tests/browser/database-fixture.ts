import { test as base } from "@playwright/test";
import { pool } from "../../apps/server/src/db";

export const test = base.extend<{}, { database: void }>({
  database: [
    async ({}, use) => {
      try {
        await use();
      } finally {
        await pool.end();
      }
    },
    { scope: "worker", auto: true },
  ],
});
