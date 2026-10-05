#!/bin/sh
set -eu

# Release builds replace this marker; source runs require an explicit version.
release_version="${STRUCTSMITH_VERSION:-__STRUCTSMITH_VERSION__}"
case "$release_version" in
  ''|*[!0-9.]*|.*|*.) echo "Use a released StructSmith version (for example 1.12.0)." >&2; exit 1 ;;
esac
for dependency in curl docker; do
  command -v "$dependency" >/dev/null 2>&1 || { echo "Install $dependency first." >&2; exit 1; }
done
case "$(uname -s)" in
  Darwin) platform=darwin ;;
  Linux) platform=linux ;;
  *) echo "The local launcher supports macOS and Linux." >&2; exit 1 ;;
esac
case "$(uname -m)" in
  arm64|aarch64) architecture=arm64 ;;
  x86_64|amd64) architecture=x64 ;;
  *) echo "Use an arm64 or x64 computer." >&2; exit 1 ;;
esac
artifact="structsmith-local-$platform-$architecture"
release_url="https://github.com/dziksu/StructSmith/releases/download/v$release_version"
umask 077
temporary_directory="$(mktemp -d)"
trap 'rm -rf "$temporary_directory"' EXIT HUP INT TERM
curl -fLsS "$release_url/$artifact" -o "$temporary_directory/$artifact"
curl -fLsS "$release_url/SHA256SUMS" -o "$temporary_directory/SHA256SUMS"
expected="$(awk -v file="$artifact" '$2 == file {print $1}' "$temporary_directory/SHA256SUMS")"
if command -v sha256sum >/dev/null 2>&1; then
  actual="$(sha256sum "$temporary_directory/$artifact" | awk '{print $1}')"
else
  actual="$(shasum -a 256 "$temporary_directory/$artifact" | awk '{print $1}')"
fi
if [ -z "$expected" ] || [ "$actual" != "$expected" ]; then
  echo "The launcher checksum does not match. Nothing was installed." >&2
  exit 1
fi
install_directory="${STRUCTSMITH_LOCAL_DIR:-$HOME/.local/share/structsmith}"
mkdir -p "$install_directory/bin/$release_version"
chmod 700 "$install_directory" "$install_directory/bin" "$install_directory/bin/$release_version"
chmod 755 "$temporary_directory/$artifact"
mv "$temporary_directory/$artifact" "$install_directory/bin/$release_version/structsmith-local"
ln -sf "bin/$release_version/structsmith-local" "$install_directory/structsmith-local"
rm -rf "$temporary_directory"
trap - EXIT HUP INT TERM
exec "$install_directory/structsmith-local" "$@"
