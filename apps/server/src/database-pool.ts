import pg from "pg";

export function createDatabasePool(
  connectionString: string,
  options: pg.PoolConfig = {},
) {
  const pool = new pg.Pool({
    connectionString,
    max: 12,
    connectionTimeoutMillis: 3000,
    statement_timeout: 4000,
    lock_timeout: 2000,
    idle_in_transaction_session_timeout: 10000,
    query_timeout: 5000,
    ...options,
  });
  pool.on("error", (error) =>
    console.error("Idle database connection failed", {
      code: "code" in error ? error.code : undefined,
      message: error.message,
    }),
  );
  return pool;
}
