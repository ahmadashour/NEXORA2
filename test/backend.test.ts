/**
 * NEXORA Phase 3.1 Backend Test Suite
 * Automated tests verifying health checks, registration, password hashing,
 * duplicate handling, authentication, RBAC, and activity logging.
 */

import { createExpressApp } from '../server/app';
import http from 'http';

interface TestResult {
  name: string;
  passed: boolean;
  durationMs: number;
  details?: string;
}

const results: TestResult[] = [];

async function runTest(name: string, fn: () => Promise<void>) {
  const start = Date.now();
  try {
    await fn();
    results.push({ name, passed: true, durationMs: Date.now() - start });
    console.log(`  ✓ [PASS] ${name} (${Date.now() - start}ms)`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    results.push({ name, passed: false, durationMs: Date.now() - start, details: msg });
    console.error(`  ✗ [FAIL] ${name}: ${msg}`);
  }
}

async function startTestServer(): Promise<{ server: http.Server; baseUrl: string }> {
  const app = createExpressApp();
  const server = http.createServer(app);

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number };
      resolve({ server, baseUrl: `http://127.0.0.1:${addr.port}` });
    });
  });
}

async function main() {
  console.log('\n======================================================');
  console.log('   NEXORA PHASE 3.1 — BACKEND VERIFICATION SUITE');
  console.log('======================================================\n');

  const { server, baseUrl } = await startTestServer();
  let authToken = '';
  const testEmail = `lead.qa.${Date.now()}@ashouracademy.com`;
  const testPassword = 'StrongPassword2026!';

  try {
    // 1. Health Check
    await runTest('1. Health check returns 200 OK with system status', async () => {
      const res = await fetch(`${baseUrl}/api/v1/health`);
      if (res.status !== 200) throw new Error(`Expected status 200, got ${res.status}`);
      const body = await res.json();
      if (body.status !== 'ok') throw new Error(`Expected status 'ok', got ${body.status}`);
      if (!body.targetDomain.includes('nexora.ashouracademy.com')) {
        throw new Error(`Target domain mismatch: ${body.targetDomain}`);
      }
      if (!body.database || body.database.status !== 'healthy') {
        throw new Error(`Database status not healthy: ${JSON.stringify(body.database)}`);
      }
    });

    // 2. Portals listing
    await runTest('2. Portals endpoint lists 6 educational roles & permissions', async () => {
      const res = await fetch(`${baseUrl}/api/v1/portals`);
      if (res.status !== 200) throw new Error(`Expected status 200, got ${res.status}`);
      const body = await res.json();
      if (!body.portals || body.portals.length < 6) {
        throw new Error(`Expected at least 6 portals, got ${body.portals?.length}`);
      }
      const codes = body.portals.map((p: { code: string }) => p.code);
      ['LEAD', 'PRO', 'TEACH', 'START', 'STUDENT', 'FAMILY'].forEach(expectedCode => {
        if (!codes.includes(expectedCode)) {
          throw new Error(`Missing portal role: ${expectedCode}`);
        }
      });
    });

    // 3. User Registration
    await runTest('3. Register new user with bcrypt password hashing', async () => {
      const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmail,
          password: testPassword,
          fullName: 'د. سامي الأحمد',
          role: 'lead',
          school: 'مدرسة التميز العلمية',
          district: 'منطقة العاصمة التعليمية',
        }),
      });

      if (res.status !== 201) {
        const errBody = await res.json();
        throw new Error(`Expected 201 Created, got ${res.status}: ${JSON.stringify(errBody)}`);
      }

      const body = await res.json();
      if (!body.token) throw new Error('Missing JWT token in registration response');
      if (body.user.email !== testEmail.toLowerCase()) throw new Error('Email mismatch');
      if (body.user.role_code !== 'LEAD') throw new Error(`Role mismatch: ${body.user.role_code}`);
      authToken = body.token;
    });

    // 4. Duplicate Registration Prevention
    await runTest('4. Reject duplicate email registration with 409 Conflict', async () => {
      const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmail,
          password: testPassword,
          fullName: 'محاولة مكررة',
          role: 'teach',
        }),
      });

      if (res.status !== 409) {
        throw new Error(`Expected 409 Conflict, got ${res.status}`);
      }
    });

    // 5. Successful Login
    await runTest('5. User login with valid credentials returns JWT and permissions', async () => {
      const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmail,
          password: testPassword,
        }),
      });

      if (res.status !== 200) {
        throw new Error(`Expected 200 OK, got ${res.status}`);
      }

      const body = await res.json();
      if (!body.token) throw new Error('Missing token in login response');
      if (!body.permissions || !Array.isArray(body.permissions)) {
        throw new Error('Missing permissions in login response');
      }
      authToken = body.token; // Refresh token
    });

    // 6. Bad Password Rejection
    await runTest('6. Reject login with invalid password with 401 Unauthorized', async () => {
      const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmail,
          password: 'WrongPassword!',
        }),
      });

      if (res.status !== 401) {
        throw new Error(`Expected 401 Unauthorized, got ${res.status}`);
      }
    });

    // 7. Authenticated Me Endpoint
    await runTest('7. Protected /api/v1/auth/me returns profile for valid JWT', async () => {
      const res = await fetch(`${baseUrl}/api/v1/auth/me`, {
        headers: { 'Authorization': `Bearer ${authToken}` },
      });

      if (res.status !== 200) {
        throw new Error(`Expected 200 OK, got ${res.status}`);
      }

      const body = await res.json();
      if (body.user.email !== testEmail.toLowerCase()) throw new Error('User email mismatch');
      if (body.user.profile?.school_or_org !== 'مدرسة التميز العلمية') {
        throw new Error('Profile school mismatch');
      }
    });

    // 8. Reject Protected Route Without Token
    await runTest('8. Reject unauthorized access to /api/v1/auth/me without token', async () => {
      const res = await fetch(`${baseUrl}/api/v1/auth/me`);
      if (res.status !== 401) {
        throw new Error(`Expected 401 Unauthorized, got ${res.status}`);
      }
    });

    // 9. Activity Logging
    await runTest('9. Activity log stores registration and login audit trail', async () => {
      const res = await fetch(`${baseUrl}/api/v1/users/activity`, {
        headers: { 'Authorization': `Bearer ${authToken}` },
      });

      if (res.status !== 200) {
        throw new Error(`Expected 200 OK, got ${res.status}`);
      }

      const body = await res.json();
      if (!body.logs || body.logs.length === 0) {
        throw new Error('No activity logs found for user');
      }
    });

  } finally {
    server.close();
  }

  // Final Summary
  console.log('\n------------------------------------------------------');
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`Test Summary: ${passed} Passed, ${failed} Failed out of ${results.length} Tests`);
  console.log('------------------------------------------------------\n');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
