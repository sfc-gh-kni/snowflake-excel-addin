#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# Build and push Snowflake Excel Add-in to SPCS Image Registry
# Usage: ./deploy/build.sh <account> [tag]
#   account  — your Snowflake account identifier (e.g. myorg-myaccount)
#   tag      — image tag (default: latest)
# ============================================================

ACCOUNT="${1:?Usage: ./deploy/build.sh <account> [tag]}"
TAG="${2:-latest}"
REGISTRY="${ACCOUNT}.registry.snowflakecomputing.com"
IMAGE="${REGISTRY}/excel_addin_db/app/excel_addin_repo/snowflake-excel-addin:${TAG}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "==> Building React app..."
cd "$PROJECT_DIR"
npm run build

echo "==> Building Docker image: ${IMAGE}"
docker build \
  --platform linux/amd64 \
  -t "$IMAGE" \
  "$PROJECT_DIR"

echo "==> Logging in to Snowflake Image Registry..."
docker login "$REGISTRY" -u "$SNOWFLAKE_USER"

echo "==> Pushing image..."
docker push "$IMAGE"

echo ""
echo "✓ Image pushed: ${IMAGE}"
echo ""
echo "Next steps:"
echo "  1. Run deploy/snowflake.sql in Snowsight to create/update the service"
echo "  2. Check status: CALL SYSTEM\$GET_SERVICE_STATUS('EXCEL_ADDIN_DB.APP.SNOWFLAKE_EXCEL_ADDIN');"
echo "  3. Get endpoint:  SHOW ENDPOINTS IN SERVICE EXCEL_ADDIN_DB.APP.SNOWFLAKE_EXCEL_ADDIN;"
echo "  4. Update manifest.xml with the endpoint URL and sideload to Excel"
