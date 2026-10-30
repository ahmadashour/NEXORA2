import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

export interface PostgresConfig {
  connectionString?: string;
  isSupavisorTransactionMode?: boolean;
}

let pool: pg.Pool | null = null;

/**
 * Configure and initialize PostgreSQL Connection Pool
 * Optimized for Supabase Supavisor Transaction Pooler (Port 6543) and Hostinger hosting.
 */
export function getPostgresPool(): pg.Pool | null {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return null;
  }

  if (pool) {
    return pool;
  }

  // Detect Supavisor Transaction Pooler (port 6543 or pooler hostname)
  const isTransactionPooler = connectionString.includes(':6543') || connectionString.includes('pooler.supabase.com');
  
  // SSL Configuration
  // By default in Node.js, standard CA certificates validate Let's Encrypt / DigiCert.
  // When connecting to Supavisor, rejectUnauthorized should be false only if custom CA is not provided in env.
  const rejectUnauthorized = process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true';

  pool = new Pool({
    connectionString,
    ssl: process.env.NODE_ENV === 'production' || connectionString.includes('supabase.com')
      ? { rejectUnauthorized }
      : false,
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
    throw new Error('DATABASE_URL is not configured. PostgreSQL pool is unavailable.');
  }

  const start = Date.now();
  const res = await p.query<T>(text, params);
  const duration = Date.now() - start;

  if (process.env.DEBUG_DB === 'true') {
    console.log(`[SQL QUERY] ${text.trim().substring(0, 60)}... (${duration}ms, ${res.rowCount} rows)`);
  }

  return res;
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
