#!/usr/bin/env bash
#
# Enables the project's git hooks (in .githooks/) for this clone.
# Idempotent — safe to run on every `npm install`.

set -euo pipefail

if [ ! -d ".git" ]; then
  echo "Not a git repo (no .git/). Skipping hook setup."
  exit 0
fi

if [ ! -d ".githooks" ]; then
  echo ".githooks/ folder not found. Skipping hook setup."
  exit 0
fi

# Make sure every script in .githooks is executable.
chmod +x .githooks/* 2>/dev/null || true

current="$(git config --local --get core.hooksPath || true)"

if [ "$current" = ".githooks" ]; then
  exit 0
fi

git config --local core.hooksPath .githooks
echo "✓ git hooks enabled — core.hooksPath = .githooks"
echo "  any 'git push' from main will now auto-create a PR"
