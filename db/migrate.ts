import fs from 'fs';
import path from 'path';
import pg from 'pg';
import dotenv from 'dotenv';

import { isLoopbackHost } from '../server/db/postgres';

dotenv.config();

/**
 * NEXORA Phase 3.1.5B — Database Migration Runner
 * Safely executes DDL migrations on PostgreSQL / Supabase
 */
export async function runMigrations(databaseUrl?: string): Promise<{ success: boolean; message: string; tables: string[] }> {
  const connString = databaseUrl || process.env.DATABASE_URL;

  if (!connString) {
    return {
      success: false,
      message: 'DATABASE_URL is not configured. Migration cannot run without a valid PostgreSQL connection.',
      tables: [],
    };
  }

  const isLocal = isLoopbackHost(connString);
  const isProduction = process.env.NODE_ENV === 'production';
  const useSsl = isProduction
    ? !isLocal
    : (!isLocal && (process.env.DB_SSL === 'true' || connString.includes('supabase.com')));

  const { Pool } = pg;
  const pool = new Pool({
    connectionString: connString,
    ssl: useSsl
      ? {
          rejectUnauthorized: isProduction ? true : (process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true'),
        }
      : false,
    connectionTimeoutMillis: 10000,
  });

  const client = await pool.connect();

  try {
    console.log('[MIGRATION] Connected to PostgreSQL. Reading migration files...');
    const migrationFiles = [
      'db/migrations/001_core_schema.sql',
      'db/migrations/002_community_library_content.sql',
    ];

    await client.query('BEGIN');
    for (const file of migrationFiles) {
      const fullPath = path.resolve(process.cwd(), file);
      if (fs.existsSync(fullPath)) {
        console.log(`[MIGRATION] Applying ${file}...`);
        const sql = fs.readFileSync(fullPath, 'utf-8');
        await client.query(sql);
      }
    }
    await client.query('COMMIT');
    console.log('[MIGRATION] All schema migrations successfully applied.');

    // Verify existing tables (7 Core + 10 Domain = 17 Total)
    const expectedTables = [
      'roles', 'permissions', 'role_permissions', 'users', 'user_profiles', 'activity_logs', 'revoked_tokens',
      'community_posts', 'community_attachments', 'community_comments', 'community_likes', 'community_bookmarks',
      'library_resources', 'content_items', 'event_details', 'event_registrations', 'contact_inquiries'
    ];

    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name = ANY($1)
      ORDER BY table_name;
    `, [expectedTables]);

    const tables = res.rows.map(r => r.table_name);
    console.log(`[MIGRATION] Verified tables in database (${tables.length}/${expectedTables.length}):`, tables.join(', '));

    return {
      success: true,
      message: `Schema migration applied successfully with ${tables.length} tables verified.`,
      tables,
    };
  } catch (err: unknown) {
    await client.query('ROLLBACK').catch(() => {});
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[MIGRATION ERROR]', msg);
    return {
      success: false,
      message: `Migration failed: ${msg}`,
      tables: [],
    };
  } finally {
    client.release();
    await pool.end();
  }
}

// Allow direct CLI execution: tsx db/migrate.ts
if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.includes('migrate.ts')) {
  runMigrations().then(res => {
    console.log('[MIGRATION RESULT]', JSON.stringify(res, null, 2));
    process.exit(res.success ? 0 : 1);
  });
}
