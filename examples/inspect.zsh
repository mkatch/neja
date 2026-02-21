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

mkdir -p build
../../.neja-build/bin/neja-dev -f neja.ts -C build $@[2,-1]

echo
echo "=== Generated: rules.ninja =============================================="
echo

cat -n build/rules.ninja

echo
echo "=== Generated: build.ninja =============================================="
echo

cat -n build/build.ninja

echo
echo "=== Running Ninja ======================================================="
echo

ninja -C build

echo
echo "=== Done ================================================================"
echo