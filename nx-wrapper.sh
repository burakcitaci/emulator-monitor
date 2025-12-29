#!/bin/bash
# Wrapper script to suppress Node.js deprecation warnings
export NODE_OPTIONS="--no-deprecation"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$SCRIPT_DIR/node_modules/.bin/nx" "$@"

