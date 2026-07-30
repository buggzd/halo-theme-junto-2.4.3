# Pixiv Feed Worker

这个 Cloudflare Worker 从 KV 提供用户 `17109509` 的公开 Pixiv 作品和缩略图。同步脚本通过本机 V2Ray 读取 Pixiv，再上传到 KV；主题浏览器始终只请求 `pixiv-api.dongjunto.xyz`，不需要保存 Pixiv 密码、Cookie 或 refresh token。

## 部署

在仓库根目录执行：

```bash
pnpm dlx wrangler login
pnpm dlx wrangler deploy --config integrations/pixiv-worker/wrangler.toml
```

`wrangler.toml` 已声明 `pixiv-api.dongjunto.xyz` Custom Domain，并绑定 `PIXIV_CACHE` KV。部署成功后 Wrangler 会自动维护 DNS 和 HTTPS 证书。

## 同步作品

确认本机 V2Ray 的 SOCKS5 端口 `1080` 正在运行，然后执行：

```bash
./integrations/pixiv-worker/sync.sh
```

脚本默认同步最近 20 个作品。发布新作品后重新运行一次即可。端口或数量不同时可以覆盖环境变量：

```bash
PIXIV_PROXY=socks5h://127.0.0.1:1080 PIXIV_LIMIT=30 \
  ./integrations/pixiv-worker/sync.sh
```

访问 `https://pixiv-api.dongjunto.xyz/feed`，应返回包含 `works` 数组的 JSON。然后进入 Halo 后台：

1. 打开 **主题 → Junto Blue Archive → 设置 → 相册页**。
2. 将“视觉作品来源”改为 **Pixiv（Cloudflare 代理）**。
3. 将“Pixiv Feed 地址”设为 `https://pixiv-api.dongjunto.xyz/feed`。
4. 保持 Halo 图库兜底开启，再保存设置。

同步脚本使用 Pixiv 的公开网页接口；如果 Pixiv 将来更改响应格式，只需更新同步脚本，主题端数据格式无需变化。作品 Feed 在浏览器端缓存 5 分钟，图片在 Cloudflare 边缘缓存 7 天。
