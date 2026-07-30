import { documentFunction, sakura } from "../main";
import { buildPixivImage, buildPixivLink, loadPixivFeed, type PixivWork } from "../module/pixiv";

export default class Index {
  /**
   * 注册下拉箭头功能
   */
  @documentFunction()
  public registerArrowDown() {
    const arrowDownElement = document.querySelector(".headertop-down");
    if (arrowDownElement) {
      import("font-awesome-animation/css/font-awesome-animation.min.css");
    }
    arrowDownElement?.addEventListener("click", () => {
      const contentOffset = document.querySelector(".site-content")?.getBoundingClientRect().top || 0;
      window.scrollTo({
        top: contentOffset + +window.pageYOffset,
        behavior: "smooth",
      });
    });
  }

  /**
   * 注册背景切换事件
   */
  @documentFunction()
  public registerBackgroundChangeEvent() {
    const backgorundElement = document.querySelector(".bg-change-js") as HTMLImageElement;
    if (!backgorundElement) {
      return;
    }
    const backgroundNextBotton = document.getElementById("bg-next");
    const backgroundPrevBotton = document.getElementById("bg-prev");
    const backgroundLoopSize = (sakura.getThemeConfig("random_image", "rimage_cover_back_num", Number) || 0).valueOf();
    backgroundNextBotton?.addEventListener("click", () => {
      let currIndex = Number(backgorundElement.getAttribute("data-currIndex"));
      if (backgroundLoopSize === 0) {
        currIndex = Math.ceil(Math.random() * 99);
      } else {
        currIndex = (currIndex + 1) % backgroundLoopSize;
      }
      handlerChangeBackground(currIndex);
    });

    backgroundPrevBotton?.addEventListener("click", () => {
      let currIndex = Number(backgorundElement.getAttribute("data-currIndex"));
      if (backgroundLoopSize === 0) {
        currIndex = Math.ceil(Math.random() * 99);
      } else {
        currIndex = (currIndex - 1 + backgroundLoopSize) % backgroundLoopSize;
      }
      handlerChangeBackground(currIndex);
    });
    const handlerChangeBackground = (backageImageIndex: number) => {
      const randomUrl = backgorundElement.getAttribute("data-url");
      backgorundElement.src = `${randomUrl}&t=${backageImageIndex}`;
      backgorundElement.setAttribute("data-currIndex", `${backageImageIndex}`);
    };
  }

