#!/usr/bin/env bash
# Service-role key leak gate — Phase 01 Foundation, Plan 04, Task 3.
#
# Proves the dual-client boundary (FND-02) actually holds at build time: the
# Supabase service-role key must NEVER reach client/browser output, and no
# NEXT_PUBLIC_*SERVICE_ROLE var may exist. The admin client (src/lib/supabase/
# admin.js) is `import "server-only"` and reads non-public env vars, so its key
# must appear nowhere in .next/static or the client-facing app server chunks.
#
# Run: npm run check:leak   (expects SUPABASE_SERVICE_ROLE_KEY in env)
# Exits 0 + PASS when clean; non-zero + FAIL on any finding.
#
# Reusable regression check for Phases 4-7.

set -euo pipefail

# Load .env.local if present so the key is available without exporting by hand.
if [ -f .env.local ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env.local
  set +a
fi

KEY="${SUPABASE_SERVICE_ROLE_KEY:?set SUPABASE_SERVICE_ROLE_KEY in env (or .env.local) before running}"

echo "Building production bundle (npm run build)..."
npm run build >/dev/null

# Browser/static output + the App Router server build are what could ship the
# key to a client. Grep whichever of these exist in this Next.js layout.
SCAN_DIRS=()
[ -d .next/static ] && SCAN_DIRS+=(.next/static)
[ -d .next/server/app ] && SCAN_DIRS+=(.next/server/app)
[ -d .next/server/chunks ] && SCAN_DIRS+=(.next/server/chunks)

if [ "${#SCAN_DIRS[@]}" -eq 0 ]; then
  echo "FAIL: no .next build output found to scan (did the build succeed?)"; exit 1
fi

# 1. The literal service-role key must not appear in client/static output.
if grep -rqF -- "$KEY" "${SCAN_DIRS[@]}" 2>/dev/null; then
  echo "FAIL: service-role key found in build output (${SCAN_DIRS[*]})"; exit 1
fi

# 2. No NEXT_PUBLIC_*SERVICE_ROLE var may be embedded anywhere in .next.
if grep -rqiE 'NEXT_PUBLIC_[A-Z_]*SERVICE_ROLE' .next 2>/dev/null; then
  echo "FAIL: NEXT_PUBLIC_ service-role var detected in build output"; exit 1
fi

echo "PASS: no service-role key and no NEXT_PUBLIC_ service-role var in client bundle."
