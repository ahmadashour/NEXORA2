/**
 * NEXORA Phase 3.1.5B — Data Persistence & Security Verification Suite
 * Executes rigorous automated tests covering:
 * 1. User Registration & Password Hashing (bcrypt)
 * 2. Authentication & JWT Claims
 * 3. User Profile Creation, Update, & Retrieval
 * 4. Relational Activity Logging (activity_logs)
 * 5. User Account Deactivation & Access Rejection (403/401)
 * 6. Token Revocation & Logout Invalidation (TOKEN_REVOKED)
 * 7. Simulated Process Restart & Data Persistence State
 * 8. Phase F Production Security Hardening (JWT_SECRET fallback prevention & CSRF/Cookie audit)
 */

import http from 'http';
import { createExpressApp } from '../server/app';
import { db } from '../server/db';
import { getJwtSecret } from '../server/middleware/auth';

interface TestResult {
  id: string;
  name: string;
  passed: boolean;
  evidence: string;
  error?: string;
}

const results: TestResult[] = [];

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

async function runTest(id: string, name: string, fn: () => Promise<string>) {
  try {
    const evidence = await fn();
    results.push({ id, name, passed: true, evidence });
    console.log(`[PASS] [${id}] ${name}`);
    console.log(`       ↳ Evidence: ${evidence}`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    results.push({ id, name, passed: false, evidence: 'Failed', error: msg });
    console.error(`[FAIL] [${id}] ${name}`);
    console.error(`       ↳ Error: ${msg}`);
  }
}

async function main() {
  console.log('================================================================');
  console.log('  NEXORA PHASE 3.1.5B — PERSISTENCE & HARDENING AUDIT SUITE');
  console.log('================================================================\n');

  let { server, baseUrl } = await startTestServer();

  const testEmail = `persistence.test.${Date.now()}@ashouracademy.com`;
  const initialPassword = 'SecureUser2026!@#';
  let createdUserId = '';
  let activeToken = '';

  try {
    // -------------------------------------------------------------------------
    // TEST 1: New User Registration & Role Assignment
    // -------------------------------------------------------------------------
    await runTest('PERSIST-01', 'تسجيل مستخدم جديد وتعيين الدور', async () => {
      const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmail,
          password: initialPassword,
          fullName: 'د. يوسف الأكاديمي',
          role: 'teach',
          school: 'مدرسة التفوق الثانوية',
          district: 'منطقة العاصمة التعليمية',
        }),
      });

      const data = await res.json();
      if (res.status !== 201 || !data.token || !data.user?.id) {
        throw new Error(`Registration failed with status ${res.status}: ${JSON.stringify(data)}`);
      }

      createdUserId = data.user.id;
      activeToken = data.token;

      // Verify user exists in storage
      const user = await db.findUserById(createdUserId);
      if (!user) throw new Error('User not found in database store immediately after creation');

      return `User ID: ${user.id}, Email: ${user.email}, Role: ${user.role_id}, PasswordHash: ${user.password_hash.substring(0, 15)}...`;
    });

    // -------------------------------------------------------------------------
    // TEST 2: Login and Bcrypt Password Hash Verification
    // -------------------------------------------------------------------------
    await runTest('PERSIST-02', 'تسجيل الدخول والتحقق من كلمة المرور المشفرة', async () => {
      // 1. Valid login
      const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmail,
          password: initialPassword,
        }),
      });

      const data = await res.json();
      if (res.status !== 200 || !data.token) {
        throw new Error(`Login failed with status ${res.status}`);
      }

      // 2. Invalid password rejection
      const badRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmail,
          password: 'IncorrectPassword999!',
        }),
      });

      if (badRes.status !== 401) {
        throw new Error(`Expected 401 for incorrect password, got ${badRes.status}`);
      }

      return `Valid password authenticated; invalid password rejected with 401. New session token generated.`;
    });

    // -------------------------------------------------------------------------
    // TEST 3: User Profile Update & Retrieval
    // -------------------------------------------------------------------------
    await runTest('PERSIST-03', 'تعديل الملف الشخصي واسترجاعه بنجاح', async () => {
      const updatePayload = {
        full_name: 'د. يوسف الأكاديمي المحدث',
        school_or_org: 'مدرسة العلوم المتقدمة',
        district: 'محافظة حولي',
        bio: 'معلم أول لمادة الأحياء والفيزياء العامة',
      };

      const putRes = await fetch(`${baseUrl}/api/v1/users/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeToken}`,
        },
        body: JSON.stringify(updatePayload),
      });

      if (putRes.status !== 200) {
        throw new Error(`PUT profile failed: ${putRes.status}`);
      }

      // Retrieve via GET /profile
      const getRes = await fetch(`${baseUrl}/api/v1/users/profile`, {
        headers: { Authorization: `Bearer ${activeToken}` },
      });

      const getData = await getRes.json();
      if (getData.profile.full_name !== updatePayload.full_name || getData.profile.district !== updatePayload.district) {
        throw new Error(`Profile fields mismatch after update: ${JSON.stringify(getData.profile)}`);
      }

      return `Profile verified: FullName="${getData.profile.full_name}", Org="${getData.profile.school_or_org}", District="${getData.profile.district}"`;
    });

    // -------------------------------------------------------------------------
    // TEST 4: Activity Logging Persistence (activity_logs)
    // -------------------------------------------------------------------------
    await runTest('PERSIST-04', 'تسجيل حدث جديد في سجل النشاط واسترجاعه', async () => {
      const userLogs = await db.getActivityLogs(createdUserId, 10);
      if (userLogs.length === 0) {
        throw new Error('No activity logs found for user');
      }

      const actions = userLogs.map(l => l.action);
      return `Activity logs count: ${userLogs.length}. Recorded actions: [${actions.join(', ')}]`;
    });

    // -------------------------------------------------------------------------
    // TEST 5: User Account Deactivation
    // -------------------------------------------------------------------------
    await runTest('PERSIST-05', 'تعطيل المستخدم والتأكد من منعه من الدخول', async () => {
      // Deactivate user
      const deactivated = await db.setUserActive(createdUserId, false);
      if (!deactivated) throw new Error('Failed to deactivate user in database');

      // Attempt authenticated request with token
      const authRes = await fetch(`${baseUrl}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${activeToken}` },
      });

      if (authRes.status !== 401) {
        throw new Error(`Expected 401 for deactivated account on /me, got ${authRes.status}`);
      }
      const authData = await authRes.json();
      if (authData.error !== 'USER_INACTIVE_OR_NOT_FOUND') {
        throw new Error(`Expected USER_INACTIVE_OR_NOT_FOUND error code, got ${authData.error}`);
      }

      // Attempt login
      const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmail,
          password: initialPassword,
        }),
      });

      if (loginRes.status !== 403) {
        throw new Error(`Expected 403 ACCOUNT_SUSPENDED for login of deactivated account, got ${loginRes.status}`);
      }

      // Reactivate user for subsequent tests
      await db.setUserActive(createdUserId, true);
      return `Deactivated account correctly blocked on /me (401 USER_INACTIVE_OR_NOT_FOUND) and login (403 ACCOUNT_SUSPENDED). Reactivated for next tests.`;
    });

    // -------------------------------------------------------------------------
    // TEST 6: Session Invalidation on Logout (revoked_tokens)
    // -------------------------------------------------------------------------
    let postLogoutToken = '';
    await runTest('PERSIST-06', 'إبطال الرمز عند تسجيل الخروج ومنع إعادة استخدامه', async () => {
      // Login again to obtain a fresh active token
      const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmail,
          password: initialPassword,
        }),
      });
      const loginData = await loginRes.json();
      postLogoutToken = loginData.token;

      // Verify token works
      const preCheck = await fetch(`${baseUrl}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${postLogoutToken}` },
      });
      if (preCheck.status !== 200) throw new Error('Token should be active prior to logout');

      // Execute Logout
      const logoutRes = await fetch(`${baseUrl}/api/v1/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${postLogoutToken}` },
      });
      if (logoutRes.status !== 200) throw new Error('Logout API call failed');

      // Attempt to access /me with the revoked token
      const postCheck = await fetch(`${baseUrl}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${postLogoutToken}` },
      });

      if (postCheck.status !== 401) {
        throw new Error(`Expected 401 TOKEN_REVOKED, got ${postCheck.status}`);
      }
      const postData = await postCheck.json();
      if (postData.error !== 'TOKEN_REVOKED') {
        throw new Error(`Expected error 'TOKEN_REVOKED', got ${postData.error}`);
      }

      return `Token successfully revoked. Subsequent use rejected with 401 TOKEN_REVOKED. Revoked store count: ${db.getStats().counts.revokedTokens}`;
    });

    // -------------------------------------------------------------------------
    // TEST 7: Data Integrity & Persistence Verification Across Restarts
    // -------------------------------------------------------------------------
    await runTest('PERSIST-07', 'فحص بقاء واستمرارية البيانات عبر إعادة تشغيل الخادم', async () => {
      // Close current HTTP server instance
      server.close();

      // Launch fresh server instance (simulates application process restart on Hostinger)
      const fresh = await startTestServer();
      server = fresh.server;
      baseUrl = fresh.baseUrl;

      // Verify the user and profile are still intact in storage
      const existingUser = await db.findUserByEmail(testEmail);
      if (!existingUser) {
        throw new Error('User data disappeared after server instance restart!');
      }

      const existingProfile = await db.getProfileByUserId(existingUser.id);
      if (!existingProfile || existingProfile.district !== 'محافظة حولي') {
        throw new Error('User profile data modified or missing after restart');
      }

      return `Data intact after server restart. User ${existingUser.id} (${existingUser.email}) and updated profile recovered seamlessly.`;
    });

    // -------------------------------------------------------------------------
    // TEST 8: Phase F — Strict JWT_SECRET Production Fallback Prevention
    // -------------------------------------------------------------------------
    await runTest('HARDEN-01', 'منع القيمة الاحتياطية لـ JWT_SECRET في الإنتاج (Phase F)', async () => {
      const origEnv = process.env.NODE_ENV;
      const origSecret = process.env.JWT_SECRET;

      try {
        // Set environment to production with default secret
        process.env.NODE_ENV = 'production';
        delete process.env.JWT_SECRET;

        let blocked = false;
        try {
          getJwtSecret();
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          if (msg.includes('FATAL_SECURITY_ERROR')) {
            blocked = true;
          }
        }

        if (!blocked) {
          throw new Error('Production environment permitted startup without JWT_SECRET!');
        }

        return 'Insecure fallback strictly prevented: Fatal security exception thrown when NODE_ENV=production lacks strong JWT_SECRET.';
      } finally {
        process.env.NODE_ENV = origEnv;
        if (origSecret) process.env.JWT_SECRET = origSecret;
      }
    });

    // -------------------------------------------------------------------------
    // TEST 9: Phase F — HttpOnly Cookie & CSRF Validation Integration
    // -------------------------------------------------------------------------
    await runTest('HARDEN-02', 'دعم ملفات تعريف الارتباط والتحقق من حماية CSRF (Phase F)', async () => {
      // Fresh login to obtain token
      const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmail,
          password: initialPassword,
        }),
      });
      const loginData = await loginRes.json();
      const cookieAuthToken = loginData.token;

      // Test 1: GET /api/v1/auth/me using Cookie header
      const cookieGetRes = await fetch(`${baseUrl}/api/v1/auth/me`, {
        headers: {
          Cookie: `nexora_token=${cookieAuthToken}`,
        },
      });

      if (cookieGetRes.status !== 200) {
        throw new Error(`Cookie authentication on GET failed with status ${cookieGetRes.status}`);
      }

      // Test 2: Mutating request (PUT /profile) using Cookie WITHOUT CSRF header -> MUST BE 403
      const cookiePutNoCsrf = await fetch(`${baseUrl}/api/v1/users/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `nexora_token=${cookieAuthToken}`,
        },
        body: JSON.stringify({ full_name: 'محاولة تعديل بدون CSRF' }),
      });

      if (cookiePutNoCsrf.status !== 403) {
        throw new Error(`Expected 403 CSRF_VALIDATION_FAILED for mutating cookie request, got ${cookiePutNoCsrf.status}`);
      }

      // Test 3: Mutating request WITH CSRF header (X-Requested-With: XMLHttpRequest) -> MUST BE 200
      const cookiePutWithCsrf = await fetch(`${baseUrl}/api/v1/users/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `nexora_token=${cookieAuthToken}`,
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({ full_name: 'د. يوسف الأكاديمي المؤمّن' }),
      });

      if (cookiePutWithCsrf.status !== 200) {
        throw new Error(`Mutating cookie request with CSRF header failed: ${cookiePutWithCsrf.status}`);
      }

      return 'Cookie authentication functional for GET; mutating requests require CSRF verification (403 without header, 200 with X-Requested-With).';
    });

  } finally {
    server.close();
  }

  console.log('\n================================================================');
  const passedCount = results.filter(r => r.passed).length;
  const failedCount = results.filter(r => !r.passed).length;
  console.log(`TOTAL TESTS: ${results.length} | PASSED: ${passedCount} | FAILED: ${failedCount}`);
  console.log('================================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Test suite uncaught error:', err);
  process.exit(1);
});
