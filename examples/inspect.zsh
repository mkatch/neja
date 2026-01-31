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
node --import ../../build/node_hooks.js ../../build/cli.js -C build

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