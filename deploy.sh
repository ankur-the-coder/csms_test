#!/usr/bin/env bash
# Put this in the repo root (/home/ubuntu/ubicsms/Ubi_CSMS) and commit it.
# Every deploy:   cd /home/ubuntu/ubicsms/Ubi_CSMS && bash deploy.sh
# Builds the main app + the <ubi-client-portal> embed (what build:vercel did) and swaps it into
# dist/CSMS/browser (the folder nginx already serves) in one quick step, so the site is never half-built.
set -euo pipefail
cd "$(dirname "$0")"
export NODE_OPTIONS="--max-old-space-size=3072"

git pull --ff-only
npm ci

rm -rf dist-staging
npx ng build --output-path=dist-staging/CSMS          # -> dist-staging/CSMS/browser
npx ng run CSMS:build-embed                           # -> dist/embed/browser
mkdir -p dist-staging/CSMS/browser/embed
cp -r dist/embed/browser/. dist-staging/CSMS/browser/embed/

test -f dist-staging/CSMS/browser/embed/main.js    || { echo "embed/main.js missing - NOT deploying"; exit 1; }
test -f dist-staging/CSMS/browser/embed/styles.css || { echo "embed/styles.css missing - NOT deploying"; exit 1; }
test -f dist-staging/CSMS/browser/index.html       || { echo "index.html missing - NOT deploying"; exit 1; }

# swap (two renames = near-instant)
mkdir -p dist
rm -rf dist/CSMS.old
[ -d dist/CSMS ] && mv dist/CSMS dist/CSMS.old
mv dist-staging/CSMS dist/CSMS
rm -rf dist-staging dist/CSMS.old
echo "Deployed. Verify: curl -I https://csms.ubitechsolutions.com/embed/main.js"
