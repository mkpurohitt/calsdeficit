import "server-only";
import type { Pool } from "pg";

let poolPromise: Promise<Pool> | null = null;

export function isCloudSqlConfigured(): boolean {
  return Boolean(
    process.env.CLOUD_SQL_CONNECTION_NAME &&
    process.env.CLOUD_SQL_DB &&
    process.env.CLOUD_SQL_USER
  );
}

/**
 * Lazy singleton Pool through the Cloud SQL connector (IAM-authenticated TLS,
 * no IP allowlisting). max=2 because each serverless instance gets its own pool.
 */
export async function getPool(): Promise<Pool> {
  if (!poolPromise) {
    poolPromise = (async () => {
      const [{ Connector }, pg, { GoogleAuth }] = await Promise.all([
        import("@google-cloud/cloud-sql-connector"),
        import("pg"),
        import("google-auth-library"),
      ]);

      const b64 = process.env.GCP_SERVICE_ACCOUNT_B64;
      const connector = new Connector(
        b64
          ? {
              auth: new GoogleAuth({
                credentials: JSON.parse(Buffer.from(b64, "base64").toString("utf8")),
                scopes: ["https://www.googleapis.com/auth/sqlservice.admin"],
              }),
            }
          : undefined
      );

      const clientOpts = await connector.getOptions({
        instanceConnectionName: process.env.CLOUD_SQL_CONNECTION_NAME!,
      });

      return new pg.Pool({
        ...clientOpts,
        database: process.env.CLOUD_SQL_DB,
        user: process.env.CLOUD_SQL_USER,
        password: process.env.CLOUD_SQL_PASSWORD,
        max: 2,
        idleTimeoutMillis: 30_000,
      });
    })().catch((error) => {
      poolPromise = null;
      throw error;
    });
  }
  return poolPromise;
}

export async function sql<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  const pool = await getPool();
  const result = await pool.query(text, params);
  return result.rows as T[];
}
