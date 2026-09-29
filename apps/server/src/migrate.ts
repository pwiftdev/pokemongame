import { migrate, pool } from "./db.js";
await migrate();
console.log(
  "Database schema is ready. Game content is seeded from the shared catalog.",
);
await pool.end();
