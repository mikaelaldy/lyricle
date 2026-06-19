#!/bin/bash
set -e

pnpm install --frozen-lockfile
pnpm --filter db push

# Mirror to GitHub using a temporary credential store (avoids exposing the
# token in process listings that would occur if it were embedded in the URL).
if [ -n "$GITHUB_TOKEN" ]; then
  echo "Syncing to GitHub (mikaelaldy/lyricle)..."

  CRED_FILE=$(mktemp)
  trap 'rm -f "$CRED_FILE"' EXIT

  printf 'https://x-access-token:%s@github.com\n' "$GITHUB_TOKEN" > "$CRED_FILE"
  chmod 600 "$CRED_FILE"

  if git -c "credential.helper=store --file=$CRED_FILE" \
         push https://github.com/mikaelaldy/lyricle.git HEAD:main 2>&1; then
    echo "GitHub sync complete."
  else
    echo "WARNING: GitHub sync failed — the remote may have diverged from" \
         "the Replit workspace (e.g. a direct commit was pushed to GitHub)." \
         "Resolve manually: pull the conflicting changes or force-push from" \
         "a local clone once you are sure the Replit copy is authoritative."
  fi
else
  echo "GITHUB_TOKEN not set — skipping GitHub sync."
fi
