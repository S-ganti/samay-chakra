#!/bin/bash
# Render every registered scene composition via Flick's renderer (skips ones passed in SKIP).
cd "$(dirname "$0")"
SKIP=" ${SKIP:-} "
ids=$(cd remotion && npx remotion compositions src/index.tsx -q 2>/dev/null | tr ' ' '\n' | grep -E -- '-(v|h)$')
for c in $ids; do
  [[ "$SKIP" == *" $c "* ]] && continue
  echo "=== $c $(date +%T)"
  node /root/.claude/skills/flick/scripts/render-scene.mjs --project . --composition "$c" --name "$c" > "logs/$c.log" 2>&1 && echo "ok $c" || echo "FAIL $c"
done
echo DONE
