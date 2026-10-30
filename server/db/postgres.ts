import pg from 'pg';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

export interface PostgresConfig {
  connectionString?: string;
  isSupavisorTransactionMode?: boolean;
}

export function isValidPostgresUrl(url?: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  return trimmed.startsWith('postgres://') || trimmed.startsWith('postgresql://');
}

let pool: pg.Pool | null = null;

/**
 * Configure and initialize PostgreSQL Connection Pool
 * Optimized for Supabase Supavisor Transaction Pooler (Port 6543) and Hostinger hosting.
 * Supports TLS with custom CA certificate verification.
 */
export function getPostgresPool(): pg.Pool | null {
  const connectionString = process.env.DATABASE_URL;
  if (!isValidPostgresUrl(connectionString)) {
    return null;
  }

  if (pool) {
    return pool;
  }

  // Detect Supavisor Transaction Pooler (port 6543 or pooler hostname)
  const isTransactionPooler = connectionString.includes(':6543') || connectionString.includes('pooler.supabase.com');

  // SSL / TLS Configuration
  let sslConfig: pg.ConnectionConfig['ssl'] = false;
  const isProduction = process.env.NODE_ENV === 'production';
  const isSupabase = connectionString.includes('supabase.com');
  const requireSsl = isProduction || isSupabase || process.env.DB_SSL === 'true';

  if (requireSsl) {
    let caContent: string | undefined = process.env.DB_SSL_CA;
    if (!caContent && process.env.DB_SSL_CA_PATH && fs.existsSync(process.env.DB_SSL_CA_PATH)) {
      try {
        caContent = fs.readFileSync(process.env.DB_SSL_CA_PATH, 'utf-8');
      } catch (e) {
        console.warn('[POSTGRES WARNING] Failed to read DB_SSL_CA_PATH:', e);
      }
    }

    if (caContent) {
      sslConfig = {
        ca: caContent,
        rejectUnauthorized: true,
      };
    } else {
      // In production: strict certificate verification (rejectUnauthorized: true) is mandatory by default.
      // In development: can be configured via DB_SSL_REJECT_UNAUTHORIZED if using local self-signed certs.
      const rejectUnauthorized = isProduction
        ? (process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false')
        : (process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true');

      sslConfig = { rejectUnauthorized };
    }
  }

  pool = new Pool({
    connectionString,
    ssl: sslConfig,
    max: Number(process.env.DB_POOL_MAX || 10), // Safe maximum for Hostinger and Supabase Free Tier
    idleTimeoutMillis: 30000,                   // 30 seconds idle timeout
    connectionTimeoutMillis: 5000,               // 5 seconds connection timeout
    allowExitOnIdle: false,
  });

  pool.on('error', (err) => {
    console.error('[POSTGRES POOL ERROR] Unexpected client error:', err.message);
  });

  console.log(`[POSTGRES] Pool initialized. Supavisor Transaction Mode: ${isTransactionPooler ? 'Active (Port 6543)' : 'Standard'}`);
  return pool;
}

export class DatabaseUnavailableError extends Error {
  public statusCode = 503;
  constructor(message = 'DATABASE_UNAVAILABLE: تعذر الاتصال بقاعدة بيانات PostgreSQL الدائمة.') {
    super(message);
    this.name = 'DatabaseUnavailableError';
  }
}

function isConnectionError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const msg = err instanceof Error ? err.message : String(err);
  const code = 'code' in err ? String((err as { code: unknown }).code) : '';
  return (
    code === 'ECONNREFUSED' ||
    code === 'ENOTFOUND' ||
    code === 'ETIMEDOUT' ||
    code === 'EAI_AGAIN' ||
    code === '57P01' ||
    code === '57P02' ||
    code === '57P03' ||
    code === '08000' ||
    code === '08003' ||
    code === '08006' ||
    msg.includes('getaddrinfo') ||
    msg.includes('Connection terminated') ||
    msg.includes('timeout') ||
    msg.includes('connection error') ||
    msg.includes('closed')
  );
}

/**
 * Executes a parameterized SQL query safely.
 * Notice: We NEVER specify a query 'name' attribute here, ensuring 100% compatibility
 * with Supavisor Transaction Mode (Port 6543).
 */
export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<pg.QueryResult<T>> {
  const p = getPostgresPool();
  if (!p) {
    throw new DatabaseUnavailableError('DATABASE_UNAVAILABLE: DATABASE_URL is not configured. PostgreSQL pool is unavailable.');
  }

  try {
    const start = Date.now();
    const res = await p.query<T>(text, params);
    const duration = Date.now() - start;

    if (process.env.DEBUG_DB === 'true') {
      console.log(`[SQL QUERY] ${text.trim().substring(0, 60)}... (${duration}ms, ${res.rowCount} rows)`);
    }

    return res;
  } catch (err: unknown) {
    if (isConnectionError(err)) {
      console.error('[POSTGRES CONNECTION ERROR]', err instanceof Error ? err.message : err);
      throw new DatabaseUnavailableError('DATABASE_UNAVAILABLE: انقطع الاتصال بقاعدة بيانات PostgreSQL أثناء تنفيذ الاستعلام.');
    }
    throw err;
  }
}

/**
 * Executes a callback within a managed PostgreSQL transaction (BEGIN / COMMIT / ROLLBACK)
 */
export async function withTransaction<T>(
  callback: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const p = getPostgresPool();
  if (!p) {
    throw new DatabaseUnavailableError('DATABASE_UNAVAILABLE: DATABASE_URL is not configured. Cannot initiate database transaction.');
  }

  let client: pg.PoolClient;
  try {
    client = await p.connect();
  } catch (connErr: unknown) {
    console.error('[POSTGRES POOL CONNECT ERROR]', connErr instanceof Error ? connErr.message : connErr);
    throw new DatabaseUnavailableError('DATABASE_UNAVAILABLE: تعذر الحصول على اتصال من مجمع PostgreSQL.');
  }

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rbErr) {
      console.error('[POSTGRES TRANSACTION ROLLBACK ERROR]', rbErr);
    }
    if (isConnectionError(err)) {
      throw new DatabaseUnavailableError('DATABASE_UNAVAILABLE: انقطع الاتصال بقاعدة بيانات PostgreSQL أثناء تنفيذ المعاملة.');
    }
    throw err;
  } finally {
    client.release();
  }
}

