/**
 * NEXORA PHASE 5 / P0 — Security Critical Verification Test Suite
 * Validates:
 * 1. P0.1 Database Diagnostics Protection (401 unauth, 403 non-lead, 200 lead/pro, secret redaction)
 * 2. P0.2 Strict CSRF Protection (X-Requested-With bypass closed, cookie enforcement, Bearer safety)
 * 3. P0.3 Secure Session Cookies (HttpOnly, SameSite, CSRF cookies, /auth/me recovery, logout clearance)
 * 4. P0.4 Password Hashing (Cost 12 verification, old hash compat, all-session revocation on change)
 * 5. P0.5 CORS Allowlist & CSP Hardening (regex enforcement, unsafe-eval removal, preflight OPTIONS)
 */

import http from 'http';
import { AddressInfo } from 'net';
import bcrypt from 'bcryptjs';
import { createExpressApp } from '../server/app';
import { db } from '../server/db';
import { generateToken, generateCsrfToken } from '../server/middleware/auth';
import { SanitizedUser } from '../server/db/types';

// Helper to make HTTP requests against server
function makeRequest(
  port: number,
  path: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  } = {}
): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: any; rawBody: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method: options.method || 'GET',
        headers: options.headers || {},
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          let parsed: any = null;
          try {
            parsed = JSON.parse(data);
          } catch {
            parsed = data;
          }
          resolve({
            statusCode: res.statusCode || 0,
            headers: res.headers,
            body: parsed,
            rawBody: data,
          });
        });
      }
    );

    req.on('error', reject);
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

