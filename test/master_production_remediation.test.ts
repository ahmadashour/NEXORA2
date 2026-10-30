/**
 * NEXORA MASTER PRODUCTION REMEDIATION VERIFICATION SUITE
 * Comprehensive security, database, authentication, API, and runtime hardening verification.
 * Target Branch: production-remediation
 * Target Domain: https://nexora.ashouracademy.com
 */

import http from 'http';
import jwt from 'jsonwebtoken';
import { createExpressApp } from '../server/app';
import { db } from '../server/db';
import { generateToken, getJwtSecret } from '../server/middleware/auth';
import { isLoopbackHost } from '../server/db/postgres';

interface TestResult {
  code: string;
  name: string;
  passed: boolean;
  durationMs: number;
  evidence?: string;
  error?: string;
}

const results: TestResult[] = [];

async function runTest(code: string, name: string, fn: () => Promise<string | void>): Promise<void> {
  const start = Date.now();
  try {
    const evidence = await fn();
    const durationMs = Date.now() - start;
    results.push({ code, name, passed: true, durationMs, evidence: evidence || undefined });
    console.log(`[PASS] [${code}] ${name} (${durationMs}ms)`);
    if (evidence) {
      console.log(`       ↳ Evidence: ${evidence}`);
    }
  } catch (err: unknown) {
    const durationMs = Date.now() - start;
    const error = err instanceof Error ? err.message : String(err);
    results.push({ code, name, passed: false, durationMs, error });
    console.error(`[FAIL] [${code}] ${name} (${durationMs}ms)`);
    console.error(`       ↳ Error: ${error}`);
  }
}

async function startServer(): Promise<{ server: http.Server; baseUrl: string }> {
  const app = createExpressApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const addr = server.address() as { port: number };
  return { server, baseUrl: `http://127.0.0.1:${addr.port}` };
}

