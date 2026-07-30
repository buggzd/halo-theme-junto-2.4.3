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
    ".junto-section-heading,.junto-taxonomy-card,.junto-friend-card,.junto-art-card,.junto-project-index > a,.junto-home-route-copy,.junto-home-works-head,.junto-home-project-copy,.junto-home-project-list > a,.junto-index-head,.junto-index article"
  ).filter((item) => !item.classList.contains("junto-reveal"));
  if (!items.length) return;
  const observer = new IntersectionObserver(
    (entries) =>
      entries.forEach((entry) => {
        if (entry.isIntersecting) entry.target.classList.add("in");
      }),
    { threshold: 0.08 }
  );
  items.forEach((item) => {
    item.classList.add("junto-reveal");
    observer.observe(item);
  });
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
    const clamp = () => {
      const boardRect = board.getBoundingClientRect();
      const canvasRect = canvas.getBoundingClientRect();
      const boundX = Math.max(80, (canvasRect.width - boardRect.width) / 2);
      const boundY = Math.max(60, (canvasRect.height - boardRect.height) / 2);
      x = Math.max(-boundX, Math.min(boundX, x));
      y = Math.max(-boundY, Math.min(boundY, y));
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
    paint();
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

/* Julia set hero core. Renders into a low-res offscreen canvas and upscales
   for a painterly read; the c parameter drifts on a slow orbit steered by
   the pointer. Light themes blend by multiply (paper-tone edges vanish),
   dark theme flips the palette and blends by screen. */
const setupFractal = () => {
  const canvas = $("[data-junto-fractal]") as HTMLCanvasElement | null;
  if (!canvas || canvas.dataset.juntoFractalBound) return;
  canvas.dataset.juntoFractalBound = "true";
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const SCALE = 0.24;
  const ITERATIONS = 30;
  const off = document.createElement("canvas");
  const octx = off.getContext("2d");
  if (!octx) return;

  let visible = true;
  let frame = 0;
  let mouseX = 0;
  let mouseY = 0;
  let targetX = 0;
  let targetY = 0;
  let paletteDark = false;
  const palette = new Uint8ClampedArray(256 * 3);

  const buildPalette = (dark: boolean) => {
    paletteDark = dark;
    const stops = dark
      ? [
          [2, 9, 20],
          [10, 49, 95],
          [46, 155, 255],
          [223, 242, 255],
        ]
      : [
          [245, 248, 251],
          [185, 218, 232],
          [23, 99, 154],
          [6, 26, 54],
        ];
    for (let i = 0; i < 256; i++) {
      const t = (i / 255) * (stops.length - 1);
      const stage = Math.min(stops.length - 2, Math.floor(t));
      const f = t - stage;
      for (let ch = 0; ch < 3; ch++) {
        palette[i * 3 + ch] = stops[stage][ch] + (stops[stage + 1][ch] - stops[stage][ch]) * f;
      }
    }
  };

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(rect.width));
    canvas.height = Math.max(1, Math.round(rect.height));
    off.width = Math.max(1, Math.round(rect.width * SCALE));
    off.height = Math.max(1, Math.round(rect.height * SCALE));
  };
  resize();
  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver((entries) => (visible = entries[0]?.isIntersecting ?? true)).observe(canvas);
  window.addEventListener(
    "pointermove",
    (event) => {
      targetX = (event.clientX / innerWidth) * 2 - 1;
      targetY = (event.clientY / innerHeight) * 2 - 1;
    },
    { passive: true }
  );

  const render = (time: number) => {
    const dark = document.body.classList.contains("dark");
    if (dark !== paletteDark) buildPalette(dark);
    const w = off.width;
    const h = off.height;
    const image = octx.createImageData(w, h);
    const data = image.data;
    mouseX += (targetX - mouseX) * 0.04;
    mouseY += (targetY - mouseY) * 0.04;
    const t = time * 0.00006;
    const cx = -0.76 + Math.cos(t * 2.1) * 0.045 + mouseX * 0.055;
    const cy = 0.168 + Math.sin(t * 1.7) * 0.045 + mouseY * 0.055;
    const zoom = 1.55;
    const aspect = w / h;
    let p = 0;
    for (let y = 0; y < h; y++) {
      const zy0 = (y / h - 0.5) * 2 * zoom;
      for (let x = 0; x < w; x++) {
        let zx = (x / w - 0.5) * 2 * zoom * aspect;
        let zy = zy0;
        let n = 0;
        while (n < ITERATIONS && zx * zx + zy * zy < 4) {
          const xt = zx * zx - zy * zy + cx;
          zy = 2 * zx * zy + cy;
          zx = xt;
          n += 1;
        }
        let v = 0;
        if (n < ITERATIONS) {
          const logZn = Math.max(1e-9, Math.log(zx * zx + zy * zy) * 0.5);
          v = Math.max(0, (n + 1 - Math.log2(logZn)) / ITERATIONS);
        }
        const shade = Math.min(255, (v * 255 * 1.6) | 0);
        data[p] = palette[shade * 3];
        data[p + 1] = palette[shade * 3 + 1];
        data[p + 2] = palette[shade * 3 + 2];
        data[p + 3] = 255;
        p += 4;
      }
    }
    octx.putImageData(image, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(off, 0, 0, canvas.width, canvas.height);
  };

  if (REDUCE_MOTION.matches) {
    buildPalette(document.body.classList.contains("dark"));
    render(4200);
    document.body.classList.add("junto-fractal-on");
    return;
  }

  let started = false;
  const step = (time: number) => {
    if (!canvas.isConnected) return;
    if (visible && !document.hidden) {
      frame += 1;
      if (frame % 2 === 0) {
        render(time);
        if (!started) {
          started = true;
          document.body.classList.add("junto-fractal-on");
        }
      }
    }
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
};

const initJunto = () => {
  setupGlobalJunto();
  setupPanels();
  setupCurrentNavigation();
  setupReveals();
  setupMotionInteractions();
  setupProjects();
  setupScramble();
  setupFractal();
};

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initJunto, { once: true });
else initJunto();
window.addEventListener("sakura:refresh", initJunto);
