#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────────
# backup_srh.sh
#
# Backs up the SRH tenant schema and admin.portal_users rows to
# tmp/srh_backups/ with timestamped filenames.
#
# Outputs the dump file path on a line prefixed with DUMP_FILE= so
# callers can capture it:
#   DUMP=$(bash backup_srh.sh | grep '^DUMP_FILE=' | cut -d= -f2-)
#
# Prerequisites:
#   - .pgpass or PGPASSWORD configured for vimber_admin
#   - Run from the monorepo root
#
# Usage:
#   bash scripts/db/backup_srh.sh
#
# Copyright (c) 2025 Vimber LLC. All rights reserved.
# ────────────────────────────────────────────────────────────────────
set -Eeuo pipefail

# ─── Configuration ────────────────────────────────────────────────
DB_NAME="vimber_dev"
DB_USER="vimber_admin"
SOURCE_SCHEMA="srh"
TENANT_CODE="SRH"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKUP_DIR="$REPO_ROOT/tmp/srh_backups"

mkdir -p "$BACKUP_DIR"

PSQL=(psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1)
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  SRH Schema Backup                                         ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# ══════════════════════════════════════════════════════════════════
# 1a. Custom-format backup (single source of truth)
# ══════════════════════════════════════════════════════════════════
DUMP_FILE="$BACKUP_DIR/srh_schema_${TIMESTAMP}.dump"
pg_dump -U "$DB_USER" -Fc --schema="$SOURCE_SCHEMA" \
  -d "$DB_NAME" -f "$DUMP_FILE"
echo "  Custom dump: srh_schema_${TIMESTAMP}.dump"

# ══════════════════════════════════════════════════════════════════
# 1b. Derive plain SQL from the custom dump (same snapshot)
# ══════════════════════════════════════════════════════════════════
pg_restore -f "$BACKUP_DIR/srh_schema.sql" "$DUMP_FILE"
echo "  Plain SQL:   srh_schema.sql (derived from dump)"

# ══════════════════════════════════════════════════════════════════
# 1c. Backup admin.portal_users rows for the SRH tenant
# ══════════════════════════════════════════════════════════════════
"${PSQL[@]}" -c "\\COPY (
  SELECT u.*
  FROM admin.portal_users u
  JOIN admin.tenants t ON t.id = u.tenant_id
  WHERE t.tenant_code = '$TENANT_CODE'
    AND t.schema_name = '$SOURCE_SCHEMA'
) TO '$BACKUP_DIR/nap_users_srh.csv' WITH (FORMAT csv, HEADER true)"
echo "  portal_users:  portal_users_srh.csv"

echo ""
echo "Backup complete. Files in: $BACKUP_DIR"
echo ""

# Machine-readable output for callers
echo "DUMP_FILE=$DUMP_FILE"
