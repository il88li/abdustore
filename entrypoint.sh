#!/bin/sh
set -eu
UPLOAD_DIR="${UPLOAD_DIR:-/app/server/uploads}"
mkdir -p "$UPLOAD_DIR"
chown node:node "$UPLOAD_DIR"
exec su-exec node npm run start:prod
