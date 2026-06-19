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

  # --force-with-lease: overwrites GitHub only if Replit has seen all its
  # commits. If you pushed from your laptop, this will fail safely instead
  # of silently deleting your work. Resolve by pulling those commits into
  # Replit before the next task merge.
  if git -c "credential.helper=store --file=$CRED_FILE" \
         push --force-with-lease https://github.com/mikaelaldy/lyricle.git HEAD:main 2>&1; then
    echo "GitHub sync complete."
  else
    echo "WARNING: GitHub sync failed — GitHub may have commits Replit hasn't seen" \
         "(e.g. a push from your laptop). Pull those commits into Replit first," \
         "then re-trigger a sync. Check that GITHUB_TOKEN has Contents:write permission" \
         "and has not expired."
  fi
else
  echo "GITHUB_TOKEN not set — skipping GitHub sync."
fi
