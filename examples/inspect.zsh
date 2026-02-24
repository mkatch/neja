#!zsh

set -e

echo
echo "=== Example: ${1} ======================================================="
echo

cd ./${1}
ls -al

echo
echo "=== Running Neja ========================================================"
echo

../../.neja-build/bin/neja-dev -f neja.ts -C build/inspect -m $@[2,-1]

echo
echo "=== Generated: build.ninja =============================================="
echo

cat -n build/inspect/build.ninja

echo
echo "=== Running Ninja ======================================================="
echo

ninja -C build/inspect

echo
echo "=== Done ================================================================"
echo