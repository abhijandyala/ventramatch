#!/usr/bin/env bash
#
# Manual escape hatch: ship the current branch to a remote branch + PR.
#
# Usage:
#   npm run ship                # auto-name the branch
#   npm run ship -- my-feature  # explicit branch name
#
# If you're on main, behaves the same as the pre-push hook.
# If you're already on a feature branch, just pushes it and opens a PR.

set -euo pipefail

REMOTE="origin"
PROTECTED_BRANCH="main"

if ! command -v gh >/dev/null 2>&1; then
  echo "'gh' CLI not installed. Install:  brew install gh && gh auth login"
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "'gh' not authenticated. Run:  gh auth login"
  exit 1
fi

current="$(git symbolic-ref --quiet --short HEAD)"
explicit_name="${1:-}"

if [ "$current" = "$PROTECTED_BRANCH" ]; then
  short_sha="$(git rev-parse --short=7 HEAD)"
  branch_name="${explicit_name:-auto/$(date -u +%Y%m%d-%H%M%S)-${short_sha}}"
  git checkout -b "$branch_name"
else
  branch_name="${explicit_name:-$current}"
  if [ "$branch_name" != "$current" ]; then
    git branch -m "$current" "$branch_name"
  fi
fi

git push --no-verify -u "$REMOTE" "$branch_name"

title="$(git log -1 --format=%s)"
author="$(git log -1 --format='%an <%ae>')"

body="$(cat <<EOF
Manually shipped via \`npm run ship\`.

- Author: $author
- Branch: \`$branch_name\`
EOF
)"

# Reuse existing PR if one is already open for this branch.
existing="$(gh pr view "$branch_name" --json url -q .url 2>/dev/null || true)"
if [ -n "$existing" ]; then
  echo "✓ existing PR: $existing"
else
  pr_url="$(gh pr create --base "$PROTECTED_BRANCH" --head "$branch_name" --title "$title" --body "$body")"
  echo "✓ PR opened: $pr_url"
fi

# If we started on main, snap local main back to origin/main.
if [ "$current" = "$PROTECTED_BRANCH" ] && git fetch --quiet "$REMOTE" "$PROTECTED_BRANCH"; then
  git update-ref "refs/heads/$PROTECTED_BRANCH" "refs/remotes/$REMOTE/$PROTECTED_BRANCH"
fi
