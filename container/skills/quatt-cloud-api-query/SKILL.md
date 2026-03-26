---
name: quatt-cloud-api-query
version: 0.5.8
description: Query the Quatt Cloud REST API for user, installation, and device data. Requires Firebase UID authentication — look up from MySQL first.
---

# Quatt Cloud API Query via Atlas

## When to Use

Use this skill when you need to:
- Query Quatt Cloud API endpoints as a specific user
- Inspect installation data, CIC assignments, or device configurations
- Test API responses for debugging or development
- Verify API behavior for specific user accounts

## Critical: MySQL-First Workflow

The API requires a Firebase UID for authentication. **Always look up the UID from MySQL first:**

```bash
# Step 1: Find the Firebase UID
bun run atlas data:quatt-cloud-mysql:query --env=develop \
  --query="SELECT firebaseUid, email FROM user WHERE email='user@example.com' LIMIT 1"

# Step 2: Use the UID to query the API
bun run atlas data:quatt-cloud-api:query --env=develop \
  --user-id=<firebase-uid-from-step-1> \
  --path="/api/v1/me/cics"
```

## How to Invoke

**Locally:**
```bash
bun run atlas data:quatt-cloud-api:query --env=<local|develop|production> --user-id=<firebase-uid> --path="<api-path>"
```

**From any repo:**
```bash
npx @quattio/atlas-cli@latest data:quatt-cloud-api:query --env=<local|develop|production> --user-id=<uid> --path="<api-path>"
```

**Options:**
- `--env=<local|develop|production>` (required) -- Target environment
- `--user-id=<uid>` (required) -- Firebase UID of the user
- `--path="<path>"` (required) -- API endpoint path
- `--method=<GET|POST|PUT|PATCH|DELETE>` -- HTTP method (default: GET)
- `--body='<json>'` -- Request body for POST/PUT/PATCH
- `--allow-writes` -- Enable non-GET methods
- `--format=<json|raw>` -- Output format (default: json)
- `--output=<path>` -- Write output to file

## Key Endpoints

### Customer Endpoints (`/me/*`)
- `GET /api/v1/me/cics` -- User's CIC devices
- `GET /api/v1/me/installations` -- User's installations
- `GET /api/v1/me/profile` -- User profile

### Installer Endpoints (`/installer/*`)
- `GET /api/v1/installer/commissionings` -- Installer's commissioning history

### Admin Endpoints (`/admin/*`)
- `GET /api/v1/admin/installations` -- All installations (admin access required)
- `GET /api/v1/admin/installations/:id` -- Specific installation details

## Environment Notes

### Local (`--env=local`)
- Base URL: `http://localhost:3500`
- No Firebase credentials needed -- the user ID is used directly as the bearer token
- Requires quatt-cloud running locally

### Develop (`--env=develop`)
- Base URL: `https://mobile-api-develop.quatt.io`
- Requires Firebase service account and API key credentials
- Uses development Firebase project for auth

### Production (`--env=production`)
- Base URL: `https://mobile-api.quatt.io`
- Requires production Firebase credentials
- **Use with caution** -- queries real user data

## Security

- **GET** requests are always allowed
- **POST, PUT, PATCH, DELETE** require `--allow-writes` flag
- All requests include `X-Client-Platform: atlas` header for audit trail
- Firebase tokens are short-lived (1 hour)

## Setup

For develop/production environments, set credentials:

```bash
# Firebase service account JSON (the full JSON content, not a file path)
ATLAS_QUATT_API_DEV_FIREBASE_SA='{"type":"service_account",...}'
ATLAS_QUATT_API_PROD_FIREBASE_SA='{"type":"service_account",...}'

# Firebase API key
ATLAS_QUATT_API_DEV_FIREBASE_KEY=AIza...
ATLAS_QUATT_API_PROD_FIREBASE_KEY=AIza...

# Optional: override base URLs
ATLAS_QUATT_API_DEV_URL=https://mobile-api-develop.quatt.io
ATLAS_QUATT_API_PROD_URL=https://mobile-api.quatt.io
```

Or use 1Password: `atlas credentials:status` to check, `atlas credentials:sync` to provision.

## Examples

```bash
# Check user's CICs
bun run atlas data:quatt-cloud-api:query --env=develop \
  --user-id=abc123 --path="/api/v1/me/cics"

# Get installations (local, no Firebase needed)
bun run atlas data:quatt-cloud-api:query --env=local \
  --user-id=test-user --path="/api/v1/me/installations"

# Admin: list all installations
bun run atlas data:quatt-cloud-api:query --env=develop \
  --user-id=admin-uid --path="/api/v1/admin/installations"
```
