# NEXORA — ENVIRONMENT VARIABLES CONFIGURATION SPECIFICATION
**Platform:** NEXORA Educational Intelligence & Virtual Laboratories  
**Target Domain:** `https://nexora.ashouracademy.com`  
**Security Notice:** Do NOT store real credentials, secrets, or production passwords in version control.

---

## 1. Quick Reference Matrix

| Variable Name | Required in Prod? | Default (Dev) | Description & Security Policy |
| :--- | :---: | :--- | :--- |
| `NODE_ENV` | **YES** | `development` | Runtime mode. Must be `production` on live hosting. |
| `PORT` | Optional | `3000` | Port for Express server to bind. |
| `DATABASE_URL` | **YES** | None (Sandbox) | PostgreSQL 15+ connection URI with SSL query params. |
| `DB_POOL_MAX` | Optional | `10` | Bounded connection pool size (range: 1 to 50). |
| `DB_SSL` | **YES** | `false` (Dev only) | Enforce TLS encryption for remote database. |
| `DB_SSL_REJECT_UNAUTHORIZED` | **YES** | `true` | Validates database TLS certificate against CA. |
| `DB_SSL_CA` | Optional | None | Inline PEM certificate for self-hosted database clusters. |
| `DB_SSL_CA_PATH` | Optional | None | Absolute path to CA certificate PEM file. |
| `JWT_SECRET` | **YES** | None (Dev fallback) | Cryptographic HMAC-SHA256 secret key (minimum 32 characters). |
| `JWT_EXPIRES_IN` | Optional | `7d` | Token lifetime duration string (e.g. `1d`, `7d`). |
| `AUTH_RATE_LIMIT_MAX` | Optional | `30` | Maximum login/auth attempts per IP per window. |
| `AUTH_RATE_LIMIT_WINDOW_MS` | Optional | `600000` (10m) | Sliding window duration in milliseconds. |
| `CORS_ORIGIN` | Optional | None | Additional allowed CORS origin (subdomains supported automatically). |
| `GEMINI_API_KEY` | Optional | None | Google Gen AI API key for server-side AI models (`gemini-2.5-flash`). |
| `ALLOW_INSECURE_DEV_MEMORY` | **NO** | `false` | In-memory bypass. MUST NOT be set in production! |

---

## 2. Production `.env` Template (`.env.production`)

```bash
# ==============================================================================
# NEXORA PRODUCTION ENVIRONMENT CONFIGURATION
# Platform Subdomain: https://nexora.ashouracademy.com
# ==============================================================================

# 1. RUNTIME & SERVER
NODE_ENV=production
PORT=3000

# 2. POSTGRESQL RELATIONAL PERSISTENCE (MANDATORY IN PRODUCTION)
# Use SSL mode 'require' or 'verify-full' for remote database
DATABASE_URL=postgresql://nexora_db_user:YOUR_STRONG_DB_PASSWORD@postgres.hostinger.internal:5432/nexora_production_db?sslmode=require
DB_POOL_MAX=15
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=true

# Optional: Path to custom CA if connecting to Supabase / AWS RDS / DigitalOcean Managed DB
# DB_SSL_CA_PATH=/etc/ssl/certs/db-ca-certificate.crt

# 3. AUTHENTICATION & JWT SECURITY (MANDATORY IN PRODUCTION)
# Generate via: openssl rand -base64 48 (min 32 characters required)
JWT_SECRET=c2VjdXJlX25leG9yYV9wcm9kdWN0aW9uX2tleV8yMDI2X2FzaG91cmFjYWRlbXk=
JWT_EXPIRES_IN=7d

# 4. RATE LIMITING & BRUTE-FORCE DEFENSE
AUTH_RATE_LIMIT_MAX=30
AUTH_RATE_LIMIT_WINDOW_MS=600000

# 5. CORS ALLOWLIST
# Subdomains *.ashouracademy.com are permitted automatically.
CORS_ORIGIN=https://nexora.ashouracademy.com

# 6. ARTIFICIAL INTELLIGENCE (GEMINI API)
# Acquired from Google AI Studio. Calls executed strictly server-side.
GEMINI_API_KEY=AIzaSyYOUR_ACTUAL_GEMINI_API_KEY_HERE

# 7. SAFETY CONSTRAINTS (STRICTLY FORBIDDEN IN PRODUCTION)
# Must remain commented or unset in production
# ALLOW_INSECURE_DEV_MEMORY=false
```

---

## 3. Local Development `.env` Template (`.env.local`)

```bash
# ==============================================================================
# NEXORA LOCAL OFFLINE DEVELOPMENT SANDBOX
# ==============================================================================
NODE_ENV=development
PORT=3000

# Leave DATABASE_URL empty to use in-memory resilient store for quick frontend testing
DATABASE_URL=
ALLOW_INSECURE_DEV_MEMORY=true

# Development secret
JWT_SECRET=nexora_secure_development_secret_key_3.1
JWT_EXPIRES_IN=7d

# Optional local Gemini key
GEMINI_API_KEY=
```

---

## 4. Key Security Rules

1. **Secret Generation:** Always generate `JWT_SECRET` with cryptographic randomness:
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
   ```
2. **Production Fail-Fast:** If `NODE_ENV === 'production'` and `JWT_SECRET` is shorter than 32 characters or equals the dev fallback, the application throws `FATAL_SECURITY_ERROR` and halts immediately.
3. **Database Guardrail:** If `NODE_ENV === 'production'` and `DATABASE_URL` is missing, all persistent endpoints throw `503 DATABASE_UNAVAILABLE`.
