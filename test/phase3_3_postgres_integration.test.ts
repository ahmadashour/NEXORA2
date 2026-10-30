/**
 * NEXORA Phase 3.3 — Isolated PostgreSQL Integration & Real Persistence Verification
 * 
 * Executes real end-to-end database operations against an isolated PostgreSQL 15 instance.
 * Covers Scenarios A through L including multi-process cold restarts.
 */

import http from 'http';
import { fork, ChildProcess } from 'child_process';
import path from 'path';
import pg from 'pg';
import { runMigrations } from '../db/migrate';
import { createExpressApp } from '../server/app';
import { db } from '../server/db';
import { checkPostgresConnection, closePostgresPool } from '../server/db/postgres';

interface Phase33Result {
  id: string;
  name: string;
  category: string;
  passed: boolean;
  classification: 'Real PostgreSQL' | 'Process Cold Start' | 'Architecture Contract' | 'Skipped';
  evidence: string;
  error?: string;
  durationMs: number;
}

const testResults: Phase33Result[] = [];

const TEST_DB_URL = process.env.TEST_DATABASE_URL || 'postgresql://node@127.0.0.1:5433/nexora_test_db';

// Ensure safety: never touch production
function assertSafeTestDatabase(url: string) {
  if (
    url.includes('ashouracademy.com') ||
    url.includes('hostinger') ||
    url.includes('prod') ||
    url.includes('production')
  ) {
    throw new Error(`SAFETY HALT: Attempted to run test suite against dangerous URL: ${url}`);
  }
}

async function startServer(port = 0, envOverrides: Record<string, string> = {}): Promise<{ server: http.Server; baseUrl: string; port: number }> {
  // Set environment
  Object.entries(envOverrides).forEach(([k, v]) => {
    process.env[k] = v;
  });

  const app = createExpressApp();
  const server = http.createServer(app);

  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      const addr = server.address() as { port: number };
      resolve({ server, baseUrl: `http://127.0.0.1:${addr.port}`, port: addr.port });
    });
  });
}

/**
 * Spawns an isolated child Node.js process running a dedicated test command
 * to verify genuine cross-process cold start persistence with zero shared memory.
 */
