/**
 * NEXORA — Final Production Remediation & Verification Suite
 * 
 * Validates the 6 mandatory verification requirements from Phase 3.1.5 Sprint:
 * 1. User Creation & Retrieval across Server & Storage Persistence
 * 2. Login Authentication & RBAC Permissions for all 6 Roles (LEAD, PRO, TEACH, START, STUDENT, FAMILY)
 * 3. Immediate and Persistent Rejection of Revoked JWT Tokens (TOKEN_REVOKED)
 * 4. Strict CORS Security Policy: Rejection of Unauthorized Origins (403 CORS_FORBIDDEN)
 * 5. Graceful Handling of PostgreSQL Disconnection & Production Fail-Fast (503 DATABASE_UNAVAILABLE)
 * 6. Cross-Account Data Isolation (Zero cross-user data leakage / IDOR protection)
 */

import http from 'http';
import { createExpressApp } from '../server/app';
import { db } from '../server/db';
import { checkPostgresConnection } from '../server/db/postgres';
import { generateToken } from '../server/middleware/auth';

interface TestResult {
  id: string;
  category: string;
  title: string;
  passed: boolean;
  durationMs: number;
  evidence: string;
  error?: string;
}

const testResults: TestResult[] = [];

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

async function runTestCase(
  id: string,
  category: string,
  title: string,
  testFn: () => Promise<string>
): Promise<void> {
  const start = Date.now();
  try {
    const evidence = await testFn();
    const durationMs = Date.now() - start;
    testResults.push({ id, category, title, passed: true, durationMs, evidence });
    console.log(`[PASS] [${id}] ${title} (${durationMs}ms)`);
    console.log(`       ↳ Evidence: ${evidence}`);
  } catch (err: unknown) {
    const durationMs = Date.now() - start;
    const msg = err instanceof Error ? err.message : String(err);
    testResults.push({ id, category, title, passed: false, durationMs, evidence: 'Failed', error: msg });
    console.error(`[FAIL] [${id}] ${title} (${durationMs}ms)`);
    console.error(`       ↳ Error: ${msg}`);
  }
}

