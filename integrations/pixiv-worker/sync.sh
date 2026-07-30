#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
WRANGLER_CONFIG="${SCRIPT_DIR}/wrangler.toml"
PIXIV_USER_ID="${PIXIV_USER_ID:-17109509}"
PIXIV_LIMIT="${PIXIV_LIMIT:-20}"
PIXIV_PROXY="${PIXIV_PROXY:-socks5h://127.0.0.1:1080}"
PUBLIC_ORIGIN="${PUBLIC_ORIGIN:-https://pixiv-api.dongjunto.xyz}"
SYNC_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "${SYNC_DIR}"
}
trap cleanup EXIT

pixiv_curl() {
  curl --fail --silent --show-error --location \
    --proxy "${PIXIV_PROXY}" \
    --connect-timeout 15 \
    --max-time 60 \
    -H "Accept: application/json" \
    -H "Referer: https://www.pixiv.net/" \
    -H "User-Agent: Mozilla/5.0" \
    "$@"
}

echo "Fetching Pixiv profile ${PIXIV_USER_ID}..."
pixiv_curl "https://www.pixiv.net/ajax/user/${PIXIV_USER_ID}/profile/all?lang=zh" > "${SYNC_DIR}/profile.json"
jq -r --argjson limit "${PIXIV_LIMIT}" \
  '[(.body.illusts // {} | keys[]), (.body.manga // {} | keys[])] | unique | sort_by(tonumber) | reverse | .[:$limit][]' \
  "${SYNC_DIR}/profile.json" > "${SYNC_DIR}/ids.txt"
printf '[]\n' > "${SYNC_DIR}/works.json"

index=0
while IFS= read -r work_id; do
  index=$((index + 1))
  detail_file="${SYNC_DIR}/${work_id}.json"
  image_file="${SYNC_DIR}/${work_id}.image"
  echo "[${index}/${PIXIV_LIMIT}] Syncing artwork ${work_id}..."

  if ! pixiv_curl "https://www.pixiv.net/ajax/illust/${work_id}?lang=zh" > "${detail_file}"; then
    echo "Skipping ${work_id}: detail request failed" >&2
    continue
  fi
  image_source="$(jq -r '.body.urls.small // .body.urls.regular // empty' "${detail_file}")"
  if [[ -z "${image_source}" ]]; then
    echo "Skipping ${work_id}: no image URL" >&2
    continue
  fi
  if ! curl --fail --silent --show-error --location \
    --proxy "${PIXIV_PROXY}" \
    --connect-timeout 15 \
    --max-time 90 \
    -H "Referer: https://www.pixiv.net/" \
    -H "User-Agent: Mozilla/5.0" \
    "${image_source}" > "${image_file}"; then
    echo "Skipping ${work_id}: image request failed" >&2
    continue
  fi

  content_type="$(file -b --mime-type "${image_file}")"
  pnpm --dir "${REPO_ROOT}" dlx wrangler kv key put "image:${work_id}" \
    --path "${image_file}" \
    --metadata "{\"contentType\":\"${content_type}\"}" \
    --binding PIXIV_CACHE \
    --remote \
    --config "${WRANGLER_CONFIG}" > /dev/null

  item="$(jq -c \
    --arg thumbnail "${PUBLIC_ORIGIN}/image/${work_id}" \
    --arg url "https://www.pixiv.net/artworks/${work_id}" \
    '{
      id: (.body.illustId | tostring),
      title: (.body.illustTitle // "Untitled"),
      alt: (.body.alt // .body.illustTitle // "Untitled"),
      url: $url,
      thumbnail: $thumbnail,
      width: (.body.width // 700),
      height: (.body.height // 700),
      pageCount: (.body.pageCount // 1),
      createdAt: (.body.createDate // null),
      tags: [(.body.tags.tags[]? | (.translation.en // .tag))] | .[:6]
    }' "${detail_file}")"
  jq --argjson item "${item}" '. + [$item]' "${SYNC_DIR}/works.json" > "${SYNC_DIR}/works.next.json"
  mv "${SYNC_DIR}/works.next.json" "${SYNC_DIR}/works.json"
done < "${SYNC_DIR}/ids.txt"

jq -n \
  --arg userId "${PIXIV_USER_ID}" \
  --arg profileUrl "https://www.pixiv.net/users/${PIXIV_USER_ID}" \
  --arg updatedAt "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" \
  --slurpfile works "${SYNC_DIR}/works.json" \
  '{userId: $userId, profileUrl: $profileUrl, updatedAt: $updatedAt, works: $works[0]}' \
  > "${SYNC_DIR}/feed.json"

pnpm --dir "${REPO_ROOT}" dlx wrangler kv key put feed \
  --path "${SYNC_DIR}/feed.json" \
  --binding PIXIV_CACHE \
  --remote \
  --config "${WRANGLER_CONFIG}" > /dev/null

work_count="$(jq '.works | length' "${SYNC_DIR}/feed.json")"
echo "Pixiv sync complete: ${work_count} works uploaded to Cloudflare KV."
