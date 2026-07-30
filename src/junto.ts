const $ = <T extends Element = HTMLElement>(selector: string, root: ParentNode = document) =>
  root.querySelector<T>(selector);
const $$ = <T extends Element = HTMLElement>(selector: string, root: ParentNode = document) =>
  Array.from(root.querySelectorAll<T>(selector));

const REDUCE_MOTION = matchMedia("(prefers-reduced-motion: reduce)");

/* Text decode — Latin chars cycle through a katakana/symbol pool while CJK
   glyphs stay put, so mixed titles decode without mojibake. */
const SCRAMBLE_POOL = "アカサタナハマヤラワガザダバパイウエオ0123456789#%&@/×";
const CJK_RE = /[⺀-鿿豈-﫿]/;

const scrambleIn = (element: HTMLElement) => {
  if (REDUCE_MOTION.matches) return;
  const original = element.dataset.juntoScrambleText || element.textContent || "";
  element.dataset.juntoScrambleText = original;
  const chars = Array.from(original);
  if (chars.length < 2) return;
  let frame = 0;
  const total = Math.min(30, 8 + chars.length * 2);
  const tick = () => {
    frame += 1;
    const solved = Math.floor((frame / total) * (chars.length + 4));
    element.textContent = chars
      .map((ch, index) => {
        if (index < solved || /\s/.test(ch) || CJK_RE.test(ch)) return ch;
        return SCRAMBLE_POOL[(Math.random() * SCRAMBLE_POOL.length) | 0];
      })
      .join("");
    if (frame < total && element.isConnected) requestAnimationFrame(tick);
    else element.textContent = original;
  };
  requestAnimationFrame(tick);
};

const setupScramble = () => {
  $$<HTMLElement>("[data-junto-scramble]").forEach((element) => {
    if (element.dataset.juntoScrambled) return;
    element.dataset.juntoScrambled = "true";
    scrambleIn(element);
  });
};