async function runP0SecurityTests() {
  console.log('======================================================');
  console.log('   NEXORA PHASE 5 / P0 — SECURITY REMEDIATION SUITE  ');
  console.log('======================================================\n');

  const app = createExpressApp();
  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const port = (server.address() as AddressInfo).port;
  let passedCount = 0;
  let failedCount = 0;

  async function test(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      console.log(`  ✓ [PASS] ${name}`);
      passedCount++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ✗ [FAIL] ${name}: ${msg}`);
      failedCount++;
    }
  }

  try {
    // --------------------------------------------------------------------------
    // Test Category 1: P0.1 Database Diagnostics Protection
    // --------------------------------------------------------------------------
    console.log('--- P0.1: Database Diagnostics Route Hardening ---');

    await test('1.1 Anonymous request to /db-diagnostics is rejected with 401 Unauthorized', async () => {
      const res = await makeRequest(port, '/api/v1/health/db-diagnostics');
      if (res.statusCode !== 401) {
        throw new Error(`Expected 401, got ${res.statusCode}`);
      }
      if (res.body?.error !== 'UNAUTHORIZED') {
        throw new Error(`Expected error UNAUTHORIZED, got ${res.body?.error}`);
      }
    });

    await test('1.2 Authenticated non-admin (role TEACH) is rejected with 403 Forbidden', async () => {
      const teachId = `usr_teach_${Date.now()}`;
      const teachEmail = `teacher_${Date.now()}@ashouracademy.com`;
      await db.createUserWithProfile(
        { id: teachId, email: teachEmail, password_hash: 'dummy', role_id: 'role_teach' },
        { id: `prf_${Date.now()}`, full_name: 'معلم تجريبي' }
      );
      const teachUser = (await db.getSanitizedUser(teachId))!;
      const token = generateToken(teachUser);
      const res = await makeRequest(port, '/api/v1/health/db-diagnostics', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.statusCode !== 403) {
        throw new Error(`Expected 403, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
      }
      if (res.body?.error !== 'FORBIDDEN_ROLE') {
        throw new Error(`Expected error FORBIDDEN_ROLE, got ${res.body?.error}`);
      }
    });

    await test('1.3 Authorized supervisor (role LEAD) receives 200 OK with sanitized diagnostics', async () => {
      const leadId = `usr_lead_${Date.now()}`;
      const leadEmail = `supervisor_${Date.now()}@ashouracademy.com`;
      await db.createUserWithProfile(
        { id: leadId, email: leadEmail, password_hash: 'dummy', role_id: 'role_lead' },
        { id: `prf_${Date.now()}`, full_name: 'موجه فني تجريبي' }
      );
      const leadUser = (await db.getSanitizedUser(leadId))!;
      const token = generateToken(leadUser);
      const res = await makeRequest(port, '/api/v1/health/db-diagnostics', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.statusCode !== 200) {
        throw new Error(`Expected 200, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
      }
      if (!res.body?.success || !res.body?.diagnostics) {
        throw new Error('Expected success: true and diagnostics object');
      }
      // Verify no sensitive tokens or password leaks
      const bodyStr = JSON.stringify(res.body);
      if (bodyStr.includes('postgres://') && !bodyStr.includes('[REDACTED_PASSWORD]')) {
        throw new Error('Unredacted database connection string detected');
      }
    });

    // --------------------------------------------------------------------------
    // Test Category 2: P0.2 CSRF Protection & X-Requested-With Removal
    // --------------------------------------------------------------------------
    console.log('\n--- P0.2: CSRF Validation & Elimination of X-Requested-With Bypass ---');

    await test('2.1 Cookie session mutating request without CSRF token returns 403 CSRF_VALIDATION_FAILED', async () => {
      const teachUser: SanitizedUser = {
        id: `usr_csrf_${Date.now()}`,
        email: `csrf_${Date.now()}@ashouracademy.com`,
        role_id: 'role_teach',
        role_code: 'TEACH',
        role_name: 'معلم علوم',
        full_name: 'معلم تجريبي',
        is_active: true,
        last_login_at: null,
        created_at: new Date().toISOString(),
      };
      const token = generateToken(teachUser);

      // Mutating request (POST /auth/logout) with cookie only, no CSRF token
      const res = await makeRequest(port, '/api/v1/auth/logout', {
        method: 'POST',
        headers: {
          Cookie: `nexora_token=${token}`,
        },
      });
      if (res.statusCode !== 403) {
        throw new Error(`Expected 403, got ${res.statusCode}`);
      }
      if (res.body?.error !== 'CSRF_VALIDATION_FAILED') {
        throw new Error(`Expected CSRF_VALIDATION_FAILED, got ${res.body?.error}`);
      }
    });

    await test('2.2 X-Requested-With header alone DOES NOT bypass CSRF protection', async () => {
      const teachUser: SanitizedUser = {
        id: `usr_csrf2_${Date.now()}`,
        email: `csrf2_${Date.now()}@ashouracademy.com`,
        role_id: 'role_teach',
        role_code: 'TEACH',
        role_name: 'معلم علوم',
        full_name: 'معلم تجريبي',
        is_active: true,
        last_login_at: null,
        created_at: new Date().toISOString(),
      };
      const token = generateToken(teachUser);

      const res = await makeRequest(port, '/api/v1/auth/logout', {
        method: 'POST',
        headers: {
          Cookie: `nexora_token=${token}`,
          'X-Requested-With': 'XMLHttpRequest', // Attempt to bypass CSRF
        },
      });
      if (res.statusCode !== 403) {
        throw new Error(`VULNERABILITY DETECTED: X-Requested-With bypassed CSRF! Status: ${res.statusCode}`);
      }
      if (res.body?.error !== 'CSRF_VALIDATION_FAILED') {
        throw new Error(`Expected CSRF_VALIDATION_FAILED, got ${res.body?.error}`);
      }
    });

    await test('2.3 Cookie session with mismatched CSRF token returns 403 Forbidden', async () => {
      const teachUser: SanitizedUser = {
        id: `usr_csrf3_${Date.now()}`,
        email: `csrf3_${Date.now()}@ashouracademy.com`,
        role_id: 'role_teach',
        role_code: 'TEACH',
        role_name: 'معلم علوم',
        full_name: 'معلم تجريبي',
        is_active: true,
        last_login_at: null,
        created_at: new Date().toISOString(),
      };
      const token = generateToken(teachUser);

      const res = await makeRequest(port, '/api/v1/auth/logout', {
        method: 'POST',
        headers: {
          Cookie: `nexora_token=${token}; nexora_csrf=valid_cookie_csrf_token_123456`,
          'X-CSRF-Token': 'wrong_and_mismatched_token_654321',
        },
      });
      if (res.statusCode !== 403) {
        throw new Error(`Expected 403, got ${res.statusCode}`);
      }
    });

    await test('2.4 Cookie session with matching CSRF cookie and header succeeds', async () => {
      const teachId = `usr_csrf4_${Date.now()}`;
      const teachEmail = `csrf4_${Date.now()}@ashouracademy.com`;
      await db.createUserWithProfile(
        { id: teachId, email: teachEmail, password_hash: 'dummy', role_id: 'role_teach' },
        { id: `prf_${Date.now()}`, full_name: 'معلم تجريبي' }
      );
      const teachUser = (await db.getSanitizedUser(teachId))!;
      const token = generateToken(teachUser);
      const validCsrf = generateCsrfToken();

      const res = await makeRequest(port, '/api/v1/auth/logout', {
        method: 'POST',
        headers: {
          Cookie: `nexora_token=${token}; nexora_csrf=${validCsrf}`,
          'X-CSRF-Token': validCsrf,
        },
      });
      if (res.statusCode !== 200) {
        throw new Error(`Expected 200, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
      }
    });

    await test('2.5 Safe GET requests via cookie session succeed without requiring CSRF token', async () => {
      const teachUser: SanitizedUser = {
        id: `usr_csrf5_${Date.now()}`,
        email: `csrf5_${Date.now()}@ashouracademy.com`,
        role_id: 'role_teach',
        role_code: 'TEACH',
        role_name: 'معلم علوم',
        full_name: 'معلم تجريبي',
        is_active: true,
        last_login_at: null,
        created_at: new Date().toISOString(),
      };
      // create user in db so getMe can find it
      await db.createUserWithProfile(
        { id: teachUser.id, email: teachUser.email, password_hash: 'dummy', role_id: teachUser.role_id },
        { id: `prf_${Date.now()}`, full_name: teachUser.full_name }
      );
      const token = generateToken(teachUser);

      const res = await makeRequest(port, '/api/v1/auth/me', {
        method: 'GET',
        headers: {
          Cookie: `nexora_token=${token}`,
        },
      });
      if (res.statusCode !== 200) {
        throw new Error(`Expected 200 for safe GET, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
      }
    });

    // --------------------------------------------------------------------------
    // Test Category 3: P0.3 Secure Session Cookies & State Recovery
    // --------------------------------------------------------------------------
    console.log('\n--- P0.3: Secure Session Cookies & Full Lifecycle ---');

    let registeredEmail = `session_${Date.now()}@ashouracademy.com`;
    let registeredPassword = 'SecurePassword2026!';
    let sessionCookieHeader = '';
    let csrfTokenValue = '';

    await test('3.1 Registration sets HttpOnly and CSRF cookies, and returns csrfToken', async () => {
      const res = await makeRequest(port, '/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: registeredEmail,
          password: registeredPassword,
          fullName: 'مستخدم الجلسات الآمنة',
          role: 'teach',
        }),
      });

      if (res.statusCode !== 201) {
        throw new Error(`Expected 201, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
      }

      const setCookies = res.headers['set-cookie'];
      if (!setCookies || setCookies.length === 0) {
        throw new Error('Expected Set-Cookie headers in registration response');
      }

      const tokenCookie = setCookies.find((c) => c.startsWith('nexora_token='));
      if (!tokenCookie) throw new Error('Missing nexora_token in Set-Cookie');
      if (!tokenCookie.includes('HttpOnly')) throw new Error('nexora_token cookie MUST be HttpOnly');
      if (!tokenCookie.includes('SameSite=Lax')) throw new Error('nexora_token cookie MUST specify SameSite=Lax');

      const csrfCookie = setCookies.find((c) => c.startsWith('nexora_csrf='));
      if (!csrfCookie) throw new Error('Missing nexora_csrf in Set-Cookie');
      if (csrfCookie.includes('HttpOnly')) throw new Error('nexora_csrf cookie MUST NOT be HttpOnly (client must read it)');

      if (!res.body?.csrfToken) throw new Error('Expected csrfToken in response JSON');
      csrfTokenValue = res.body.csrfToken;
      sessionCookieHeader = setCookies.map((c) => c.split(';')[0]).join('; ');
    });

    await test('3.2 Login returns session cookies, csrfToken, and valid user object', async () => {
      const res = await makeRequest(port, '/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: registeredEmail,
          password: registeredPassword,
        }),
      });

      if (res.statusCode !== 200) {
        throw new Error(`Expected 200, got ${res.statusCode}`);
      }

      const setCookies = res.headers['set-cookie'];
      if (!setCookies) throw new Error('Missing Set-Cookie on login');
      const tokenCookie = setCookies.find((c) => c.startsWith('nexora_token='));
      if (!tokenCookie?.includes('HttpOnly')) throw new Error('nexora_token must be HttpOnly on login');

      sessionCookieHeader = setCookies.map((c) => c.split(';')[0]).join('; ');
    });

    await test('3.3 GET /auth/me recovers user session purely via Cookie without Authorization header', async () => {
      const res = await makeRequest(port, '/api/v1/auth/me', {
        method: 'GET',
        headers: {
          Cookie: sessionCookieHeader,
        },
      });

      if (res.statusCode !== 200) {
        throw new Error(`Expected 200, got ${res.statusCode}`);
      }
      if (res.body?.user?.email !== registeredEmail) {
        throw new Error(`Expected recovered email ${registeredEmail}, got ${res.body?.user?.email}`);
      }
    });

    await test('3.4 POST /auth/logout clears session and CSRF cookies', async () => {
      const match = sessionCookieHeader.match(/nexora_csrf=([^;]+)/);
      const csrf = match ? match[1] : csrfTokenValue;

      const res = await makeRequest(port, '/api/v1/auth/logout', {
        method: 'POST',
        headers: {
          Cookie: sessionCookieHeader,
          'X-CSRF-Token': csrf,
        },
      });

      if (res.statusCode !== 200) {
        throw new Error(`Expected 200, got ${res.statusCode}`);
      }

      const setCookies = res.headers['set-cookie'];
      if (!setCookies) throw new Error('Expected clearCookie headers on logout');
      const tokenCleared = setCookies.some((c) => c.startsWith('nexora_token=;') || c.includes('Max-Age=0') || c.includes('expires=Thu, 01 Jan 1970'));
      if (!tokenCleared) throw new Error('Expected nexora_token to be cleared on logout');
    });

    // --------------------------------------------------------------------------
    // Test Category 4: P0.4 Bcrypt Cost 12 & Whole-User Session Revocation
    // --------------------------------------------------------------------------
    console.log('\n--- P0.4: Bcrypt Cost 12 & Full Session Revocation ---');

    await test('4.1 New registration generates password hash with cost factor 12 ($2b$12$ or $2a$12$)', async () => {
      const costEmail = `cost12_${Date.now()}@ashouracademy.com`;
      await makeRequest(port, '/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: costEmail,
          password: 'PasswordCost12!',
          fullName: 'فحص التشفير',
          role: 'teach',
        }),
      });

      const user = await db.findUserByEmail(costEmail);
      if (!user) throw new Error('User not found in DB');
      if (!user.password_hash.startsWith('$2b$12$') && !user.password_hash.startsWith('$2a$12$')) {
        throw new Error(`Expected cost factor 12 hash ($2b$12$...), got: ${user.password_hash.substring(0, 10)}`);
      }
    });

    await test('4.2 Backward compatibility: existing cost 10 hash continues to verify correctly', async () => {
      const oldHash10 = await bcrypt.hash('LegacyPassword10!', 10);
      const isMatch = await bcrypt.compare('LegacyPassword10!', oldHash10);
      if (!isMatch) throw new Error('Legacy cost 10 verification failed');
    });

    await test('4.3 Changing password revokes ALL prior active sessions of that user', async () => {
      const pwUserEmail = `pwchange_${Date.now()}@ashouracademy.com`;
      const initialPw = 'InitialSecret123!';
      const newPw = 'UpdatedSecret456!';

      // Register user
      const regRes = await makeRequest(port, '/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: pwUserEmail,
          password: initialPw,
          fullName: 'مستخدم تغيير كلمة المرور',
          role: 'teach',
        }),
      });
      const firstToken = regRes.body.token;

      // Simulate a second session token issued on another device
      const userRecord = (await db.findUserByEmail(pwUserEmail))!;
      const sanitized = (await db.getSanitizedUser(userRecord.id))!;
      const secondDeviceToken = generateToken(sanitized);

      // Verify both tokens currently work
      const testRes1 = await makeRequest(port, '/api/v1/auth/me', {
        headers: { Authorization: `Bearer ${firstToken}` },
      });
      if (testRes1.statusCode !== 200) throw new Error('First token failed before change');

      const testRes2 = await makeRequest(port, '/api/v1/auth/me', {
        headers: { Authorization: `Bearer ${secondDeviceToken}` },
      });
      if (testRes2.statusCode !== 200) throw new Error('Second token failed before change');

      // Change password using first token
      const changeRes = await makeRequest(port, '/api/v1/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${firstToken}`,
        },
        body: JSON.stringify({
          currentPassword: initialPw,
          newPassword: newPw,
        }),
      });
      if (changeRes.statusCode !== 200) {
        throw new Error(`Password change failed: ${JSON.stringify(changeRes.body)}`);
      }

      // Verify the second device token is now immediately REVOKED
      const postChangeRes2 = await makeRequest(port, '/api/v1/auth/me', {
        headers: { Authorization: `Bearer ${secondDeviceToken}` },
      });
      if (postChangeRes2.statusCode !== 401 || postChangeRes2.body?.error !== 'TOKEN_REVOKED') {
        throw new Error(`Expected 401 TOKEN_REVOKED for second device, got ${postChangeRes2.statusCode}`);
      }

      // Verify old password is rejected on login
      const oldLoginRes = await makeRequest(port, '/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: pwUserEmail, password: initialPw }),
      });
      if (oldLoginRes.statusCode !== 401) throw new Error('Expected 401 for old password');

      // Verify new password logs in successfully
      const newLoginRes = await makeRequest(port, '/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: pwUserEmail, password: newPw }),
      });
      if (newLoginRes.statusCode !== 200) throw new Error('Expected 200 for new password');
    });

    // --------------------------------------------------------------------------
    // Test Category 5: P0.5 CORS Strict Allowlist & CSP Hardening
    // --------------------------------------------------------------------------
    console.log('\n--- P0.5: CORS Allowlist & CSP Hardening ---');

    await test('5.1 Authorized origin (https://nexora.ashouracademy.com) is permitted by CORS', async () => {
      const res = await makeRequest(port, '/api/v1/health', {
        headers: { Origin: 'https://nexora.ashouracademy.com' },
      });
      if (res.headers['access-control-allow-origin'] !== 'https://nexora.ashouracademy.com') {
        throw new Error(`Expected access-control-allow-origin, got ${res.headers['access-control-allow-origin']}`);
      }
    });

    await test('5.2 Subdomain (https://portal.ashouracademy.com) is permitted by CORS', async () => {
      const res = await makeRequest(port, '/api/v1/health', {
        headers: { Origin: 'https://portal.ashouracademy.com' },
      });
      if (res.headers['access-control-allow-origin'] !== 'https://portal.ashouracademy.com') {
        throw new Error(`Expected access-control-allow-origin for subdomain`);
      }
    });

    await test('5.3 Deceptive origin (https://evil-ashouracademy.com) is REJECTED with 403 Forbidden', async () => {
      const res = await makeRequest(port, '/api/v1/health', {
        headers: { Origin: 'https://evil-ashouracademy.com' },
      });
      if (res.statusCode !== 403) {
        throw new Error(`VULNERABILITY: Deceptive origin was not blocked! StatusCode: ${res.statusCode}`);
      }
    });

    await test('5.4 Arbitrary attacker origin (https://attacker.com) is REJECTED with 403 Forbidden', async () => {
      const res = await makeRequest(port, '/api/v1/health', {
        headers: { Origin: 'https://attacker.com' },
      });
      if (res.statusCode !== 403) {
        throw new Error(`Expected 403, got ${res.statusCode}`);
      }
    });

    await test('5.5 OPTIONS Preflight request responds with allowed methods including PATCH', async () => {
      const res = await makeRequest(port, '/api/v1/portals', {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://nexora.ashouracademy.com',
          'Access-Control-Request-Method': 'PATCH',
        },
      });
      if (res.statusCode !== 204 && res.statusCode !== 200) {
        throw new Error(`Expected 204 or 200 for OPTIONS preflight, got ${res.statusCode}`);
      }
      const allowedMethods = res.headers['access-control-allow-methods'] || '';
      if (!allowedMethods.includes('PATCH')) {
        throw new Error(`Expected PATCH in allowed methods, got: ${allowedMethods}`);
      }
    });

    await test('5.6 Content-Security-Policy header DOES NOT contain unsafe-eval', async () => {
      const res = await makeRequest(port, '/api/v1/health');
      const csp = res.headers['content-security-policy'] as string;
      if (!csp) throw new Error('Missing Content-Security-Policy header');
      if (csp.includes("'unsafe-eval'")) {
        throw new Error("SECURITY FLAW: CSP still contains 'unsafe-eval'!");
      }
    });

    await test('5.7 Information leakage: x-powered-by header is absent', async () => {
      const res = await makeRequest(port, '/api/v1/health');
      if (res.headers['x-powered-by']) {
        throw new Error(`Expected x-powered-by to be absent, got: ${res.headers['x-powered-by']}`);
      }
    });

  } finally {
    server.close();
  }

  console.log('\n------------------------------------------------------');
  console.log(`P0 Test Summary: ${passedCount} Passed, ${failedCount} Failed out of ${passedCount + failedCount} Tests`);
  console.log('------------------------------------------------------\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runP0SecurityTests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