export interface PostgresConnectionDiagnostic {
  isConfigured: boolean;
  isReachable: boolean;
  latencyMs?: number;
  serverVersion?: string;
  poolState?: {
    totalCount: number;
    idleCount: number;
    waitingCount: number;
  };
  error?: string;
}

/**
 * Truthfully checks PostgreSQL connectivity without masking errors or creating mock success
 */
export async function checkPostgresConnection(): Promise<PostgresConnectionDiagnostic> {
  const connectionString = process.env.DATABASE_URL;
  if (!isValidPostgresUrl(connectionString)) {
    return {
      isConfigured: false,
      isReachable: false,
      error: 'DATABASE_URL is unset or invalid. Application is running with isolated local fallback.',
    };
  }

  const p = getPostgresPool();
  if (!p) {
    return {
      isConfigured: true,
      isReachable: false,
      error: 'Failed to create PostgreSQL connection pool.',
    };
  }

  const start = Date.now();
  try {
    const res = await Promise.race([
      p.query('SELECT 1 as ping, version() as version'),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Connection check timed out after 3000ms')), 3000)
      ),
    ]);

    const latencyMs = Date.now() - start;
    const versionRow = res.rows[0] as { version?: string };

    return {
      isConfigured: true,
      isReachable: true,
      latencyMs,
      serverVersion: versionRow?.version,
      poolState: {
        totalCount: p.totalCount,
        idleCount: p.idleCount,
        waitingCount: p.waitingCount,
      },
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      isConfigured: true,
      isReachable: false,
      error: `PostgreSQL unreachable: ${errorMsg}`,
      poolState: {
        totalCount: p.totalCount,
        idleCount: p.idleCount,
        waitingCount: p.waitingCount,
      },
    };
  }
}

/**
 * Safely closes pool on application shutdown
 */
export async function closePostgresPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('[POSTGRES] Pool disconnected.');
  }
}
