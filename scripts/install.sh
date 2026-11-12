#!/usr/bin/env bash
set -euo pipefail

repo="BlazeNebula/dsh-todo-notes"
version="${1:-latest}"
destination="${2:-$HOME/.local/share/dsh-todo-notes}"

api="https://api.github.com/repos/${repo}/releases"
if [ "$version" = "latest" ]; then
  release_json="$(curl -fsSL -H 'User-Agent: dsh-todo-notes-installer' "${api}/latest")"
else
  case "$version" in v*) ;; *) version="v${version}" ;; esac
  release_json="$(curl -fsSL -H 'User-Agent: dsh-todo-notes-installer' "${api}/tags/${version}")"
fi

version="$(printf '%s' "$release_json" | grep -o '"tag_name"[^,]*' | head -n1 | sed 's/.*"v\{0,1\}\([^"]*\)".*/\1/')"
tgz_url="$(printf '%s' "$release_json" | grep -o '"browser_download_url":[^,]*dsh-todo-notes-[^"]*\.tgz"' | head -n1 | sed 's/.*"\(https[^"]*\)".*/\1/')"
sha_url="$(printf '%s' "$release_json" | grep -o '"browser_download_url":[^,]*\.tgz\.sha256"' | head -n1 | sed 's/.*"\(https[^"]*\)".*/\1/')"

if [ -z "$tgz_url" ]; then
  echo "Release v${version} 没有找到 dsh-todo-notes-*.tgz 附件。" >&2
  exit 1
fi

target="${destination}/v${version}"
mkdir -p "$target"
tgz="${target}/$(basename "$tgz_url")"
echo "下载 $(basename "$tgz") ..."
curl -fsSL -o "$tgz" "$tgz_url"

if [ -n "$sha_url" ]; then
  curl -fsSL -o "${tgz}.sha256" "$sha_url"
  (cd "$target" && sha256sum -c "$(basename "$tgz").sha256")
  echo "SHA256 校验通过。"
fi

rm -rf "${target}/package"
mkdir -p "${target}/package"
tar -xzf "$tgz" -C "${target}/package"
plugin_root="${target}/package/package"
if [ ! -f "${plugin_root}/package.json" ]; then
  plugin_root="${target}/package"
fi

echo ""
echo "已解压到：${plugin_root}"
echo "在 DSH 设置 → 插件 → 添加插件，选择上面这个目录即可安装。"
