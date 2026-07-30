const PIXIV_ORIGIN = "https://www.pixiv.net";
const PIXIV_IMAGE_HOST = "i.pximg.net";
const PIXIV_HEADERS = {
  Accept: "application/json",
  Referer: `${PIXIV_ORIGIN}/`,
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
};

const json = (body, status, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });

const corsHeaders = (env) => ({
  "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Accept, Content-Type",
});

const pixivJson = async (pathname, timeoutMs = 10000) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("Pixiv upstream timed out"), timeoutMs);
  try {
    const response = await fetch(`${PIXIV_ORIGIN}${pathname}`, {
      headers: PIXIV_HEADERS,
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Pixiv returned ${response.status}`);
    const payload = await response.json();
    if (payload.error) throw new Error(payload.message || "Pixiv returned an error");
    return payload.body;
  } catch (error) {
    if (controller.signal.aborted) throw new Error(`Pixiv upstream timed out after ${timeoutMs}ms`);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

const cleanText = (value, fallback = "") =>
  String(value || fallback)
    .replace(/\s+/g, " ")
    .trim();

const loadWork = async (id, userId, imageEndpoint) => {
  try {
    const work = await pixivJson(`/ajax/illust/${encodeURIComponent(id)}?lang=zh`);
    if (String(work.userId) !== String(userId)) return null;
    const source = work.urls?.small || work.urls?.regular || work.urls?.mini;
    if (!source) return null;
    const imageUrl = new URL(imageEndpoint);
    imageUrl.searchParams.set("url", source);
    return {
      id: String(work.illustId || id),
      title: cleanText(work.illustTitle, "Untitled"),
      alt: cleanText(work.alt, work.illustTitle),
      url: `${PIXIV_ORIGIN}/artworks/${encodeURIComponent(id)}`,
      thumbnail: imageUrl.href,
      width: Number(work.width) || undefined,
      height: Number(work.height) || undefined,
      pageCount: Number(work.pageCount) || 1,
      createdAt: work.createDate || undefined,
      tags: Array.isArray(work.tags?.tags)
        ? work.tags.tags
            .map((tag) => cleanText(tag.translation?.en || tag.tag))
            .filter(Boolean)
            .slice(0, 6)
        : [],
    };
  } catch {
    return null;
  }
};

const imageEndpointFor = (requestUrl) => {
  const endpoint = new URL(requestUrl);
  endpoint.search = "";
  endpoint.pathname = endpoint.pathname.replace(/\/feed\/?$/, "/image");
  if (!endpoint.pathname.endsWith("/image")) endpoint.pathname = `${endpoint.pathname.replace(/\/$/, "")}/image`;
  return endpoint;
};

const loadFeed = async (request, env) => {
  const requestUrl = new URL(request.url);
  const userId = cleanText(env.PIXIV_USER_ID || requestUrl.searchParams.get("user") || "17109509");
  if (!/^\d+$/.test(userId)) throw new Error("PIXIV_USER_ID must be numeric");
  const requestedLimit = Number(requestUrl.searchParams.get("limit") || env.FEED_LIMIT || 20);
  const limit = Math.max(1, Math.min(24, Number.isFinite(requestedLimit) ? Math.floor(requestedLimit) : 20));
  const profile = await pixivJson(`/ajax/user/${encodeURIComponent(userId)}/profile/all?lang=zh`);
  const ids = [...Object.keys(profile.illusts || {}), ...Object.keys(profile.manga || {})]
    .filter((id, index, all) => all.indexOf(id) === index)
    .sort((left, right) => Number(right) - Number(left))
    .slice(0, limit);
  const works = (await Promise.all(ids.map((id) => loadWork(id, userId, imageEndpointFor(request.url))))).filter(
    Boolean
  );
  return {
    userId,
    profileUrl: `${PIXIV_ORIGIN}/users/${userId}`,
    updatedAt: new Date().toISOString(),
    works,
  };
};

const handleFeed = async (request, env, context) => {
  const storedFeed = await env.PIXIV_CACHE?.get("feed", { type: "json", cacheTtl: 60 });
  if (storedFeed?.works?.length) {
    return json(storedFeed, 200, {
      ...corsHeaders(env),
      "Cache-Control": "public, max-age=300, s-maxage=1800",
    });
  }

  const requestUrl = new URL(request.url);
  const userId = env.PIXIV_USER_ID || requestUrl.searchParams.get("user") || "17109509";
  const limit = requestUrl.searchParams.get("limit") || env.FEED_LIMIT || "20";
  const cacheUrl = new URL(request.url);
  cacheUrl.search = new URLSearchParams({ user: String(userId), limit: String(limit) }).toString();
  const cacheKey = new Request(cacheUrl.href, { method: "GET" });
  const cache = caches.default;
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  try {
    const feed = await loadFeed(request, env);
    const response = json(feed, 200, {
      ...corsHeaders(env),
      "Cache-Control": `public, max-age=300, s-maxage=${Number(env.CACHE_TTL) || 1800}`,
    });
    context.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  } catch (error) {
    return json(
      { error: "pixiv_feed_unavailable", message: error instanceof Error ? error.message : "Unknown error" },
      502,
      { ...corsHeaders(env), "Cache-Control": "no-store" }
    );
  }
};

const handleImage = async (request, env, context) => {
  const requestUrl = new URL(request.url);
  const cache = caches.default;
  const cacheKey = new Request(requestUrl.href, { method: "GET" });
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const imageId = requestUrl.pathname.match(/\/image\/(\d+)\/?$/)?.[1];
  if (imageId && env.PIXIV_CACHE) {
    const stored = await env.PIXIV_CACHE.getWithMetadata(`image:${imageId}`, {
      type: "arrayBuffer",
      cacheTtl: 300,
    });
    if (stored.value) {
      const response = new Response(stored.value, {
        status: 200,
        headers: {
          ...corsHeaders(env),
          "Content-Type": stored.metadata?.contentType || "image/jpeg",
          "Cache-Control": `public, max-age=86400, s-maxage=${Number(env.IMAGE_CACHE_TTL) || 604800}`,
          "X-Content-Type-Options": "nosniff",
        },
      });
      context.waitUntil(cache.put(cacheKey, response.clone()));
      return response;
    }
  }

  const sourceValue = requestUrl.searchParams.get("url") || "";
  let source;
  try {
    source = new URL(sourceValue);
  } catch {
    return json({ error: "invalid_image_url" }, 400, corsHeaders(env));
  }
  if (source.protocol !== "https:" || source.hostname !== PIXIV_IMAGE_HOST || source.href.length > 2048) {
    return json({ error: "image_host_not_allowed" }, 403, corsHeaders(env));
  }

  const upstream = await fetch(source.href, {
    headers: {
      Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      Referer: `${PIXIV_ORIGIN}/`,
      "User-Agent": PIXIV_HEADERS["User-Agent"],
    },
  });
  if (!upstream.ok || !upstream.body) {
    return json({ error: "image_unavailable" }, upstream.status || 502, corsHeaders(env));
  }
  const response = new Response(upstream.body, {
    status: 200,
    headers: {
      ...corsHeaders(env),
      "Content-Type": upstream.headers.get("Content-Type") || "image/jpeg",
      "Cache-Control": `public, max-age=86400, s-maxage=${Number(env.IMAGE_CACHE_TTL) || 604800}`,
      "X-Content-Type-Options": "nosniff",
    },
  });
  context.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
};

export default {
  async fetch(request, env, context) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(env) });
    if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405, corsHeaders(env));
    const pathname = new URL(request.url).pathname.replace(/\/$/, "") || "/";
    if (pathname === "/" || pathname.endsWith("/feed")) return handleFeed(request, env, context);
    if (pathname.endsWith("/image") || /\/image\/\d+$/.test(pathname)) return handleImage(request, env, context);
    return json({ error: "not_found" }, 404, corsHeaders(env));
  },
};