  /**
   * 注册背景视频功能
   */
  @documentFunction()
  public registerBackgroundVideo() {
    const videoContainerElement = document.querySelector(".video-container");
    if (!videoContainerElement) {
      return;
    }
    videoContainerElement.insertAdjacentElement("afterbegin", document.createElement("video"));
    const videoStatusElement = videoContainerElement.querySelector(".video-status") as HTMLDivElement;
    const focusInfoElement = document.querySelector(".focusinfo") as HTMLDivElement;
    const homeWaveElement = document.querySelector(".home-wave") as HTMLDivElement;
    const videoPlayButtonElement = videoContainerElement.querySelector(".video-play") as HTMLDivElement;
    const videoPauseButtonElement = videoContainerElement.querySelector(".video-pause") as HTMLDivElement;

    let videoPlayer: any = undefined;
    videoPlayButtonElement?.addEventListener("click", async () => {
      videoStatusElement.innerHTML = sakura.translate("home.video.loading", "正在载入视频 ...");
      videoStatusElement.style.bottom = "0";
      import("video.js")
        .then((module: any) => {
          if (videoPlayer) {
            videoPlayer.play();
            return;
          }
          videoPlayer = module.default(videoContainerElement.querySelector("video"), {
            controls: false,
            controlsBar: false,
            children: ["MediaLoader"],
            autoplay: false,
            preload: "auto",
            muted: false,
            loop: false,
            sources: [
              {
                src: sakura.getThemeConfig("mainScreen", "bgvideo_url", String)?.toString(),
              },
            ],
          });

          videoPlayer.on("loadeddata", () => {
            videoStatusElement.style.bottom = "-100px";
            homeWaveElement.style.bottom = "-100px";
            focusInfoElement.style.top = "-999px";
            videoPlayButtonElement.style.display = "none";
            videoPauseButtonElement.style.display = "block";
            videoPlayer.play();
          });

          videoPlayer.on("play", () => {
            videoStatusElement.style.bottom = "-100px";
            homeWaveElement.style.bottom = "-100px";
            focusInfoElement.style.top = "-999px";
            videoPlayButtonElement.style.display = "none";
            videoPauseButtonElement.style.display = "block";
          });

          videoPlayer.on("pause", () => {
            videoStatusElement.innerHTML = sakura.translate("home.video.statu_pause", "已暂停 ...");
            videoStatusElement.style.bottom = "0";
            homeWaveElement.style.bottom = "0";
            focusInfoElement.style.top = "0";
            videoPlayButtonElement.style.display = "block";
            videoPauseButtonElement.style.display = "none";
          });

          videoPlayer.on("waiting", () => {
            videoStatusElement.innerHTML = sakura.translate("home.video.statu_waiting", "加载中 ...");
            videoStatusElement.style.bottom = "0";
          });

          videoPlayer.on("canplay", () => {
            videoStatusElement.style.bottom = "-100px";
          });

          videoPlayer.on("error", () => {
            videoStatusElement.innerHTML = sakura.translate("home.video.statu_error", "视频播放错误");
            setTimeout(() => {
              focusInfoElement.style.top = "0";
              homeWaveElement.style.bottom = "0";
              videoStatusElement.style.bottom = "-100px";
              videoPlayButtonElement.style.display = "block";
              videoPauseButtonElement.style.display = "none";
              videoPlayer.dispose();
              videoPlayer = undefined;
              videoContainerElement.insertAdjacentElement("afterbegin", document.createElement("video"));
            }, 2000);
          });

          videoPlayer.on("ended", () => {
            focusInfoElement.style.top = "0";
            homeWaveElement.style.bottom = "0";
            videoStatusElement.style.bottom = "-100px";
            videoPlayButtonElement.style.display = "block";
            videoPauseButtonElement.style.display = "none";
            videoPlayer.dispose();
            videoPlayer = undefined;
            videoContainerElement.insertAdjacentElement("afterbegin", document.createElement("video"));
          });
        })
        .catch((error) => {
          console.error(error);
          videoStatusElement.innerHTML = sakura.translate("home.video.statu_error", "视频加载失败");
          videoStatusElement.style.bottom = "0";

          setTimeout(() => {
            videoStatusElement.style.bottom = "-100px";
          }, 2000);
        });
    });

    videoPauseButtonElement?.addEventListener("click", () => {
      if (videoPlayer) {
        videoPlayer.pause();
      }
    });
  }

  /** 使用经 Cloudflare 缓存的 Feed 填充首页精选作品。 */
  @documentFunction()
  public registerPixivWorks() {
    const container = document.querySelector<HTMLElement>("[data-junto-pixiv-home]");
    if (!container || container.dataset.juntoPixivLoaded) return;
    container.dataset.juntoPixivLoaded = "loading";
    const grid = container.querySelector<HTMLElement>("[data-junto-pixiv-home-grid]");
    const status = container.querySelector<HTMLElement>("[data-junto-pixiv-status]");
    loadPixivFeed(container.dataset.juntoPixivFeed || "")
      .then((feed) => {
        if (!grid || !feed.works.length) throw new Error("Pixiv feed is empty");
        grid.replaceChildren(...feed.works.slice(0, 5).map((work, index) => this.buildPixivWork(work, index)));
        if (status) status.hidden = true;
        container.dataset.juntoPixivLoaded = "true";
      })
      .catch((error) => {
        console.warn("Pixiv home works unavailable", error);
        container.dataset.juntoPixivLoaded = "error";
        const fallback = Array.from(document.querySelectorAll<HTMLElement>("[data-junto-halo-home-fallback]"));
        if (fallback.length) {
          container.hidden = true;
          fallback.forEach((element) => (element.hidden = false));
          return;
        }
        if (status) {
          const message = status.querySelector("span");
          if (message) message.textContent = "画面暂时迷失在途中，稍后再来看看。";
          status.classList.add("is-error");
        }
      });
  }

  private buildPixivWork(work: PixivWork, index: number) {
    const link = buildPixivLink(work);
    link.className = "junto-home-work";
    link.title = work.title;
    const visual = document.createElement("div");
    visual.className = "junto-home-work-visual";
    if (work.width && work.height) {
      visual.style.setProperty("--junto-work-ratio", `${work.width} / ${work.height}`);
    }
    visual.append(buildPixivImage(work));
    const caption = document.createElement("span");
    const title = document.createElement("strong");
    title.textContent = work.title;
    const meta = document.createElement("small");
    const pages = work.pageCount && work.pageCount > 1 ? ` × ${work.pageCount}` : "";
    meta.textContent = `${String(index + 1).padStart(2, "0")} / PIXIV${pages}`;
    caption.append(title, meta);
    link.append(visual, caption);
    return link;
  }
}
