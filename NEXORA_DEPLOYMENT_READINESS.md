# NEXORA — PRODUCTION DEPLOYMENT READINESS AUDIT
**Platform:** NEXORA Educational Intelligence & Virtual Laboratories  
**Isolated Git Branch:** `production-remediation`  
**Target Domain:** `https://nexora.ashouracademy.com`  
**Root Domain Protection:** `https://ashouracademy.com` (Strict Read-Only Isolation)  
**Host Environment:** Hostinger Cloud / VPS / Container Runtime  
**Audit Standard:** Part 13 Production Readiness & Truthful Verification Protocol  

---

## 1. Production Readiness Status Verdict

```text
================================================================================
  OVERALL STATUS: CODEBASE PRODUCTION READY | RUNTIME ENVIRONMENT PARTIAL
  
  [CODEBASE & ARCHITECTURE] : READY FOR PRODUCTION
  [SECURITY & RBAC MATRIX]  : READY FOR PRODUCTION (OWASP Hardened)
  [API & HEADERS COMPLIANCE]: READY FOR PRODUCTION (CSP, HSTS, Rate Limiting)
  [POSTGRESQL DATABASE]     : PENDING PRODUCTION CONNECTION CONFIGURATION
================================================================================
```

### Truthful Verification Statement (Part 13 Compliance)
- **Local Sandbox Execution:** In the current AI Studio development environment, external PostgreSQL port 5433 is intentionally decoupled and unreachable. The application gracefully and truthfully operates in its in-memory resilient store with explicit diagnostics.
- **Fail-Fast Production Constraint:** When deployed to production (`NODE_ENV=production`), silent fallback is strictly prohibited. The system requires a valid `DATABASE_URL` and will fail fast with `503 DATABASE_UNAVAILABLE` rather than operating on ephemeral memory.
- **No Production Host Touched:** Zero modifications, deployments, or connection attempts were made to any production host, database, DNS, or `public_html`.

---

## 2. Infrastructure & Hosting Architecture

### A. Subdomain Isolation
- **Application URL:** `https://nexora.ashouracademy.com`
- **Root Domain:** `https://ashouracademy.com`
- **Isolation Guarantee:** The NEXORA platform operates as an independent Node.js application mounted strictly under its own subdomain. It does not overwrite, mount inside, or alter files in `public_html` or any WordPress/PHP directories of the root domain.

### B. Upstream Reverse Proxy Configuration (Hostinger Nginx)
NEXORA runs Express listening on `PORT` (e.g., 3000) behind an Nginx reverse proxy. Because `app.set('trust proxy', 1)` is enabled in `server/app.ts`, Express accurately reads client IPs from the single trusted upstream proxy hop.

Recommended Nginx configuration for `nexora.ashouracademy.com`:

```nginx
server {
    listen 443 ssl http2;
    server_name nexora.ashouracademy.com;

    ssl_certificate /etc/letsencrypt/live/nexora.ashouracademy.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/nexora.ashouracademy.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Buffer and timeout settings
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

---

## 3. Node.js Runtime & Build Specifications

- **Declared Engine:** Node.js `>=22.0.0` (compatible with Hostinger Node.js v20/v22 selector)
- **Declared Package Manager:** `npm@10.9.2`
- **Lockfile:** Single canonical `package-lock.json` (conflicting `bun.lock` removed)
- **Production Build Command:**
  ```bash
  npm run build
  ```
  This executes two clean bundle steps:
  1. `vite build` → Bundles React SPA into optimized client assets in `dist/`
  2. `esbuild server.ts --platform=node --format=esm --target=node22 --bundle --packages=external --outfile=dist/server.js` → Bundles TypeScript backend into self-contained ESM executable in `dist/server.js`
- **Production Start Command:**
  ```bash
  npm run start
  # which executes: node dist/server.js
  ```

---

## 4. PostgreSQL Relational Migration Plan

Before opening public traffic on production:

1. **Provision Dedicated PostgreSQL 15+ Database:**
   - Database Name: `nexora_production_db`
   - User: `nexora_app_user` (restricted permissions, non-superuser)
   - Connection string with SSL:
     `postgresql://nexora_app_user:StrongPassword@postgres.hostinger.internal:5432/nexora_production_db?sslmode=require`

2. **Run Core Schema Migration:**
   ```bash
   NODE_ENV=production DATABASE_URL="<SECURE_CONN_STRING>" npm run db:migrate
   ```
   This idempotently applies `/db/migrations/001_core_schema.sql`, creating:
   - `roles` (pre-seeded with 6 educational roles: `LEAD`, `PRO`, `TEACH`, `START`, `STUDENT`, `FAMILY`)
   - `permissions` (pre-seeded with 6 modular permissions)
   - `role_permissions` (pre-seeded role mappings)
   - `users` (with email unique index, role foreign key)
   - `user_profiles` (with cascade delete foreign key)
   - `activity_logs` (with index on `user_id`, `created_at`)
   - `revoked_tokens` (with index on `jti`, `expires_at`)

3. **Verify Health Endpoint:**
   ```bash
   curl -s https://nexora.ashouracademy.com/api/v1/health | jq .
   ```
   Confirm `"database": { "status": "healthy", "driver": "pg (PostgreSQL Relational Persistence)" }`.

---

## 5. Security & Rollback Checkpoints

- **Pre-Deployment Git Checkpoint:** `58076ab` on branch `production-remediation`.
- **Zero-Merge Rule:** Main branch remains untouched and pristine.
- **Rollback Procedure:** If any runtime defect occurs during server start, reverting to previous build artifact or setting previous commit requires only single command without database schema rollback risks (schema is purely additive and backward-compatible).
