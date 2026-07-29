const initJunto = () => {
  const body = document.body;
  const header = document.querySelector<HTMLElement>(".site-header");
  const menuButton = document.querySelector<HTMLButtonElement>("[data-junto-menu]");
  const navbar = document.querySelector<HTMLElement>(".junto-header .navbar");

  const updateHeader = () => header?.classList.toggle("is-scrolled", window.scrollY > 24);
  updateHeader();
  window.addEventListener("scroll", updateHeader, { passive: true });

  menuButton?.addEventListener("click", () => {
    const open = body.classList.toggle("junto-menu-open");
    if (navbar) {
      navbar.style.display = open ? "block" : "";
      navbar.style.position = open ? "fixed" : "";
      navbar.style.inset = open ? "58px 0 auto" : "";
      navbar.style.padding = open ? "22px 15px" : "";
      navbar.style.background = open ? "#f5f8fb" : "";
      navbar.style.borderBottom = open ? "1px solid rgba(6,26,54,.22)" : "";
    }
    menuButton.textContent = open ? "CLOSE ×" : "INDEX +";
  });
};

document.addEventListener("DOMContentLoaded", initJunto, { once: true });
window.addEventListener("sakura:refresh", initJunto);