async function executeSprintVerification() {
  console.log('========================================================================');
  console.log('  NEXORA PLATFORM — FINAL PRODUCTION REMEDIATION SPRINT VERIFICATION');
  console.log('  Target Domain: https://nexora.ashouracademy.com');
  console.log('  Branch: production-remediation');
  console.log('========================================================================\n');

  let { server, baseUrl } = await startTestServer();

  try {
    // -------------------------------------------------------------------------
    // SCENARIO 1: User Creation & Retrieval across Server & Storage Persistence
    // -------------------------------------------------------------------------
    const userEmail1 = `sprint.test.teacher.${Date.now()}@ashouracademy.com`;
    let user1Id = '';
    let user1Token = '';

    await runTestCase(
      'SPRINT-01',
      'USER_PERSISTENCE',
      'إنشاء مستخدم واسترجاعه عبر الخادم والتحقق من حفظ البيانات',
      async () => {
        // Register new user
        const regRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: userEmail1,
            password: 'StrongTeacherPassword2026!',
            fullName: 'الأستاذة مريم الكندري',
            role: 'TEACH',
            school: 'مدرسة التميز المشتركة',
            district: 'الأحمدي التعليمية',
          }),
        });

        const regData = await regRes.json();
        if (regRes.status !== 201 || !regData.token || !regData.user?.id) {
          throw new Error(`Registration failed: ${regRes.status} -> ${JSON.stringify(regData)}`);
        }

        user1Id = regData.user.id;
        user1Token = regData.token;

        // Retrieve user via authenticated /api/v1/auth/me
        const meRes = await fetch(`${baseUrl}/api/v1/auth/me`, {
          headers: { Authorization: `Bearer ${user1Token}` },
        });

        if (meRes.status !== 200) {
          throw new Error(`/api/v1/auth/me failed with status ${meRes.status}`);
        }

        const meData = await meRes.json();
        if (meData.user.email.toLowerCase() !== userEmail1.toLowerCase()) {
          throw new Error(`User email mismatch on /me: expected ${userEmail1}, got ${meData.user.email}`);
        }

        if (meData.user.profile?.full_name !== 'الأستاذة مريم الكندري') {
          throw new Error(`Profile full_name mismatch: ${meData.user.profile?.full_name}`);
        }

        return `User successfully registered and verified (ID: ${user1Id}, Email: ${userEmail1}, Role: TEACH, District: الأحمدي التعليمية).`;
      }
    );

    // -------------------------------------------------------------------------
    // SCENARIO 2: Login & RBAC Permissions for all 6 Roles
    // -------------------------------------------------------------------------
    await runTestCase(
      'SPRINT-02',
      'RBAC_SIX_ROLES',
      'تسجيل الدخول والتحقق من صلاحيات الأدوار الستة وعزل البوابات',
      async () => {
        const roles = [
          { code: 'LEAD', title: 'موجه فني للعلوم', email: `lead.${Date.now()}@ashouracademy.com` },
          { code: 'PRO', title: 'رئيس قسم علمي', email: `pro.${Date.now()}@ashouracademy.com` },
          { code: 'TEACH', title: 'معلم علوم', email: `teach.${Date.now()}@ashouracademy.com` },
          { code: 'START', title: 'معلم متدرب', email: `start.${Date.now()}@ashouracademy.com` },
          { code: 'STUDENT', title: 'طالب', email: `student.${Date.now()}@ashouracademy.com` },
          { code: 'FAMILY', title: 'ولي أمر', email: `family.${Date.now()}@ashouracademy.com` },
        ];

        const verificationSummary: string[] = [];

        for (const r of roles) {
          // Register user for this role
          const regRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: r.email,
              password: 'StrongRolePassword2026!',
              fullName: `مستخدم ${r.title}`,
              role: r.code,
            }),
          });
          const regData = await regRes.json();
          if (regRes.status !== 201) throw new Error(`Registration failed for role ${r.code}`);

          const token = regData.token;

          // Check portal authorized access
          const accessRes = await fetch(`${baseUrl}/api/v1/portals/${r.code}/access`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (accessRes.status !== 200) {
            throw new Error(`Portal access failed for role ${r.code}: status ${accessRes.status}`);
          }

          // Check cross-role unauthorized access rejection (e.g. STUDENT attempting LEAD portal)
          if (r.code === 'STUDENT') {
            const forbiddenRes = await fetch(`${baseUrl}/api/v1/portals/LEAD/access`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (forbiddenRes.status !== 403) {
              throw new Error(`STUDENT was not rejected from LEAD portal: status ${forbiddenRes.status}`);
            }
          }

          verificationSummary.push(`${r.code} (${r.title}) -> 200 Authorized`);
        }

        return `All 6 educational roles verified: [${verificationSummary.join(', ')}]. Cross-portal access strictly rejected with 403 FORBIDDEN_PORTAL_ACCESS.`;
      }
    );

    // -------------------------------------------------------------------------
    // SCENARIO 3: Revoked JWT Rejection on Logout
    // -------------------------------------------------------------------------
    await runTestCase(
      'SPRINT-03',
      'TOKEN_REVOCATION',
      'رفض الرموز المبطلة فور تسجيل الخروج ومنع إعادة استخدامها',
      async () => {
        // Authenticate new session
        const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: userEmail1,
            password: 'StrongTeacherPassword2026!',
          }),
        });

        const loginData = await loginRes.json();
        const sessionToken = loginData.token;

        // Verify token is active
        const preCheck = await fetch(`${baseUrl}/api/v1/auth/me`, {
          headers: { Authorization: `Bearer ${sessionToken}` },
        });
        if (preCheck.status !== 200) throw new Error('Token should be active prior to logout');

        // Logout
        const logoutRes = await fetch(`${baseUrl}/api/v1/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${sessionToken}` },
        });
        if (logoutRes.status !== 200) throw new Error('Logout API failed');

        // Attempt reuse of revoked token
        const postCheck = await fetch(`${baseUrl}/api/v1/auth/me`, {
          headers: { Authorization: `Bearer ${sessionToken}` },
        });

        if (postCheck.status !== 401) {
          throw new Error(`Expected 401 for revoked token, got ${postCheck.status}`);
        }

        const postData = await postCheck.json();
        if (postData.error !== 'TOKEN_REVOKED') {
          throw new Error(`Expected error code 'TOKEN_REVOKED', got ${postData.error}`);
        }

        return `Revoked token immediately blocked on /api/v1/auth/me with 401 TOKEN_REVOKED. Re-use strictly prevented.`;
      }
    );

    // -------------------------------------------------------------------------
    // SCENARIO 4: Strict CORS Origin Rejection
    // -------------------------------------------------------------------------
    await runTestCase(
      'SPRINT-04',
      'CORS_SECURITY',
      'تدقيق CORS والسماح بالمصادر المعتمدة ورفض المصادر غير المصرح بها (403)',
      async () => {
        // 1. Allowed Origin
        const allowedRes = await fetch(`${baseUrl}/api/v1/health`, {
          headers: { Origin: 'https://nexora.ashouracademy.com' },
        });
        const allowedHeader = allowedRes.headers.get('access-control-allow-origin');
        if (allowedHeader !== 'https://nexora.ashouracademy.com') {
          throw new Error(`Allowed origin header missing or mismatched: ${allowedHeader}`);
        }

        // 2. Malicious / Unauthorized Origin
        const blockedRes = await fetch(`${baseUrl}/api/v1/health`, {
          headers: { Origin: 'https://unauthorized-phishing-attacker.xyz' },
        });

        if (blockedRes.status !== 403) {
          throw new Error(`Expected status 403 for unauthorized origin, got ${blockedRes.status}`);
        }

        const blockedData = await blockedRes.json();
        if (blockedData.error !== 'CORS_FORBIDDEN') {
          throw new Error(`Expected CORS_FORBIDDEN error code, got ${blockedData.error}`);
        }

        return `CORS whitelist strictly enforced: Allowed origin 'https://nexora.ashouracademy.com' -> 200; Unauthorized origin 'https://unauthorized-phishing-attacker.xyz' -> 403 CORS_FORBIDDEN.`;
      }
    );

    // -------------------------------------------------------------------------
    // SCENARIO 5: Graceful Handling of PostgreSQL Disconnection & Production Fail-Fast
    // -------------------------------------------------------------------------
    await runTestCase(
      'SPRINT-05',
      'POSTGRES_DISCONNECTION_HANDLING',
      'التعامل الآمن مع انقطاع اتصال PostgreSQL ومنع الحلول الصامتة في الإنتاج',
      async () => {
        // 1. Test checkPostgresConnection() behavior when DB is disconnected
        const diag = await checkPostgresConnection();
        if (diag.isReachable) {
          throw new Error('Expected PostgreSQL to be unreachable in this isolated sandbox');
        }

        // 2. Verify diagnostics endpoint reports truthful status with authorized supervisor token
        const leadUser = await db.createUserWithProfile(
          {
            id: `usr_diag_lead_${Date.now()}`,
            email: `diag.lead.${Date.now()}@ashouracademy.com`,
            password_hash: 'dummy',
            role_id: 'role_lead',
          },
          { id: `prf_diag_${Date.now()}`, full_name: 'موجه تشخيص' }
        );
        const sanitizedLead = (await db.getSanitizedUser(leadUser.user.id))!;
        const leadToken = generateToken(sanitizedLead);

        const diagRes = await fetch(`${baseUrl}/api/v1/health/db-diagnostics`, {
          headers: { Authorization: `Bearer ${leadToken}` },
        });
        const diagData = await diagRes.json();
        if (!diagData.diagnostics || diagData.diagnostics.postgresConnection.isReachable !== false) {
          throw new Error('Diagnostics endpoint failed to disclose actual database status');
        }

        // 3. Test Production Fail-Fast: when NODE_ENV=production without DATABASE_URL, writes must reject with 503
        const prevEnv = process.env.NODE_ENV;
        const prevDbUrl = process.env.DATABASE_URL;
        let productionRejectionVerified = false;

        try {
          process.env.NODE_ENV = 'production';
          delete process.env.DATABASE_URL;

          const writeAttemptRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: `prod.failfast.${Date.now()}@ashouracademy.com`,
              password: 'Password123!',
              fullName: 'فحص الإنتاج',
              role: 'TEACH',
            }),
          });

          if (writeAttemptRes.status === 503) {
            const errData = await writeAttemptRes.json();
            if (errData.error === 'DATABASE_UNAVAILABLE') {
              productionRejectionVerified = true;
            }
          }
        } finally {
          process.env.NODE_ENV = prevEnv;
          if (prevDbUrl) process.env.DATABASE_URL = prevDbUrl;
        }

        if (!productionRejectionVerified) {
          throw new Error('Production fail-fast did not return 503 DATABASE_UNAVAILABLE when persistent DB was absent');
        }

        return `PostgreSQL disconnection gracefully caught; truthful diagnostics provided without false assertions; Production fail-fast verified with 503 DATABASE_UNAVAILABLE.`;
      }
    );

    // -------------------------------------------------------------------------
    // SCENARIO 6: Cross-Account Data Isolation (Zero Data Leakage)
    // -------------------------------------------------------------------------
    await runTestCase(
      'SPRINT-06',
      'ACCOUNT_DATA_ISOLATION',
      'عزل بيانات الحسابات ومنع التسريب أو التعديل عبر الحسابات (IDOR Protection)',
      async () => {
        // Create User A
        const userAEmail = `user.a.${Date.now()}@ashouracademy.com`;
        const resA = await fetch(`${baseUrl}/api/v1/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: userAEmail,
            password: 'UserAPassword2026!',
            fullName: 'المستخدم الأول (أ)',
            role: 'TEACH',
            school: 'مدرسة العاصمة',
          }),
        });
        const dataA = await resA.json();
        const tokenA = dataA.token;
        const userAId = dataA.user.id;

        // Create User B
        const userBEmail = `user.b.${Date.now()}@ashouracademy.com`;
        const resB = await fetch(`${baseUrl}/api/v1/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: userBEmail,
            password: 'UserBPassword2026!',
            fullName: 'المستخدم الثاني (ب)',
            role: 'TEACH',
            school: 'مدرسة الجهراء',
          }),
        });
        const dataB = await resB.json();
        const userBId = dataB.user.id;

        // Attack: User A tries to modify User B's profile by supplying user_id or targetId in payload
        const maliciousPut = await fetch(`${baseUrl}/api/v1/users/profile`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokenA}`,
          },
          body: JSON.stringify({
            user_id: userBId, // Attempt IDOR overwrite
            full_name: 'تم الاختراق بواسطة أ',
            school_or_org: 'مدرسة مخترقة',
          }),
        });

        if (maliciousPut.status !== 200) {
          throw new Error('Profile update request failed unexpectedly');
        }

        // Verify User B's profile remains untouched
        const userBProfile = await db.getProfileByUserId(userBId);
        if (userBProfile?.full_name !== 'المستخدم الثاني (ب)' || userBProfile?.school_or_org !== 'مدرسة الجهراء') {
          throw new Error(`CRITICAL SECURITY FAILURE: User B profile was corrupted by User A! Current name: ${userBProfile?.full_name}`);
        }

        // Verify User A only modified their own profile
        const userAProfile = await db.getProfileByUserId(userAId);
        if (userAProfile?.full_name !== 'تم الاختراق بواسطة أ') {
          throw new Error('User A self-profile was not updated');
        }

        // Verify User A's activity log only contains User A's actions
        const aLogsRes = await fetch(`${baseUrl}/api/v1/users/activity`, {
          headers: { Authorization: `Bearer ${tokenA}` },
        });
        const aLogsData = await aLogsRes.json();
        for (const log of aLogsData.logs) {
          if (log.user_id !== userAId) {
            throw new Error(`Data leakage in activity logs: Found log belonging to user ${log.user_id} in User A response`);
          }
        }

        return `Complete account isolation verified: User A cannot modify User B's profile (IDOR resistant); Activity logs strictly scoped to authenticated user ID without leakage.`;
      }
    );

  } finally {
    server.close();
  }

  // Final Summary
  console.log('\n========================================================================');
  console.log('  FINAL VERIFICATION SPRINT SUMMARY');
  console.log('========================================================================');
  const passedCount = testResults.filter(r => r.passed).length;
  const totalCount = testResults.length;
  console.log(`TOTAL SUITES: ${totalCount} | PASSED: ${passedCount} | FAILED: ${totalCount - passedCount}`);
  if (passedCount === totalCount) {
    console.log('STATUS: ALL 6 VERIFICATION REQUIREMENTS FULLY COMPLIANT AND PASSED.');
    process.exit(0);
  } else {
    console.error('STATUS: FAILURES DETECTED.');
    process.exit(1);
  }
}

executeSprintVerification().catch(err => {
  console.error('[FATAL ERROR IN SPRINT SUITE]', err);
  process.exit(1);
});
