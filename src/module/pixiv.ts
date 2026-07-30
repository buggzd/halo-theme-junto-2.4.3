export interface PixivWork {
  id: string;
  title: string;
  url: string;
  thumbnail: string;
  alt?: string;
  width?: number;
  height?: number;
  pageCount?: number;
  tags?: string[];
  createdAt?: string;
}

export interface PixivFeed {
  userId: string;
  profileUrl?: string;
  updatedAt?: string;
  works: PixivWork[];
}

const feedRequests = new Map<string, Promise<PixivFeed>>();

const asHttpUrl = (value: unknown) => {
  if (typeof value !== "string") return "";
  try {
    const url = new URL(value, window.location.href);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
  } catch {
    return "";
  }
};

const normaliseWork = (value: unknown): PixivWork | null => {
  if (!value || typeof value !== "object") return null;
  const work = value as Record<string, unknown>;
  const id = String(work.id || "").trim();
  const url = asHttpUrl(work.url);
  const thumbnail = asHttpUrl(work.thumbnail);
  if (!id || !url || !thumbnail) return null;
  const tags = Array.isArray(work.tags)
    ? work.tags.filter((tag): tag is string => typeof tag === "string").slice(0, 6)
    : [];
  return {
    id,
    title: String(work.title || "Untitled"),
    url,
    thumbnail,
    alt: typeof work.alt === "string" ? work.alt : undefined,
    width: Number.isFinite(Number(work.width)) ? Number(work.width) : undefined,
    height: Number.isFinite(Number(work.height)) ? Number(work.height) : undefined,
    pageCount: Number.isFinite(Number(work.pageCount)) ? Number(work.pageCount) : undefined,
    tags,
    createdAt: typeof work.createdAt === "string" ? work.createdAt : undefined,
  };
};

export const loadPixivFeed = (feedUrl: string): Promise<PixivFeed> => {
  const url = asHttpUrl(feedUrl);
  if (!url) return Promise.reject(new Error("Invalid Pixiv feed URL"));
  const existing = feedRequests.get(url);
  if (existing) return existing;

  const request = (async () => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Pixiv feed returned ${response.status}`);
      const payload = (await response.json()) as Record<string, unknown>;
      const works = (Array.isArray(payload.works) ? payload.works : [])
        .map(normaliseWork)
        .filter((work): work is PixivWork => Boolean(work))
        .slice(0, 60);
      return {
        userId: String(payload.userId || ""),
        profileUrl: asHttpUrl(payload.profileUrl),
        updatedAt: typeof payload.updatedAt === "string" ? payload.updatedAt : undefined,
        works,
      };
    } finally {
      window.clearTimeout(timeout);
    }
  })();
  feedRequests.set(url, request);
  request.catch(() => feedRequests.delete(url));
  return request;
};

export const buildPixivImage = (work: PixivWork) => {
  const image = document.createElement("img");
  image.src = work.thumbnail;
  image.alt = work.alt || work.title;
  image.loading = "lazy";
  image.decoding = "async";
  image.referrerPolicy = "no-referrer";
  image.width = work.width || 700;
  image.height = work.height || 700;
  return image;
};

export const buildPixivLink = (work: PixivWork) => {
  const link = document.createElement("a");
  link.href = work.url;
  link.target = "_blank";
  link.rel = "noreferrer";
  return link;
};
