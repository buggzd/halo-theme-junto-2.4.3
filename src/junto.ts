const $ = <T extends Element = HTMLElement>(selector: string, root: ParentNode = document) =>
  root.querySelector<T>(selector);
const $$ = <T extends Element = HTMLElement>(selector: string, root: ParentNode = document) =>
  Array.from(root.querySelectorAll<T>(selector));

const setupGlobalJunto = () => {
  const body = document.body;
  if (body.dataset.juntoGlobalReady) return;
  body.dataset.juntoGlobalReady = "true";

  const updateHeader = () => $(".site-header")?.classList.toggle("is-scrolled", window.scrollY > 24);
  updateHeader();
  window.addEventListener("scroll", updateHeader, { passive: true });
  const updateReadingProgress = () => {
    const progress = $("[data-junto-reading-progress]") as HTMLElement | null;
    if (!progress) return;
    const max = document.documentElement.scrollHeight - innerHeight;
    progress.style.width = `${max > 0 ? (scrollY / max) * 100 : 0}%`;
  };
  window.addEventListener("scroll", updateReadingProgress, { passive: true });
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
    if (event.key === "Escape" && document.body.classList.contains("junto-menu-open")) {
      document.body.classList.remove("junto-menu-open");
      const menuButton = $("[data-junto-menu]");
      if (menuButton) menuButton.textContent = "INDEX +";
    }
  });

  if (
    body.dataset.juntoIntro === "true" &&
    !matchMedia("(prefers-reduced-motion: reduce)").matches &&
    !sessionStorage.getItem("junto-intro-seen")
  ) {
    sessionStorage.setItem("junto-intro-seen", "1");
    const loader = document.createElement("div");
    loader.className = "junto-loader";
    loader.innerHTML =
      '<div><div class="junto-loader-copy"><span>JUNTO</span><span>ARCHIVE</span></div><div class="junto-eyebrow">DEEP BLUE / PERSONAL SIGNAL / HALO</div></div>';
    body.prepend(loader);
    requestAnimationFrame(() => window.setTimeout(() => loader.classList.add("done"), 350));
    window.setTimeout(() => loader.remove(), 1700);
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
    document.addEventListener("pointerover", (event) => {
      const target = event.target as Element;
      body.classList.toggle("junto-cursor-hot", Boolean(target.closest("a,button,input,textarea,.junto-art-card")));
    });
  }
};

const setupMenu = () => {
  const button = $("[data-junto-menu]") as HTMLButtonElement | null;
  const navbar = $(".junto-header .navbar") as HTMLElement | null;
  if (!button || button.dataset.bound) return;
  button.dataset.bound = "true";
  button.addEventListener("click", () => {
    const open = document.body.classList.toggle("junto-menu-open");
    button.textContent = open ? "CLOSE ×" : "INDEX +";
    navbar?.setAttribute("aria-hidden", String(!open));
  });
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
    ".junto-section-heading,.junto-taxonomy-card,.junto-friend-card,.junto-art-card,.junto-project-index > a"
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
          description.textContent = repo.description || "Open-source experiment from the Junto archive.";
          const meta = document.createElement("small");
          meta.textContent = `${repo.language || "MIXED"} / ★ ${repo.stargazers_count || 0} / GITHUB ↗`;
          link.append(number, name, description, meta);
          table.append(link);
        });
      if (status) status.textContent = `LIVE DATA / github.com/${username}`;
    })
    .catch(() => {
      if (status) status.textContent = "GITHUB SIGNAL UNAVAILABLE / TRY AGAIN LATER";
    });
};

const initJunto = () => {
  setupGlobalJunto();
  setupMenu();
  setupCurrentNavigation();
  setupReveals();
  setupProjects();
};

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initJunto, { once: true });
else initJunto();
window.addEventListener("sakura:refresh", initJunto);
