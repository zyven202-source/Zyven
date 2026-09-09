#!/bin/sh
set -e

export PATH="$(pwd)/node_modules/.bin:$PATH"

# Type check
if command -v tsc >/dev/null 2>&1; then
  tsc -b
else
  echo "Warning: tsc not found, skipping type check"
fi

# Build with vite
if command -v vite >/dev/null 2>&1; then
  vite build
else
  echo "Error: vite not found in node_modules/.bin" >&2
  exit 1
fi