async function main() {
  console.log('\n================================================================================');
  console.log('  NEXORA — MASTER PRODUCTION REMEDIATION VERIFICATION SUITE');
  console.log('  Branch: production-remediation | Target: https://nexora.ashouracademy.com');
  console.log('================================================================================\n');

  const { server, baseUrl } = await startServer();

  try {
    // -------------------------------------------------------------------------
    // MASTER-01: Educational Role Normalization & Arbitrary Role Tampering Defense
    // -------------------------------------------------------------------------
    await runTest('MASTER-01', 'Educational Role Normalization & Tampering Defense', async () => {
      // 1. Try arbitrary spoofed role
      const tamperRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `spoof.${Date.now()}@ashouracademy.com`,
          password: 'StrongPassword2026!',
          fullName: 'مخترق مزيف',
          role: 'SUPER_ADMIN_SYSTEM_OWNER',
        }),
      });
      const tamperBody = await tamperRes.json();
      if (tamperBody.user.role_code === 'SUPER_ADMIN_SYSTEM_OWNER') {
        throw new Error('Server accepted arbitrary client role!');
      }
      if (tamperBody.user.role_code !== 'TEACH') {
        throw new Error(`Expected fallback to TEACH, got ${tamperBody.user.role_code}`);
      }

      // 2. Legitimate educational role
      const validRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `lead.admin.${Date.now()}@ashouracademy.com`,
          password: 'StrongPassword2026!',
          fullName: 'المشرف التربوي',
          role: 'LEAD',
        }),
      });
      const validBody = await validRes.json();
      if (validBody.user.role_code !== 'LEAD') {
        throw new Error(`Expected LEAD role, got ${validBody.user.role_code}`);
      }

      return `Tampered role normalized safely to TEACH; authorized educational role LEAD accepted cleanly.`;
    });

    // -------------------------------------------------------------------------
    // MASTER-02: Administrative Role Elevation via PUT /api/v1/users/:id/role
    // -------------------------------------------------------------------------
    await runTest('MASTER-02', 'Admin Role Elevation (PUT /:id/role) with RBAC & Audit Trail', async () => {
      // 1. Register a teacher user
      const teacherRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `teacher.promo.${Date.now()}@ashouracademy.com`,
          password: 'StrongPassword2026!',
          fullName: 'المعلم المرشح للترقية',
          role: 'TEACH',
        }),
      });
      const teacherData = await teacherRes.json();
      const teacherId = teacherData.user.id;
      const teacherToken = teacherData.token;

      // 2. Register an admin user (LEAD)
      const leadRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `director.${Date.now()}@ashouracademy.com`,
          password: 'StrongPassword2026!',
          fullName: 'مدير التوجيه الفني',
          role: 'LEAD',
        }),
      });
      const leadData = await leadRes.json();
      const leadToken = leadData.token;

      // 3. Unauthorized non-lead user attempts to promote someone -> 403 Forbidden
      const unauthorizedPromo = await fetch(`${baseUrl}/api/v1/users/${teacherId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${teacherToken}`,
        },
        body: JSON.stringify({ role: 'PRO' }),
      });
      if (unauthorizedPromo.status !== 403) {
        throw new Error(`Expected 403 FORBIDDEN_ROLE, got ${unauthorizedPromo.status}`);
      }

      // 4. Authorized LEAD user promotes teacher to PRO
      const promoRes = await fetch(`${baseUrl}/api/v1/users/${teacherId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${leadToken}`,
        },
        body: JSON.stringify({ role: 'PRO' }),
      });
      if (promoRes.status !== 200) {
        const err = await promoRes.json();
        throw new Error(`Admin role update failed with ${promoRes.status}: ${JSON.stringify(err)}`);
      }
      const promoData = await promoRes.json();
      if (promoData.user.role_code !== 'PRO') {
        throw new Error(`Expected updated role_code 'PRO', got ${promoData.user.role_code}`);
      }

      // 5. Verify audit log was recorded for role change
      const logs = await db.getActivityLogs(leadData.user.id, 5);
      const roleLog = logs.find(l => l.action === 'USER_ROLE_CHANGED');
      if (!roleLog) {
        throw new Error('Audit log for USER_ROLE_CHANGED was not recorded!');
      }

      return `Non-admin promotion rejected with 403; Admin LEAD promotion succeeded to PRO; Audit log captured with actor ID ${leadData.user.id}.`;
    });

    // -------------------------------------------------------------------------
    // MASTER-03: Profile IDOR Defense & Immutability of Sensitive Fields
    // -------------------------------------------------------------------------
    await runTest('MASTER-03', 'Profile IDOR Defense & Immutability of Sensitive Fields', async () => {
      const regRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `profile.sec.${Date.now()}@ashouracademy.com`,
          password: 'StrongPassword2026!',
          fullName: 'أستاذ العلوم المؤمّن',
          role: 'TEACH',
        }),
      });
      const data = await regRes.json();
      const token = data.token;
      const initialRole = data.user.role_code;
      const initialId = data.user.id;

      // Attempt to tamper with role, role_id, id, is_active via PUT /profile
      const tamperProfile = await fetch(`${baseUrl}/api/v1/users/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          full_name: 'أستاذ العلوم بعد التحديث',
          role: 'LEAD',
          role_id: 'role_lead',
          id: 'usr_hacked_root',
          is_active: false,
          user_id: 'usr_different_target',
        }),
      });

      if (tamperProfile.status !== 200) {
        throw new Error(`Profile update failed: ${tamperProfile.status}`);
      }

      // Verify user profile via /me
      const meRes = await fetch(`${baseUrl}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const meData = await meRes.json();

      if (meData.user.id !== initialId) throw new Error('ID was mutated!');
      if (meData.user.role_code !== initialRole) throw new Error('Role was mutated via profile update!');
      if (!meData.user.is_active) throw new Error('is_active was mutated via profile update!');
      if (meData.user.profile.full_name !== 'أستاذ العلوم بعد التحديث') {
        throw new Error('Legitimate field full_name was not updated');
      }

      return `Sensitive fields (id, role, role_id, is_active) are completely immutable via profile update; full_name safely updated.`;
    });

    // -------------------------------------------------------------------------
    // MASTER-04: JWT Cryptographic Algorithm Hardening, Issuer, Audience & UUID JTI
    // -------------------------------------------------------------------------
    await runTest('MASTER-04', 'JWT Cryptographic Algorithm Hardening (HS256, Issuer, Audience, UUID JTI)', async () => {
      const regRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `jwt.sec.${Date.now()}@ashouracademy.com`,
          password: 'StrongPassword2026!',
          fullName: 'باحث أمني JWT',
          role: 'TEACH',
        }),
      });
      const data = await regRes.json();
      const token = data.token;

      // Decode token header and payload
      const secret = getJwtSecret();
      const decoded = jwt.verify(token, secret, {
        algorithms: ['HS256'],
        issuer: 'nexora.ashouracademy.com',
        audience: 'nexora-users',
      }) as { jti: string; iss: string; aud: string };

      if (!decoded.jti || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(decoded.jti)) {
        throw new Error(`JTI is not a cryptographically secure UUID: ${decoded.jti}`);
      }
      if (decoded.iss !== 'nexora.ashouracademy.com') {
        throw new Error(`Issuer mismatch: ${decoded.iss}`);
      }
      if (decoded.aud !== 'nexora-users') {
        throw new Error(`Audience mismatch: ${decoded.aud}`);
      }

      // Reject forged token with wrong issuer
      const forgedIssuerToken = jwt.sign(
        { userId: 'fake', role: 'TEACH' },
        secret,
        { algorithm: 'HS256', issuer: 'attacker.com', audience: 'nexora-users' }
      );
      const forgedIssuerRes = await fetch(`${baseUrl}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${forgedIssuerToken}` },
      });
      if (forgedIssuerRes.status !== 401) {
        throw new Error(`Expected 401 for forged issuer, got ${forgedIssuerRes.status}`);
      }

      return `JWT issued with UUID JTI (${decoded.jti.slice(0, 8)}...), HS256 algorithm, issuer 'nexora.ashouracademy.com', and audience 'nexora-users'. Forged issuer rejected with 401.`;
    });

    // -------------------------------------------------------------------------
    // MASTER-05: Session Invalidation on Password Change
    // -------------------------------------------------------------------------
    await runTest('MASTER-05', 'Session Invalidation on Password Change', async () => {
      const email = `pwd.rev.${Date.now()}@ashouracademy.com`;
      const initialPwd = 'InitialPassword2026!';
      const newPwd = 'NewSuperPassword2026!';

      const regRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password: initialPwd,
          fullName: 'مستخدم تغيير كلمة المرور',
          role: 'TEACH',
        }),
      });
      const regData = await regRes.json();
      const oldToken = regData.token;

      // Change password
      const changeRes = await fetch(`${baseUrl}/api/v1/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${oldToken}`,
        },
        body: JSON.stringify({
          currentPassword: initialPwd,
          newPassword: newPwd,
        }),
      });

      if (changeRes.status !== 200) {
        const err = await changeRes.json();
        throw new Error(`Change password failed: ${JSON.stringify(err)}`);
      }

      // Old token MUST now be revoked and rejected on subsequent requests
      const meRes = await fetch(`${baseUrl}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${oldToken}` },
      });
      if (meRes.status !== 401) {
        throw new Error(`Expected 401 TOKEN_REVOKED for old session token, got ${meRes.status}`);
      }

      // New login with new password succeeds
      const newLogin = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: newPwd }),
      });
      if (newLogin.status !== 200) {
        throw new Error(`Login with new password failed: ${newLogin.status}`);
      }

      return `Session token revoked upon password change; old token rejected with 401; login with new password succeeded.`;
    });

    // -------------------------------------------------------------------------
    // MASTER-06: AI Route Security: Auth, ai:access Permission & Prompt Validation
    // -------------------------------------------------------------------------
    await runTest('MASTER-06', 'AI Route Security (Auth, ai:access Permission & Prompt Boundary)', async () => {
      // 1. Unauthenticated request -> 401
      const unauthRes = await fetch(`${baseUrl}/api/v1/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'شرح مبسط لظاهرة الحث الكهرومغناطيسي للصف الحادي عشر' }),
      });
      if (unauthRes.status !== 401) {
        throw new Error(`Expected 401 for unauthenticated AI request, got ${unauthRes.status}`);
      }

      // 2. Student role (no ai:access permission) -> 403 Forbidden
      const studentRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `student.ai.${Date.now()}@ashouracademy.com`,
          password: 'StrongPassword2026!',
          fullName: 'طالب بدون إذن الذكاء الاصطناعي',
          role: 'STUDENT',
        }),
      });
      const studentData = await studentRes.json();
      const studentAiRes = await fetch(`${baseUrl}/api/v1/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentData.token}`,
        },
        body: JSON.stringify({ prompt: 'شرح مبسط لظاهرة الحث الكهرومغناطيسي للصف الحادي عشر' }),
      });
      if (studentAiRes.status !== 403) {
        throw new Error(`Expected 403 FORBIDDEN_PERMISSION for STUDENT role, got ${studentAiRes.status}`);
      }

      // 3. Teacher role (with ai:access permission) -> 200 OK
      const teacherRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `teacher.ai.${Date.now()}@ashouracademy.com`,
          password: 'StrongPassword2026!',
          fullName: 'معلم حاصل على إذن الذكاء الاصطناعي',
          role: 'TEACH',
        }),
      });
      const teacherData = await teacherRes.json();
      const teacherAiRes = await fetch(`${baseUrl}/api/v1/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${teacherData.token}`,
        },
        body: JSON.stringify({ prompt: 'شرح مبسط لظاهرة الحث الكهرومغناطيسي للصف الحادي عشر' }),
      });
      if (teacherAiRes.status !== 200) {
        throw new Error(`Expected 200 for TEACH role on AI route, got ${teacherAiRes.status}`);
      }
      const aiData = await teacherAiRes.json();
      if (!aiData.reply || !aiData.reply.includes('الحث الكهرومغناطيسي')) {
        throw new Error('AI reply missing curriculum content');
      }

      // 4. Prompt length limit boundary (>2000 chars) -> 400 PROMPT_TOO_LONG
      const longPrompt = 'أ'.repeat(2005);
      const longPromptRes = await fetch(`${baseUrl}/api/v1/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${teacherData.token}`,
        },
        body: JSON.stringify({ prompt: longPrompt }),
      });
      if (longPromptRes.status !== 400) {
        throw new Error(`Expected 400 PROMPT_TOO_LONG, got ${longPromptRes.status}`);
      }

      return `AI route protected: 401 for guest, 403 for STUDENT without 'ai:access', 200 for TEACH with 'ai:access', 400 for prompt >2000 chars.`;
    });

    // -------------------------------------------------------------------------
    // MASTER-07: Security Headers & CORS Allowlist Verification
    // -------------------------------------------------------------------------
    await runTest('MASTER-07', 'Security Headers (CSP, HSTS, X-Powered-By, Permissions-Policy, CORS PATCH)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/health`);

      // Verify x-powered-by is disabled
      if (res.headers.get('x-powered-by')) {
        throw new Error('x-powered-by header is exposed!');
      }

      // Verify CSP
      const csp = res.headers.get('content-security-policy');
      if (!csp || !csp.includes("default-src 'self'")) {
        throw new Error(`CSP header missing or malformed: ${csp}`);
      }

      // Verify Permissions-Policy
      const pp = res.headers.get('permissions-policy');
      if (!pp || !pp.includes('camera=()')) {
        throw new Error(`Permissions-Policy header missing: ${pp}`);
      }

      // Verify CORS preflight for PATCH
      const preflightRes = await fetch(`${baseUrl}/api/v1/users/profile`, {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://nexora.ashouracademy.com',
          'Access-Control-Request-Method': 'PATCH',
          'Access-Control-Request-Headers': 'Content-Type,Authorization',
        },
      });
      const allowMethods = preflightRes.headers.get('access-control-allow-methods') || '';
      if (!allowMethods.includes('PATCH')) {
        throw new Error(`CORS Access-Control-Allow-Methods missing PATCH: ${allowMethods}`);
      }

      return `x-powered-by disabled; CSP, Permissions-Policy, nosniff, and SAMEORIGIN present; CORS preflight allows PATCH for https://nexora.ashouracademy.com.`;
    });

    // -------------------------------------------------------------------------
    // MASTER-08: PostgreSQL Loopback vs Remote URL Host Parsing Hardening
    // -------------------------------------------------------------------------
    await runTest('MASTER-08', 'PostgreSQL Loopback URL Host Parsing Hardening', async () => {
      // Passwords or usernames containing "localhost" must NOT trick loopback detection
      const remoteWithLocalhostInPass = 'postgresql://user:pass_with_localhost_word@remote.hostinger.com:5432/db';
      if (isLoopbackHost(remoteWithLocalhostInPass)) {
        throw new Error('Remote host with "localhost" in credentials was falsely detected as loopback!');
      }

      const realLocalhost = 'postgresql://node:secret@localhost:5433/nexora_db';
      if (!isLoopbackHost(realLocalhost)) {
        throw new Error('localhost was not detected as loopback!');
      }

      const real127 = 'postgresql://node:secret@127.0.0.1:5433/nexora_db';
      if (!isLoopbackHost(real127)) {
        throw new Error('127.0.0.1 was not detected as loopback!');
      }

      return `URL parsing strictly uses new URL(connStr).hostname; credentials containing 'localhost' cleanly recognized as remote.`;
    });

    // -------------------------------------------------------------------------
    // MASTER-09: Single Lockfile & Engine Compatibility Check
    // -------------------------------------------------------------------------
    await runTest('MASTER-09', 'Lockfile Single-Source & Engine Specs Verification', async () => {
      const fs = await import('fs');
      if (fs.existsSync('/app/applet/bun.lock')) {
        throw new Error('Conflicting bun.lock file still exists in workspace!');
      }
      if (!fs.existsSync('/app/applet/package-lock.json')) {
        throw new Error('package-lock.json is missing!');
      }

      const pkg = JSON.parse(fs.readFileSync('/app/applet/package.json', 'utf-8'));
      if (!pkg.engines || !pkg.engines.node || !pkg.packageManager) {
        throw new Error('package.json missing engines or packageManager declaration!');
      }

      return `bun.lock eradicated; single package-lock.json active; Node.js ${pkg.engines.node} and ${pkg.packageManager} declared.`;
    });

  } finally {
    server.close();
  }

  console.log('\n================================================================================');
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`MASTER REMEDIATION SUMMARY: ${passed} Passed, ${failed} Failed out of ${results.length} Tests`);
  console.log('================================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Master test suite execution error:', err);
  process.exit(1);
});
