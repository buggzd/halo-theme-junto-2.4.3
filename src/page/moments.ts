import { documentFunction, sakura } from "../main";
import { HaloApi } from "../utils/haloApi";

export default class Moments {
  /**
   * 注册 moment 列表分页加载事件
   *
   * @description: Register moment list pagination event
   * @param {*}
   * @return {*}
   */
  @documentFunction()
  public registerMomentListPagination() {
    const paginationElement = document.getElementById("moment-list-pagination");
    if (!paginationElement) {
      return;
    }
    const listPaginationLinkElement = paginationElement.querySelector("a");
    if (!listPaginationLinkElement) {
      return;
    }
    listPaginationLinkElement.addEventListener("click", (event) => {
      event.preventDefault();
      const momentContainerElement = document.querySelector(".moments-container .moments-inner");
      if (!momentContainerElement) {
        return;
      }
      const targetElement = event.target as HTMLLinkElement;
      const url = targetElement.href;
      targetElement.classList.add("loading");
      targetElement.textContent = "";
      fetch(url, {
        method: "GET",
      })
        .then((response) => response.text())
        .then((html) => {
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, "text/html");
          const momentNewContainerElement = doc.querySelector(".moments-container .moments-inner") as HTMLElement;
          if (momentNewContainerElement) {
            this.registerMomentItem(momentNewContainerElement);
            const momentListNewElements = momentNewContainerElement.querySelectorAll(".moments-item");
            if (momentListNewElements && momentListNewElements.length > 0) {
              momentListNewElements.forEach((element) => {
                momentContainerElement.appendChild(element);
                // 重新执行 Halo 评论组件初始化
                const commentScriptElement = element.querySelector(
                  ".comment-box .comment script:last-of-type"
                ) as HTMLScriptElement;
                if (commentScriptElement) {
                  const code: string =
                    commentScriptElement.text ||
                    commentScriptElement.textContent ||
                    commentScriptElement.innerHTML ||
                    "";
                  const parent: ParentNode | null = commentScriptElement.parentNode;
                  parent?.removeChild(commentScriptElement);
                  const script: HTMLElementTagNameMap["script"] = document.createElement("script");
                  script.type = "text/javascript";
                  script.appendChild(document.createTextNode(code));
                  parent?.appendChild(script);
                }
              });
            }
          }
          const momentIndexElement = document.querySelector("[data-junto-moment-index]");
          const momentNewIndexElement = doc.querySelector("[data-junto-moment-index]");
          if (momentIndexElement && momentNewIndexElement) {
            Array.from(momentNewIndexElement.children).forEach((element) => momentIndexElement.appendChild(element));
          }
          this.registerMomentBoard();
          const nextPaginationElement = doc.querySelector("#moment-list-pagination a") as HTMLLinkElement;
          if (nextPaginationElement) {
            targetElement.href = nextPaginationElement.href;
          } else {
            paginationElement.innerHTML = "";
          }
        })
        .catch((error) => {
          console.error(error);
        })
        .finally(() => {
          targetElement.classList.remove("loading");
          targetElement.textContent = sakura.translate("page.moments.loadmore", "加载更多...");
          if (sakura.$localize) {
            sakura.$localize(".moments-inner");
          }
        });
    });
  }

  /**
   * 注册 moment 子项功能，需保证每个子项只会执行一次
   *
   * @description: Register moment item function, ensure that each item will only be executed once
   * @param containerElement
   * @return {*}
   * @param {*}
   */
  @documentFunction()
  public registerMomentItem(containerElement?: HTMLElement) {
    const momentContainerElement = containerElement || document.querySelector(".moments-container .moments-inner");
    if (!momentContainerElement) {
      return;
    }
    const momentItemElements = momentContainerElement?.querySelectorAll(".moments-item") as NodeListOf<HTMLElement>;
    if (!momentItemElements || momentItemElements.length <= 0) {
      return;
    }

    momentItemElements.forEach((momentItemElement: HTMLElement) => {
      this.registerMomentItemLike(momentItemElement);
      this.registerMomentItemComment(momentItemElement);
    });
  }

  /** 将动态 Moment 数据排进可拖动的撕纸拼贴墙，并同步筛选与索引编号。 */
  @documentFunction()
  public registerMomentBoard() {
    const canvas = document.querySelector<HTMLElement>("[data-junto-moment-canvas]");
    const list = canvas?.querySelector<HTMLElement>("[data-junto-moment-list]");
    if (!canvas || !list) return;

    const layouts = [
      { x: 90, yOffset: 40, width: 500, height: 350, rotate: -2.4 },
      { x: 670, yOffset: 0, width: 430, height: 310, rotate: 1.8 },
      { x: 1170, yOffset: 70, width: 470, height: 320, rotate: -1.6 },
      { x: 1710, yOffset: 20, width: 490, height: 340, rotate: 2.6 },
      { x: 240, yOffset: 60, width: 580, height: 340, rotate: 1.6 },
      { x: 900, yOffset: 0, width: 350, height: 300, rotate: -2.8 },
      { x: 1330, yOffset: 60, width: 430, height: 310, rotate: 2 },
      { x: 1830, yOffset: 20, width: 390, height: 300, rotate: -1.8 },
      { x: 130, yOffset: 30, width: 560, height: 320, rotate: 2.2 },
      { x: 790, yOffset: 0, width: 340, height: 270, rotate: -1.4 },
      { x: 1210, yOffset: 50, width: 400, height: 280, rotate: 1.5 },
      { x: 1690, yOffset: -10, width: 500, height: 320, rotate: -2.4 },
    ];
    const items = Array.from(list.children).filter((element): element is HTMLElement =>
      element.classList.contains("moments-item")
    );
    const bleed = 220;
    canvas.style.setProperty("--junto-notes-canvas-width", `${2300 + bleed * 2}px`);
    canvas.style.setProperty("--junto-notes-stamp-x", `${2030 + bleed}px`);
    let rowTop = bleed + 80;
    const itemsPerRow = 4;
    const rowCount = Math.ceil(items.length / itemsPerRow);
    for (let row = 0; row < rowCount; row += 1) {
      const rowItems = items.slice(row * itemsPerRow, (row + 1) * itemsPerRow);
      const pattern = row % 3;
      const cycle = Math.floor(row / 3);
      rowItems.forEach((item, column) => {
        const index = row * itemsPerRow + column;
        const layout = layouts[pattern * itemsPerRow + column];
        const direction = cycle % 2 === 0 ? 1 : -1;
        const hasMedia = Boolean(item.querySelector(".moment-medium"));
        const rotation = layout.rotate * direction;
        item.dataset.juntoNoteKind ||= hasMedia ? "MEDIA" : "TEXT";
        item.style.setProperty("--junto-note-x", `${layout.x + bleed + (cycle % 2) * 24}px`);
        item.style.setProperty("--junto-note-y", `${rowTop + layout.yOffset}px`);
        item.style.setProperty("--junto-note-w", `${layout.width}px`);
        item.style.setProperty("--junto-note-h", `${hasMedia ? Math.max(layout.height, 500) : layout.height}px`);
        item.style.setProperty("--junto-note-r", `${rotation}deg`);
        item.style.setProperty("--junto-note-hover-r", `${rotation * 0.12}deg`);
        const number = item.querySelector<HTMLElement>("[data-junto-note-number]");
        if (number) number.textContent = `NOTE / ${String(index + 1).padStart(2, "0")}`;
      });
      const rowHeight = Math.max(
        ...rowItems.map((item, column) => {
          const layout = layouts[pattern * itemsPerRow + column];
          return layout.yOffset + item.offsetHeight;
        })
      );
      rowTop += rowHeight + 130;
    }
    const canvasHeight = Math.max(1420 + bleed * 2, rowTop + bleed);
    canvas.style.setProperty("--junto-notes-canvas-height", `${canvasHeight}px`);
    canvas.style.setProperty("--junto-notes-stamp-y", `${canvasHeight - bleed - 180}px`);

    document.querySelectorAll<HTMLElement>("[data-junto-index-number]").forEach((number, index) => {
      number.textContent = `NT-${String(index + 1).padStart(2, "0")}`;
    });
    this.registerMomentFilter();
    const board = canvas.closest<HTMLElement>("[data-junto-drag-board]");
    if (board && !board.dataset.juntoNotesAligned) {
      board.dataset.juntoNotesAligned = "true";
      requestAnimationFrame(() => board.dispatchEvent(new Event("junto:drag-align")));
    }
  }

  private registerMomentFilter() {
    const filterGroup = document.querySelector<HTMLElement>("[data-junto-moment-filter]");
    if (!filterGroup) return;
    const buttons = Array.from(filterGroup.querySelectorAll<HTMLButtonElement>("[data-junto-moment-filter-value]"));
    const applyFilter = (filter: string) => {
      buttons.forEach((button) => {
        const active = button.dataset.juntoMomentFilterValue === filter;
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", String(active));
      });
      document.querySelectorAll<HTMLElement>("[data-junto-note-kind]").forEach((item) => {
        item.classList.toggle("is-filtered", filter !== "ALL" && item.dataset.juntoNoteKind !== filter);
      });
    };
    if (!filterGroup.dataset.juntoMomentFilterBound) {
      filterGroup.dataset.juntoMomentFilterBound = "true";
      buttons.forEach((button) => {
        button.addEventListener("click", () => applyFilter(button.dataset.juntoMomentFilterValue || "ALL"));
      });
    }
    applyFilter(buttons.find((button) => button.classList.contains("active"))?.dataset.juntoMomentFilterValue || "ALL");
  }

  private registerMomentItemLike(itemElement: HTMLElement) {
    if (itemElement.dataset.juntoLikeBound) return;
    itemElement.dataset.juntoLikeBound = "true";
    const likedIds = JSON.parse(localStorage.getItem("momentlikedIds") || "[]") as string[];
    const likeButtonElement = itemElement.querySelector(".moment-tools .moment-like");
    if (!likeButtonElement) {
      return;
    }
    const momentName = itemElement.getAttribute("data-name") || "";
    if (likedIds && likedIds?.includes(momentName)) {
      likeButtonElement.classList.add("on");
      return;
    }
    likeButtonElement.addEventListener(
      "click",
      () => {
        let upvoteCount = Number(likeButtonElement.getAttribute("data-links") || "0");
        HaloApi.like("moment.halo.run", "moments", momentName).then(() => {
          upvoteCount += 1;
          likedIds.push(momentName);
          likeButtonElement.classList.add("on");
          likeButtonElement.setAttribute("data-links", upvoteCount.toString());
          const likeTitleElement = likeButtonElement.querySelector(".moment-like-text");
          if (likeTitleElement) {
            likeTitleElement.textContent = upvoteCount.toString();
          }
          localStorage.setItem("momentlikedIds", JSON.stringify(likedIds));
        });
      },
      { once: true }
    );
  }

  private registerMomentItemComment(itemElement: HTMLElement) {
    if (itemElement.dataset.juntoCommentBound) return;
    itemElement.dataset.juntoCommentBound = "true";
    const commentButtonElement = itemElement.querySelector(".moment-tools .comment-js");
    if (!commentButtonElement) {
      return;
    }
    commentButtonElement.addEventListener("click", () => {
      const commentBoxElement = itemElement.querySelector(".comment-box");
      commentBoxElement?.classList.toggle("is-show");
    });
  }
}
