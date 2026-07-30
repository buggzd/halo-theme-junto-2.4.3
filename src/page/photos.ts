import { documentFunction, sakura } from "../main";
import { buildPixivImage, buildPixivLink, loadPixivFeed, type PixivWork } from "../module/pixiv";

export default class Photos {
  /**
   * 注册经典布局相册，暂时未找到 vanilla js 的版本，暂不实现。
   *
   * @see http://miromannino.github.io/Justified-Gallery
   */
  @documentFunction(false)
  public registerJustifyLayout() {}

  /** 注册 Halo 或 Pixiv 瀑布流布局。 */
  @documentFunction()
  public registerMasonryLayout() {
    const pixivContainer = document.querySelector<HTMLElement>("[data-junto-pixiv-gallery]");
    if (pixivContainer) {
      void this.registerPixivGallery(pixivContainer);
      return;
    }
    document
      .querySelectorAll<HTMLElement>(".masonry-container")
      .forEach((container) => void this.initialiseMasonry(container));
  }

  private async registerPixivGallery(container: HTMLElement) {
    if (container.dataset.juntoPixivLoaded) return;
    container.dataset.juntoPixivLoaded = "loading";
    const gallery = container.querySelector<HTMLElement>("[data-junto-pixiv-grid]");
    const status = container.querySelector<HTMLElement>("[data-junto-pixiv-status]");
    const feedUrl = container.dataset.juntoPixivFeed || "";
    try {
      const feed = await loadPixivFeed(feedUrl);
      if (!gallery || !feed.works.length) throw new Error("Pixiv feed is empty");
      gallery.replaceChildren(...feed.works.map((work, index) => this.buildPixivCard(work, index)));
      if (status) status.hidden = true;
      container.dataset.juntoPixivLoaded = "true";
      await this.initialiseMasonry(container);
    } catch (error) {
      console.warn("Pixiv gallery unavailable", error);
      container.dataset.juntoPixivLoaded = "error";
      const fallback = document.querySelector<HTMLElement>("[data-junto-halo-photos-fallback]");
      if (fallback) {
        container.hidden = true;
        fallback.hidden = false;
        const fallbackContainer = fallback.querySelector<HTMLElement>(".masonry-container");
        if (fallbackContainer) await this.initialiseMasonry(fallbackContainer);
        return;
      }
      if (status) {
        const message = status.querySelector("span");
        if (message) message.textContent = "画面暂时迷失在途中，稍后再来看看。";
        status.classList.add("is-error");
      }
      container.querySelector(".photos-content")?.classList.remove("loading");
    }
  }

  private buildPixivCard(work: PixivWork, index: number) {
    const figure = document.createElement("figure");
    const column = sakura.getThemeConfig("photos", "masonry_column", Number)?.valueOf() || 3;
    figure.className = `gallery-item junto-art-card col-${column}`;

    const header = document.createElement("header");
    header.className = "gallery-icon";
    const imageLink = buildPixivLink(work);
    imageLink.append(buildPixivImage(work));
    header.append(imageLink);

    const caption = document.createElement("figcaption");
    const eyebrow = document.createElement("span");
    eyebrow.className = "junto-eyebrow";
    const pages = work.pageCount && work.pageCount > 1 ? ` × ${work.pageCount} PAGES` : "";
    eyebrow.textContent = `${String(index + 1).padStart(2, "0")} / PIXIV${pages}`;
    const title = document.createElement("h3");
    const titleLink = buildPixivLink(work);
    titleLink.textContent = work.title;
    title.append(titleLink);
    caption.append(eyebrow, title);

    const metaParts = [
      this.formatDate(work.createdAt),
      ...(work.tags || []).slice(0, 3).map((tag) => `#${tag}`),
    ].filter(Boolean);
    if (metaParts.length) {
      const meta = document.createElement("p");
      meta.textContent = metaParts.join(" · ");
      caption.append(meta);
    }
    figure.append(header, caption);
    return figure;
  }

  private formatDate(value?: string) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  }

  private async initialiseMasonry(masonryContainerElement: HTMLElement) {
    if (masonryContainerElement.dataset.juntoMasonryReady) return;
    const galleryElement = masonryContainerElement.querySelector<HTMLElement>(".gallery");
    if (!galleryElement) return;
    masonryContainerElement.dataset.juntoMasonryReady = "true";

    // @ts-ignore isotope-layout does not publish bundled TypeScript declarations.
    const module = await import("isotope-layout");
    const galleryLayout = new module.default(galleryElement, {
      layoutMode: "masonry",
      masonry: { gutter: 10 },
      itemSelector: ".gallery-item",
    });

    galleryElement.querySelectorAll("img").forEach((image) => {
      if (!image.complete) image.addEventListener("load", () => galleryLayout.layout(), { once: true });
    });
    requestAnimationFrame(() => {
      galleryLayout.layout();
      masonryContainerElement.querySelector(".photos-content")?.classList.remove("loading");
    });

    const galleryFilterbarElement = masonryContainerElement.querySelector("#gallery-filter");
    const galleryFilterbarItemsElement = galleryFilterbarElement?.querySelectorAll<HTMLElement>("li span");
    const defaultGroup = sakura.getThemeConfig("photos", "default_group", String)?.valueOf();
    galleryFilterbarItemsElement?.forEach((filterElement, index) => {
      const filter = filterElement.getAttribute("data-filter") || "*";
      if (defaultGroup && filter === `.${defaultGroup}`) {
        galleryFilterbarItemsElement[0]?.classList.remove("active");
        filterElement.classList.add("active");
        galleryLayout.arrange({ filter });
      }
      filterElement.addEventListener("click", (event) => {
        event.preventDefault();
        if (filterElement.classList.contains("active")) return;
        galleryFilterbarItemsElement.forEach((item) => item.classList.remove("active"));
        filterElement.classList.add("active");
        galleryLayout.arrange({ filter });
      });
      if (index === 0 && !defaultGroup) filterElement.classList.add("active");
    });

    const gridChangeElements = masonryContainerElement.querySelectorAll<HTMLElement>("#grid-changer span");
    gridChangeElements.forEach((gridChangeElement) => {
      gridChangeElement.addEventListener("click", () => {
        gridChangeElements.forEach((item) => item.classList.remove("active"));
        gridChangeElement.classList.add("active");
        const column = gridChangeElement.getAttribute("data-col") || "3";
        galleryElement.querySelectorAll<HTMLElement>(".gallery-item").forEach((item) => {
          Array.from(item.classList)
            .filter((className) => className.startsWith("col-"))
            .forEach((className) => item.classList.remove(className));
          item.classList.add(`col-${column}`);
        });
        galleryLayout.layout();
      });
    });
  }
}