const setupGlobalJunto = () => {
  const body = document.body;
  if (body.dataset.juntoGlobalReady) return;
  body.dataset.juntoGlobalReady = "true";

  let lastScroll = scrollY;
  let velocity = 0;
  let scrollFrame = 0;
  const updateMotion = () => {
    const next = scrollY;
    velocity += (next - lastScroll - velocity) * 0.28;
    lastScroll = next;
    if (next <= 0) velocity = 0;
    const capped = Math.max(-36, Math.min(36, velocity));
    document.documentElement.style.setProperty("--sv", capped.toFixed(2));
    if (!REDUCE_MOTION.matches) body.classList.toggle("junto-tearing", Math.abs(capped) > 26);
    document.documentElement.style.setProperty(
      "--junto-velocity-blur",
      `${Math.min(2.2, Math.abs(capped) * 0.055).toFixed(2)}px`
    );
    document.documentElement.style.setProperty(
      "--junto-ink-scale",
      (1 + Math.min(0.025, Math.abs(capped) * 0.0007)).toFixed(4)
    );
    $(".site-header")?.classList.toggle("is-scrolled", next > 36);
    $$<HTMLElement>("[data-junto-depth]").forEach((element) => {
      const rect = element.getBoundingClientRect();
      const depth = Number.parseFloat(element.dataset.juntoDepth || ".08");
      const offset = (innerHeight / 2 - (rect.top + rect.height / 2)) * depth;
      element.style.transform = `translate3d(0,${offset}px,0)`;
    });
    velocity *= 0.86;
    scrollFrame = 0;
    if (Math.abs(velocity) > 0.15) scrollFrame = requestAnimationFrame(updateMotion);
  };
  window.addEventListener(
    "scroll",
    () => {
      if (!scrollFrame) scrollFrame = requestAnimationFrame(updateMotion);
    },
    { passive: true }
  );
  updateMotion();
  const updateReadingProgress = () => {
    const progress = $("[data-junto-reading-progress]") as HTMLElement | null;
    const max = document.documentElement.scrollHeight - innerHeight;
    const ratio = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
    if (progress) progress.style.width = `${ratio * 100}%`;
    document.documentElement.style.setProperty("--junto-scroll-progress", `${ratio * 100}%`);
    const topPercent = $("[data-junto-top-percent]");
    if (topPercent) topPercent.textContent = `${String(Math.round(ratio * 100)).padStart(2, "0")}%`;
  };
  window.addEventListener("scroll", updateReadingProgress, { passive: true });
  window.addEventListener("resize", updateReadingProgress, { passive: true });
  window.addEventListener("pjax:complete", updateReadingProgress);
  updateReadingProgress();
  window.addEventListener(
    "pointermove",
    (event) => {
      document.documentElement.style.setProperty("--mx", `${event.clientX}px`);
      document.documentElement.style.setProperty("--my", `${event.clientY}px`);
    },
    { passive: true }
  );
  window.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      const searchButton = $(".junto-search-button") as HTMLButtonElement | null;
      if (searchButton) {
        event.preventDefault();
        searchButton.click();
      }
    }
    if (event.key === "Escape") {
      $$(".junto-menu-panel.open,.junto-command-panel.open").forEach((panel) => {
        panel.classList.remove("open");
        panel.setAttribute("aria-hidden", "true");
      });
    }
  });

  const clock = $("[data-junto-clock]");
  if (clock) {
    const formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Singapore",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const updateClock = () => (clock.textContent = formatter.format(new Date()));
    updateClock();
    window.setInterval(updateClock, 1000);
  }

  const playPageWipe = () => {
    const wipe = $(".junto-page-wipe") as HTMLElement | null;
    if (!wipe || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    wipe.classList.remove("is-active");
    void wipe.offsetWidth;
    wipe.classList.add("is-active");
    window.setTimeout(() => wipe.classList.remove("is-active"), 850);
  };
  window.addEventListener("pjax:send", playPageWipe);

  document.addEventListener("click", (event) => {
    if ($("#pjax") || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey)
      return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const link = target.closest<HTMLAnchorElement>("a[href]");
    if (
      !link ||
      link.target ||
      link.hasAttribute("download") ||
      link.origin !== location.origin ||
      link.pathname === location.pathname
    )
      return;
    event.preventDefault();
    playPageWipe();
    window.setTimeout(() => location.assign(link.href), 360);
  });

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const control = target.closest(".junto-top-lever,.junto-top-mobile");
    if (!control) return;
    control.classList.add("is-pulling");
    window.setTimeout(() => control.classList.remove("is-pulling"), 720);
  });

  if (
    body.dataset.juntoIntro === "true" &&
    !matchMedia("(prefers-reduced-motion: reduce)").matches &&
    !sessionStorage.getItem("junto-intro-seen")
  ) {
    sessionStorage.setItem("junto-intro-seen", "1");
    const ransom = (word: string, offset: number) =>
      `<span class="junto-ransom-line">${Array.from(word)
        .map((ch, index) => `<i style="--i:${offset + index}">${ch}</i>`)
        .join("")}</span>`;
    const loader = document.createElement("div");
    loader.className = "junto-loader";
    loader.innerHTML = `<div><div class="junto-loader-copy">${ransom("JUNTO", 0)}${ransom(
      "ARCHIVE",
      5
    )}</div><div class="junto-eyebrow">DEEP BLUE / PERSONAL SIGNAL / HALO</div></div>`;
    body.prepend(loader);
    requestAnimationFrame(() => window.setTimeout(() => loader.classList.add("done"), 1000));
    window.setTimeout(() => loader.remove(), 2200);
  }

  if (body.dataset.juntoCursor === "true" && matchMedia("(pointer:fine)").matches) {
    const ring = document.createElement("div");
    const dot = document.createElement("div");
    ring.className = "junto-cursor";
    dot.className = "junto-cursor-dot";
    body.append(ring, dot);
    let targetX = innerWidth / 2,
      targetY = innerHeight / 2,
      x = targetX,
      y = targetY;
    window.addEventListener(
      "pointermove",
      (event) => {
        targetX = event.clientX;
        targetY = event.clientY;
        dot.style.transform = `translate(${targetX}px,${targetY}px) translate(-50%,-50%)`;
      },
      { passive: true }
    );
    const animate = () => {
      x += (targetX - x) * 0.16;
      y += (targetY - y) * 0.16;
      ring.style.transform = `translate(${x}px,${y}px) translate(-50%,-50%)`;
      requestAnimationFrame(animate);
    };
    animate();
    document.addEventListener("pointermove", (event) => {
      const target = event.target;
      body.classList.toggle(
        "junto-cursor-hot",
        target instanceof Element && Boolean(target.closest("a,button,input,textarea,.junto-art-card"))
      );
    });
  }
};