function runIsolatedProcess(scriptContent: string, env: Record<string, string> = {}): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const child = fork(
      '-e',
      [scriptContent],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          DATABASE_URL: TEST_DB_URL,
          NODE_ENV: 'test',
          DB_SSL: 'false',
          ALLOW_INSECURE_DEV_MEMORY: 'false',
          ...env,
        },
        stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
      }
    );

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (d) => { stdout += d.toString(); });
    child.stderr?.on('data', (d) => { stderr += d.toString(); });

    child.on('close', (exitCode) => {
      resolve({ stdout, stderr, exitCode: exitCode ?? 0 });
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
}

function extractJson<T = any>(raw: string): T {
  const marker = '__JSON_START__';
  const endMarker = '__JSON_END__';
  const startIdx = raw.indexOf(marker);
  const endIdx = raw.indexOf(endMarker);
  if (startIdx !== -1 && endIdx !== -1) {
    const jsonStr = raw.substring(startIdx + marker.length, endIdx);
    return JSON.parse(jsonStr);
  }
  const lastBrace = raw.lastIndexOf('}');
  const firstBrace = raw.lastIndexOf('{', lastBrace - 1);
  if (firstBrace !== -1 && lastBrace !== -1) {
    return JSON.parse(raw.substring(firstBrace, lastBrace + 1));
  }
  throw new Error(`Cannot find valid JSON in output: "${raw}"`);
}

async function recordResult(
  id: string,
  name: string,
  category: string,
  classification: Phase33Result['classification'],
  fn: () => Promise<string>
): Promise<void> {
  const start = Date.now();
  try {
    const evidence = await fn();
    const durationMs = Date.now() - start;
    testResults.push({ id, name, category, passed: true, classification, evidence, durationMs });
    console.log(`[PASS] [${id}] [${classification}] ${name} (${durationMs}ms)`);
    console.log(`       ↳ Evidence: ${evidence}`);
  } catch (err: unknown) {
    const durationMs = Date.now() - start;
    const msg = err instanceof Error ? err.message : String(err);
    testResults.push({ id, name, category, passed: false, classification, evidence: 'Failed', error: msg, durationMs });
    console.error(`[FAIL] [${id}] [${classification}] ${name} (${durationMs}ms)`);
    console.error(`       ↳ Error: ${msg}`);
  }
}

async function main() {
  console.log('================================================================================');
  console.log('  NEXORA PHASE 3.3 — ISOLATED POSTGRESQL INTEGRATION & PERSISTENCE VERIFICATION');
  console.log('================================================================================\n');

  assertSafeTestDatabase(TEST_DB_URL);
  process.env.DATABASE_URL = TEST_DB_URL;
  process.env.DB_SSL = 'false';

  // Verify PostgreSQL accessibility
  const diag = await checkPostgresConnection();
  console.log(`[TARGET DATABASE] URL: ${TEST_DB_URL}`);
  console.log(`[TARGET DATABASE] Configured: ${diag.isConfigured}, Reachable: ${diag.isReachable}`);
  if (diag.serverVersion) {
    console.log(`[TARGET DATABASE] Version: ${diag.serverVersion.trim()}`);
    console.log(`[TARGET DATABASE] Latency: ${diag.latencyMs}ms\n`);
  }

  if (!diag.isReachable) {
    console.error('[CRITICAL] Target PostgreSQL database is not reachable!');
    console.error(`Reason: ${diag.error}`);
    console.error('Phase 3.3 requires a live PostgreSQL instance for full verification.');
    process.exit(1);
  }

  const uniqueId = Date.now();
  const testEmail = `sci.lead.${uniqueId}@ashouracademy.com`;
  const initialPassword = 'SecurePassword2026!';
  const updatedPassword = 'NewSecretPassword2026#';
  let createdUserId = '';
  let activeToken = '';

  // ---------------------------------------------------------------------------
  // SCENARIO A: DDL Migration on Clean Database
  // ---------------------------------------------------------------------------
  await recordResult(
    'SCENARIO-A',
    'تنفيذ الـ Migration الفعلي والتحقق من الجداول السبعة والأدوار الستة',
    'Database Migration',
    'Real PostgreSQL',
    async () => {
      const migrationRes = await runMigrations(TEST_DB_URL);
      if (!migrationRes.success) {
        throw new Error(`Migration failed: ${migrationRes.message}`);
      }

      // Query raw postgres pool to inspect verified tables & roles
      const { Pool } = pg;
      const testPool = new Pool({ connectionString: TEST_DB_URL, ssl: false });
      try {
        const tableQuery = await testPool.query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
            AND table_name IN ('roles', 'permissions', 'role_permissions', 'users', 'user_profiles', 'activity_logs', 'revoked_tokens')
          ORDER BY table_name;
        `);
        const tables = tableQuery.rows.map((r: { table_name: string }) => r.table_name);

        const rolesQuery = await testPool.query('SELECT code, name FROM roles ORDER BY code;');
        const roleCodes = rolesQuery.rows.map((r: { code: string }) => r.code);

        if (tables.length !== 7) {
          throw new Error(`Expected 7 tables, found ${tables.length}: ${tables.join(', ')}`);
        }
        if (rolesQuery.rows.length < 6) {
          throw new Error(`Expected 6 default roles, found ${rolesQuery.rows.length}`);
        }

        return `Migration applied. 7 Tables: [${tables.join(', ')}]. 6 Roles: [${roleCodes.join(', ')}].`;
      } finally {
        await testPool.end();
      }
    }
  );

  // ---------------------------------------------------------------------------
  // SCENARIO B: Atomic Registration Transaction (createUserWithProfile)
  // ---------------------------------------------------------------------------
  await recordResult(
    'SCENARIO-B',
    'إنشاء مستخدم وملفه الشخصي في Transaction واحدة ذرية في PostgreSQL',
    'Atomic Transaction',
    'Real PostgreSQL',
    async () => {
      const { server, baseUrl } = await startServer(0, { DATABASE_URL: TEST_DB_URL });
      try {
        const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: testEmail,
            password: initialPassword,
            fullName: 'أ. د. بدر الصباح',
            role: 'LEAD',
            school: 'ثانوية جابر الأحمد',
            district: 'حولي التعليمية',
          }),
        });

        const data = await res.json();
        if (res.status !== 201 || !data.token || !data.user?.id) {
          throw new Error(`Registration failed (${res.status}): ${JSON.stringify(data)}`);
        }

        createdUserId = data.user.id;
        activeToken = data.token;

        // Directly query PostgreSQL to verify transactional integrity across both tables
        const { Pool } = pg;
        const testPool = new Pool({ connectionString: TEST_DB_URL, ssl: false });
        try {
          const userRow = await testPool.query('SELECT id, email, role_id, is_active FROM users WHERE id = $1', [createdUserId]);
          const profileRow = await testPool.query('SELECT id, user_id, full_name, school_or_org, district FROM user_profiles WHERE user_id = $1', [createdUserId]);

          if (userRow.rows.length !== 1 || profileRow.rows.length !== 1) {
            throw new Error('Database rows missing after atomic transaction commit');
          }

          return `Atomic transaction committed to PostgreSQL: User ID=${userRow.rows[0].id}, Email=${userRow.rows[0].email}, Profile FullName="${profileRow.rows[0].full_name}", School="${profileRow.rows[0].school_or_org}".`;
        } finally {
          await testPool.end();
        }
      } finally {
        server.close();
      }
    }
  );

  // ---------------------------------------------------------------------------
  // SCENARIO C: Duplicate Email Unique Constraint Rejection (409 Conflict)
  // ---------------------------------------------------------------------------
  await recordResult(
    'SCENARIO-C',
    'رفض البريد المكرر عبر Unique Constraint في PostgreSQL (Error 23505 -> 409)',
    'Data Integrity',
    'Real PostgreSQL',
    async () => {
      const { server, baseUrl } = await startServer(0, { DATABASE_URL: TEST_DB_URL });
      try {
        const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: testEmail,
            password: 'AnyPassword123!',
            fullName: 'محاولة تسجيل مكررة',
            role: 'TEACH',
          }),
        });

        if (res.status !== 409) {
          throw new Error(`Expected 409 Conflict for duplicate email, got ${res.status}`);
        }
        const data = await res.json();
        if (data.error !== 'EMAIL_ALREADY_EXISTS') {
          throw new Error(`Expected error EMAIL_ALREADY_EXISTS, got ${data.error}`);
        }

        return `Duplicate email rejected: PostgreSQL unique index violation caught and returned 409 Conflict (EMAIL_ALREADY_EXISTS).`;
      } finally {
        server.close();
      }
    }
  );

  // ---------------------------------------------------------------------------
  // SCENARIO D: Cold Start & Process Restart Persistence
  // ---------------------------------------------------------------------------
  await recordResult(
    'SCENARIO-D',
    'استمرارية تسجيل الدخول بعد إعادة تشغيل عملية Node.js بالكامل (Cold Start)',
    'Process Isolation / Cold Start',
    'Process Cold Start',
    async () => {
      // Execute authentication in a completely separate child Node.js process
      const childScript = `
        const http = require('http');
        const { createExpressApp } = require('./server/app');
        
        async function run() {
          const app = createExpressApp();
          const server = http.createServer(app);
          server.listen(0, '127.0.0.1', async () => {
            const addr = server.address();
            const res = await fetch(\`http://127.0.0.1:\${addr.port}/api/v1/auth/login\`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: '${testEmail}',
                password: '${initialPassword}',
              }),
            });
            const body = await res.json();
            server.close();
            if (res.status === 200 && body.token) {
              console.log('__JSON_START__' + JSON.stringify({ success: true, token: body.token, user: body.user }) + '__JSON_END__');
              process.exit(0);
            } else {
              console.error(JSON.stringify({ success: false, status: res.status, body }));
              process.exit(1);
            }
          });
        }
        run();
      `;

      const result = await runIsolatedProcess(childScript);
      if (result.exitCode !== 0) {
        throw new Error(`Isolated process login failed (code ${result.exitCode}): ${result.stderr}`);
      }

      const parsed = extractJson<{ token: string; user: { id: string } }>(result.stdout);
      activeToken = parsed.token;

      return `Cold start verified: Child Node process (zero shared RAM) loaded user from PostgreSQL, verified bcrypt hash, and returned JWT token. User ID: ${parsed.user.id}.`;
    }
  );

  // ---------------------------------------------------------------------------
  // SCENARIO E: User Profile Retrieval Across Process Restarts
  // ---------------------------------------------------------------------------
  await recordResult(
    'SCENARIO-E',
    'تحديث واسترجاع الملف الشخصي عبر عمليات Node.js منفصلة',
    'User Management',
    'Process Cold Start',
    async () => {
      const updatedBio = 'موجه أول لمادة الكيمياء - متابعة التعليم الثانوي 2026';

      // Step 1: Update in isolated process
      const updateScript = `
        const http = require('http');
        const { createExpressApp } = require('./server/app');
        async function run() {
          const app = createExpressApp();
          const server = http.createServer(app);
          server.listen(0, '127.0.0.1', async () => {
            const addr = server.address();
            const res = await fetch(\`http://127.0.0.1:\${addr.port}/api/v1/users/profile\`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ${activeToken}',
              },
              body: JSON.stringify({
                full_name: 'أ. د. بدر الصباح (محدث)',
                bio: '${updatedBio}',
              }),
            });
            server.close();
            process.exit(res.status === 200 ? 0 : 1);
          });
        }
        run();
      `;
      const updateRes = await runIsolatedProcess(updateScript);
      if (updateRes.exitCode !== 0) {
        throw new Error(`Profile update in child process failed: ${updateRes.stderr}`);
      }

      // Step 2: Read in a SECOND isolated process
      const readScript = `
        const http = require('http');
        const { createExpressApp } = require('./server/app');
        async function run() {
          const app = createExpressApp();
          const server = http.createServer(app);
          server.listen(0, '127.0.0.1', async () => {
            const addr = server.address();
            const res = await fetch(\`http://127.0.0.1:\${addr.port}/api/v1/users/profile\`, {
              headers: { 'Authorization': 'Bearer ${activeToken}' },
            });
            const data = await res.json();
            server.close();
            if (res.status === 200 && data.profile) {
              console.log('__JSON_START__' + JSON.stringify(data.profile) + '__JSON_END__');
              process.exit(0);
            } else {
              process.exit(1);
            }
          });
        }
        run();
      `;
      const readRes = await runIsolatedProcess(readScript);
      if (readRes.exitCode !== 0) {
        throw new Error(`Profile read in child process failed: ${readRes.stderr}`);
      }

      const profile = extractJson<{ bio: string }>(readRes.stdout);
      if (profile.bio !== updatedBio) {
        throw new Error(`Expected bio "${updatedBio}", got "${profile.bio}"`);
      }

      return `Cross-process profile persistence verified: Process A updated user_profiles in PostgreSQL, Process B retrieved updated bio: "${profile.bio}".`;
    }
  );

  // ---------------------------------------------------------------------------
  // SCENARIO F: Password Update & Hash Persistence Across Process Restarts
  // ---------------------------------------------------------------------------
  await recordResult(
    'SCENARIO-F',
    'تحديث كلمة المرور واستمرار التشفير الجديد بعد إعادة التشغيل',
    'Authentication',
    'Process Cold Start',
    async () => {
      // Step 1: Change password in child process
      const changeScript = `
        const http = require('http');
        const { createExpressApp } = require('./server/app');
        async function run() {
          const app = createExpressApp();
          const server = http.createServer(app);
          server.listen(0, '127.0.0.1', async () => {
            const addr = server.address();
            const res = await fetch(\`http://127.0.0.1:\${addr.port}/api/v1/auth/change-password\`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ${activeToken}',
              },
              body: JSON.stringify({
                currentPassword: '${initialPassword}',
                newPassword: '${updatedPassword}',
              }),
            });
            server.close();
            process.exit(res.status === 200 ? 0 : 1);
          });
        }
        run();
      `;
      const changeRes = await runIsolatedProcess(changeScript);
      if (changeRes.exitCode !== 0) {
        throw new Error(`Password change failed: ${changeRes.stderr}`);
      }

      // Step 2: Verify old password fails and new password succeeds in a FRESH child process
      const verifyScript = `
        const http = require('http');
        const { createExpressApp } = require('./server/app');
        async function run() {
          const app = createExpressApp();
          const server = http.createServer(app);
          server.listen(0, '127.0.0.1', async () => {
            const addr = server.address();
            // Test Old Password (MUST FAIL)
            const oldRes = await fetch(\`http://127.0.0.1:\${addr.port}/api/v1/auth/login\`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: '${testEmail}', password: '${initialPassword}' }),
            });

            // Test New Password (MUST SUCCEED)
            const newRes = await fetch(\`http://127.0.0.1:\${addr.port}/api/v1/auth/login\`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: '${testEmail}', password: '${updatedPassword}' }),
            });
            const newData = await newRes.json();
            server.close();

            if (oldRes.status === 401 && newRes.status === 200 && newData.token) {
              console.log('__JSON_START__' + JSON.stringify({ newToken: newData.token }) + '__JSON_END__');
              process.exit(0);
            } else {
              process.exit(1);
            }
          });
        }
        run();
      `;
      const verifyRes = await runIsolatedProcess(verifyScript);
      if (verifyRes.exitCode !== 0) {
        throw new Error(`Password persistence verification failed in cold process`);
      }

      const verifyData = extractJson<{ newToken: string }>(verifyRes.stdout);
      activeToken = verifyData.newToken;

      return `Password change verified across processes: old password rejected (401), new password authenticated (200), bcrypt hash updated in PostgreSQL.`;
    }
  );

  // ---------------------------------------------------------------------------
  // SCENARIO G: User Deactivation Across Process Restarts
  // ---------------------------------------------------------------------------
  await recordResult(
    'SCENARIO-G',
    'تعطيل المستخدم في PostgreSQL ومنع الدخول بعد إعادة التشغيل',
    'Access Control',
    'Process Cold Start',
    async () => {
      // Step 1: Deactivate directly in PostgreSQL
      const { Pool } = pg;
      const testPool = new Pool({ connectionString: TEST_DB_URL, ssl: false });
      try {
        await testPool.query('UPDATE users SET is_active = FALSE WHERE id = $1', [createdUserId]);
      } finally {
        await testPool.end();
      }

      // Step 2: In a fresh child process, test that login and /me are blocked
      const deactScript = `
        const http = require('http');
        const { createExpressApp } = require('./server/app');
        async function run() {
          const app = createExpressApp();
          const server = http.createServer(app);
          server.listen(0, '127.0.0.1', async () => {
            const addr = server.address();
            const loginRes = await fetch(\`http://127.0.0.1:\${addr.port}/api/v1/auth/login\`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: '${testEmail}', password: '${updatedPassword}' }),
            });

            const meRes = await fetch(\`http://127.0.0.1:\${addr.port}/api/v1/auth/me\`, {
              headers: { 'Authorization': 'Bearer ${activeToken}' },
            });

            server.close();
            if (loginRes.status === 403 && meRes.status === 401) {
              process.exit(0);
            } else {
              process.exit(1);
            }
          });
        }
        run();
      `;
      const deactRes = await runIsolatedProcess(deactScript);
      if (deactRes.exitCode !== 0) {
        throw new Error(`Deactivation check failed in isolated process`);
      }

      // Step 3: Reactivate user for subsequent tests
      const pool2 = new Pool({ connectionString: TEST_DB_URL, ssl: false });
      try {
        await pool2.query('UPDATE users SET is_active = TRUE WHERE id = $1', [createdUserId]);
      } finally {
        await pool2.end();
      }

      return `Account deactivation verified across processes: login blocked with 403 (ACCOUNT_SUSPENDED), /me blocked with 401 (USER_INACTIVE). Reactivated.`;
    }
  );

  // ---------------------------------------------------------------------------
  // SCENARIO H: Token Revocation Persistence Across Process Restarts
  // ---------------------------------------------------------------------------
  await recordResult(
    'SCENARIO-H',
    'إبطال الجلسة وتخزين الرمز في revoked_tokens والتحقق منه في عملية جديدة',
    'Session Revocation',
    'Process Cold Start',
    async () => {
      // Step 1: Process A calls logout
      const logoutScript = `
        const http = require('http');
        const { createExpressApp } = require('./server/app');
        async function run() {
          const app = createExpressApp();
          const server = http.createServer(app);
          server.listen(0, '127.0.0.1', async () => {
            const addr = server.address();
            const res = await fetch(\`http://127.0.0.1:\${addr.port}/api/v1/auth/logout\`, {
              method: 'POST',
              headers: { 'Authorization': 'Bearer ${activeToken}' },
            });
            server.close();
            if (res.status === 200) {
              process.exit(0);
            } else {
              const txt = await res.text();
              console.error('Logout failed: ' + res.status + ': ' + txt);
              process.exit(1);
            }
          });
        }
        run();
      `;
      const logoutRes = await runIsolatedProcess(logoutScript);
      if (logoutRes.exitCode !== 0) {
        throw new Error(`Logout failed in Process A: ${logoutRes.stderr}`);
      }

      // Step 2: Check PostgreSQL revoked_tokens table has the JTI
      const { Pool } = pg;
      const testPool = new Pool({ connectionString: TEST_DB_URL, ssl: false });
      try {
        const revokedQuery = await testPool.query('SELECT jti, user_id, expires_at FROM revoked_tokens WHERE user_id = $1', [createdUserId]);
        if (revokedQuery.rows.length === 0) {
          throw new Error('JTI was not recorded in PostgreSQL revoked_tokens table');
        }
      } finally {
        await testPool.end();
      }

      // Step 3: Process B tries to call /me using the revoked token -> MUST RETURN 401 TOKEN_REVOKED
      const revokedCheckScript = `
        const http = require('http');
        const { createExpressApp } = require('./server/app');
        async function run() {
          const app = createExpressApp();
          const server = http.createServer(app);
          server.listen(0, '127.0.0.1', async () => {
            const addr = server.address();
            const res = await fetch(\`http://127.0.0.1:\${addr.port}/api/v1/auth/me\`, {
              headers: { 'Authorization': 'Bearer ${activeToken}' },
            });
            const data = await res.json();
            server.close();
            if (res.status === 401 && data.error === 'TOKEN_REVOKED') {
              process.exit(0);
            } else {
              console.error(\`Revoked check failed: \${res.status}: \${JSON.stringify(data)}\`);
              process.exit(1);
            }
          });
        }
        run();
      `;
      const checkRes = await runIsolatedProcess(revokedCheckScript);
      if (checkRes.exitCode !== 0) {
        throw new Error(`Revoked token check failed in fresh process: ${checkRes.stderr}`);
      }

      return `Persistent revocation verified: JTI stored in revoked_tokens table. Fresh Process B queried DB and rejected token with 401 TOKEN_REVOKED.`;
    }
  );

  // ---------------------------------------------------------------------------
  // SCENARIO I: Roles and Permissions Retrieval directly from PostgreSQL
  // ---------------------------------------------------------------------------
  await recordResult(
    'SCENARIO-I',
    'قراءة الأدوار والصلاحيات من جداول roles و permissions في PostgreSQL',
    'RBAC',
    'Real PostgreSQL',
    async () => {
      const { server, baseUrl } = await startServer(0, { DATABASE_URL: TEST_DB_URL });
      try {
        const res = await fetch(`${baseUrl}/api/v1/portals`);
        if (res.status !== 200) {
          throw new Error(`Portals endpoint failed: ${res.status}`);
        }
        const data = await res.json();
        const portals = data.portals as Array<{ code: string; name: string }>;

        const expectedCodes = ['LEAD', 'PRO', 'TEACH', 'START', 'STUDENT', 'FAMILY'];
        for (const code of expectedCodes) {
          if (!portals.some(p => p.code === code)) {
            throw new Error(`Missing expected portal role: ${code}`);
          }
        }

        return `Retrieved ${portals.length} portal definitions and associated permissions from PostgreSQL roles table: [${portals.map(p => p.code).join(', ')}].`;
      } finally {
        server.close();
      }
    }
  );

  // ---------------------------------------------------------------------------
  // SCENARIO J: Activity Logs Insertion & Querying
  // ---------------------------------------------------------------------------
  await recordResult(
    'SCENARIO-J',
    'تسجيل النشاطات في جدول activity_logs واسترجاعها مرتبة زمنياً',
    'Audit Trail',
    'Real PostgreSQL',
    async () => {
      // Login again with new password to get fresh active token
      const { server, baseUrl } = await startServer(0, { DATABASE_URL: TEST_DB_URL });
      try {
        const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: testEmail, password: updatedPassword }),
        });
        const loginData = await loginRes.json();
        const freshToken = loginData.token;

        const logRes = await fetch(`${baseUrl}/api/v1/users/activity`, {
          headers: { 'Authorization': `Bearer ${freshToken}` },
        });
        if (logRes.status !== 200) {
          throw new Error(`Activity query failed: ${logRes.status}`);
        }
        const logData = await logRes.json();
        const logs = logData.logs;
        if (!logs || logs.length === 0) {
          throw new Error('No activity logs found');
        }

        return `Verified ${logs.length} activity audit log records in PostgreSQL. Latest action: "${logs[0].action}" at ${logs[0].created_at}.`;
      } finally {
        server.close();
      }
    }
  );

  // ---------------------------------------------------------------------------
  // SCENARIO K: Concurrency Race Condition Defense (Multiple simultaneous registrations)
  // ---------------------------------------------------------------------------
  await recordResult(
    'SCENARIO-K',
    'اختبار تزامن عمليات التسجيل لنفس البريد وحماية Unique Constraint في PostgreSQL',
    'Concurrency & ACID',
    'Real PostgreSQL',
    async () => {
      const concurrentEmail = `race.lead.${Date.now()}@ashouracademy.com`;
      const { server, baseUrl } = await startServer(0, { DATABASE_URL: TEST_DB_URL });

      try {
        // Send 10 concurrent requests at the exact same moment
        const promises = Array.from({ length: 10 }).map(() =>
          fetch(`${baseUrl}/api/v1/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: concurrentEmail,
              password: 'Password123!',
              fullName: 'مستخدم متزامن',
              role: 'TEACH',
            }),
          })
        );

        const responses = await Promise.all(promises);
        const statuses = responses.map(r => r.status);

        const created = statuses.filter(s => s === 201).length;
        const conflicts = statuses.filter(s => s === 409).length;

        if (created !== 1 || conflicts !== 9) {
          throw new Error(`Expected exactly 1 created (201) and 9 conflicts (409), got: ${statuses.join(', ')}`);
        }

        // Verify database has exactly 1 row in users and 1 row in user_profiles
        const { Pool } = pg;
        const testPool = new Pool({ connectionString: TEST_DB_URL, ssl: false });
        try {
          const userCount = await testPool.query('SELECT count(*) FROM users WHERE email = $1', [concurrentEmail]);
          if (parseInt(userCount.rows[0].count, 10) !== 1) {
            throw new Error(`Expected 1 user in PostgreSQL, found ${userCount.rows[0].count}`);
          }
        } finally {
          await testPool.end();
        }

        return `ACID isolation verified under concurrency: Exactly 1 transaction succeeded (201 Created), 9 caught by PostgreSQL unique constraint (409 Conflict). Verified 1 row in DB.`;
      } finally {
        server.close();
      }
    }
  );

  // ---------------------------------------------------------------------------
  // SCENARIO L: Production Fail-Fast & Database Unavailability
  // ---------------------------------------------------------------------------
  await recordResult(
    'SCENARIO-L',
    'استجابة 503 DATABASE_UNAVAILABLE فوراً عند انقطاع قاعدة البيانات ورفض التخزين المؤقت',
    'Fail-Fast & Safety',
    'Architecture Contract',
    async () => {
      // In production mode with unreachable DB URL
      const origEnv = process.env.NODE_ENV;
      const origUrl = process.env.DATABASE_URL;

      try {
        await closePostgresPool();
        process.env.NODE_ENV = 'production';
        process.env.DATABASE_URL = 'postgresql://fake_user:fake_pass@127.0.0.1:54399/unreachable_db';

        // Direct pool query fails fast with 503
        const { server, baseUrl } = await startServer(0, {
          NODE_ENV: 'production',
          DATABASE_URL: 'postgresql://fake_user:fake_pass@127.0.0.1:54399/unreachable_db',
        });

        try {
          const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: `failfast.${Date.now()}@ashouracademy.com`,
              password: 'Password123!',
              fullName: 'فحص انقطاع القاعدة',
              role: 'TEACH',
            }),
          });

          if (res.status !== 503) {
            throw new Error(`Expected 503 DATABASE_UNAVAILABLE, got ${res.status}`);
          }
          const body = await res.json();
          if (body.error !== 'DATABASE_UNAVAILABLE') {
            throw new Error(`Expected error code DATABASE_UNAVAILABLE, got ${body.error}`);
          }

          return `Fail-fast verified: Production strictly refuses memory fallback on unreachable PostgreSQL. Returns 503 DATABASE_UNAVAILABLE in ${res.headers.get('date')}.`;
        } finally {
          server.close();
          await closePostgresPool();
        }
      } finally {
        process.env.NODE_ENV = origEnv;
        process.env.DATABASE_URL = origUrl;
        await closePostgresPool();
      }
    }
  );

  // Summary
  console.log('\n================================================================================');
  console.log('  NEXORA PHASE 3.3 TEST EXECUTION AUDIT SUMMARY');
  console.log('================================================================================');
  const passed = testResults.filter(t => t.passed).length;
  const failed = testResults.filter(t => !t.passed).length;
  console.log(`TOTAL SCENARIOS: ${testResults.length} | PASSED: ${passed} | FAILED: ${failed}`);

  testResults.forEach(t => {
    console.log(`[${t.passed ? '✓' : '✗'}] ${t.id.padEnd(12)} [${t.classification.padEnd(25)}] ${t.name}`);
  });
  console.log('================================================================================\n');

  await closePostgresPool();

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

main().catch(err => {
  console.error('[FATAL RUNNER EXCEPTION]', err);
  process.exit(1);
});