const setupPanels = () => {
  const bindPanel = (openSelector: string, closeSelector: string, panelSelector: string, focusSelector?: string) => {
    const opener = $(openSelector) as HTMLButtonElement | null;
    const panel = $(panelSelector) as HTMLElement | null;
    if (!opener || !panel || opener.dataset.bound) return;
    opener.dataset.bound = "true";
    const toggle = (open: boolean) => {
      panel.classList.toggle("open", open);
      panel.setAttribute("aria-hidden", String(!open));
      if (open && focusSelector) window.setTimeout(() => $(focusSelector, panel)?.focus(), 60);
    };
    opener.addEventListener("click", () => toggle(true));
    $(closeSelector, panel)?.addEventListener("click", () => toggle(false));
    panel.addEventListener("click", (event) => {
      if ((event.target as Element).closest("a")) toggle(false);
    });
  };
  bindPanel("[data-junto-menu]", "[data-junto-menu-close]", "[data-junto-menu-panel]");
  bindPanel(
    "[data-junto-command-open]",
    "[data-junto-command-close]",
    "[data-junto-command-panel]",
    "[data-junto-command-input]"
  );

  const input = $("[data-junto-command-input]") as HTMLInputElement | null;
  if (input && !input.dataset.bound) {
    input.dataset.bound = "true";
    input.addEventListener("input", () => {
      const query = input.value.trim().toLowerCase();
      $$(".junto-command-item").forEach((item) => {
        (item as HTMLElement).hidden = !((item as HTMLElement).dataset.juntoCommandText || "")
          .toLowerCase()
          .includes(query);
      });
    });
  }
};

const setupCurrentNavigation = () => {
  const currentPath = location.pathname.replace(/\/$/, "") || "/";
  $$(".junto-header .menu-item > a").forEach((link) => {
    const href = (link as HTMLAnchorElement).pathname.replace(/\/$/, "") || "/";
    if (href === currentPath) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
};

const setupReveals = () => {
  const items = $$(
    ".junto-reveal,.junto-section-heading,.junto-taxonomy-card,.junto-friend-card,.junto-art-card,.junto-project-index > a,.junto-home-route-copy,.junto-home-works-head,.junto-home-project-copy,.junto-home-project-list > a,.junto-index-head,.junto-index article"
  ).filter((item) => {
    const element = item as HTMLElement;
    item.classList.add("junto-reveal");
    if (element.dataset.juntoRevealBound) return false;
    element.dataset.juntoRevealBound = "true";
    return !item.classList.contains("in");
  });
  if (!items.length) return;
  const observer = new IntersectionObserver(
    (entries) =>
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("in");
        observer.unobserve(entry.target);
      }),
    { threshold: 0.08 }
  );
  items.forEach((item) => observer.observe(item));
};

const setupMotionInteractions = () => {
  $$<HTMLElement>("[data-junto-magnetic],.junto-search-button,.junto-menu-toggle").forEach((element) => {
    if (element.dataset.juntoMagneticBound) return;
    element.dataset.juntoMagneticBound = "true";
    element.addEventListener("pointermove", (event) => {
      const rect = element.getBoundingClientRect();
      const dx = (event.clientX - rect.left - rect.width / 2) * 0.16;
      const dy = (event.clientY - rect.top - rect.height / 2) * 0.16;
      element.style.transform = `translate(${dx}px,${dy}px)`;
    });
    element.addEventListener("pointerleave", () => (element.style.transform = ""));
  });

  $$<HTMLElement>("[data-junto-drag-board]").forEach((board) => {
    if (board.dataset.juntoDragBound) return;
    const canvas = $("[data-junto-drag-canvas]", board) as HTMLElement | null;
    if (!canvas) return;
    board.dataset.juntoDragBound = "true";
    let x = 0,
      y = 0,
      velocityX = 0,
      velocityY = 0,
      startX = 0,
      startY = 0,
      baseX = 0,
      baseY = 0,
      dragging = false,
      moved = false,
      animation = 0;
    const bounds = () => {
      const boardRect = board.getBoundingClientRect();
      const canvasRect = canvas.getBoundingClientRect();
      return {
        x: Math.max(80, (canvasRect.width - boardRect.width) / 2),
        y: Math.max(60, (canvasRect.height - boardRect.height) / 2),
      };
    };
    const clamp = () => {
      const limit = bounds();
      x = Math.max(-limit.x, Math.min(limit.x, x));
      y = Math.max(-limit.y, Math.min(limit.y, y));
    };
    const paint = () => {
      canvas.style.setProperty("--junto-drag-x", `${x}px`);
      canvas.style.setProperty("--junto-drag-y", `${y}px`);
    };
    const inertia = () => {
      velocityX *= 0.92;
      velocityY *= 0.92;
      x += velocityX;
      y += velocityY;
      clamp();
      paint();
      if (Math.abs(velocityX) + Math.abs(velocityY) > 0.2) animation = requestAnimationFrame(inertia);
    };
    board.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      cancelAnimationFrame(animation);
      dragging = true;
      moved = false;
      startX = event.clientX;
      startY = event.clientY;
      baseX = x;
      baseY = y;
      velocityX = velocityY = 0;
      board.classList.add("dragging");
      board.setPointerCapture(event.pointerId);
    });
    board.addEventListener("pointermove", (event) => {
      if (!dragging) return;
      const nextX = baseX + event.clientX - startX;
      const nextY = baseY + event.clientY - startY;
      velocityX = nextX - x;
      velocityY = nextY - y;
      x = nextX;
      y = nextY;
      moved ||= Math.hypot(event.clientX - startX, event.clientY - startY) > 7;
      clamp();
      paint();
    });
    const end = (event: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      board.classList.remove("dragging");
      if (board.hasPointerCapture(event.pointerId)) board.releasePointerCapture(event.pointerId);
      animation = requestAnimationFrame(inertia);
    };
    board.addEventListener("pointerup", end);
    board.addEventListener("pointercancel", end);
    board.addEventListener(
      "click",
      (event) => {
        if (!moved) return;
        event.preventDefault();
        event.stopPropagation();
        moved = false;
      },
      true
    );
    if (board.dataset.juntoDragWheel !== "false") {
      board.addEventListener(
        "wheel",
        (event) => {
          if (Math.abs(event.deltaX) + Math.abs(event.deltaY) < 2) return;
          event.preventDefault();
          x -= event.deltaX * 0.65;
          y -= event.deltaY * 0.65;
          clamp();
          paint();
        },
        { passive: false }
      );
    }
    const alignCanvas = () => {
      const limit = bounds();
      if (board.dataset.juntoDragAlignX === "start") x = limit.x;
      if (board.dataset.juntoDragAlignY === "start") y = limit.y;
      clamp();
      paint();
    };
    board.addEventListener("junto:drag-align", alignCanvas);
    window.addEventListener(
      "resize",
      () => {
        clamp();
        paint();
      },
      { passive: true }
    );
    paint();
    if (board.dataset.juntoDragAlignX === "start" || board.dataset.juntoDragAlignY === "start") {
      requestAnimationFrame(alignCanvas);
    }
  });
};

const setupProjects = () => {
  const preview = $("[data-junto-project-preview]") as HTMLElement | null;
  if (preview) {
    $$("[data-junto-project]").forEach((row) => {
      if ((row as HTMLElement).dataset.bound) return;
      (row as HTMLElement).dataset.bound = "true";
      const activate = () => {
        const item = row as HTMLElement;
        preview.dataset.visual = item.dataset.visual || "pixel";
        const title = $("[data-junto-project-title]", preview);
        const meta = $("[data-junto-project-meta]", preview);
        if (title) title.textContent = item.dataset.title || "";
        if (meta) meta.textContent = item.dataset.meta || "";
      };
      row.addEventListener("pointerenter", activate);
      row.addEventListener("focus", activate);
    });
  }

  const table = $("[data-junto-repos]") as HTMLElement | null;
  if (!table || table.dataset.loaded) return;
  table.dataset.loaded = "true";
  const username = table.dataset.juntoRepos;
  const status = $("[data-junto-repo-status]");
  fetch(`https://api.github.com/users/${encodeURIComponent(username || "")}/repos?per_page=100&sort=updated`)
    .then((response) => {
      if (!response.ok) throw new Error(String(response.status));
      return response.json();
    })
    .then((repos: Array<Record<string, any>>) => {
      repos
        .filter((repo) => !repo.fork)
        .slice(0, 10)
        .forEach((repo, index) => {
          const link = document.createElement("a");
          link.href = String(repo.html_url);
          link.target = "_blank";
          link.rel = "noreferrer";
          link.className = "junto-repo-row";
          const number = document.createElement("span");
          number.textContent = String(index + 1).padStart(2, "0");
          const name = document.createElement("h3");
          name.textContent = String(repo.name).replaceAll("-", " ");
          const description = document.createElement("p");
          description.textContent = repo.description || "Built in public, refined in motion.";
          const meta = document.createElement("small");
          meta.textContent = `${repo.language || "MIXED"} / ★ ${repo.stargazers_count || 0} / GITHUB ↗`;
          link.append(number, name, description, meta);
          table.append(link);
        });
      if (status) status.textContent = `OPEN SOURCE / ${username}`;
    })
    .catch(() => {
      if (status) status.textContent = "MORE IN THE MAKING.";
    });
};

const initJunto = () => {
  setupGlobalJunto();
  setupPanels();
  setupCurrentNavigation();
  setupReveals();
  setupMotionInteractions();
  setupProjects();
  setupScramble();
};

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initJunto, { once: true });
else initJunto();
window.addEventListener("sakura:refresh", initJunto);
