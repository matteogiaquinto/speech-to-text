import "./docs.css";
import { initLenis } from "./lenis";
import { initSiteReveals } from "./reveal";
import { initSideRays } from "./side-rays";

initLenis();

const menuButton = document.querySelector<HTMLButtonElement>("#menu-button");
const sidebar = document.querySelector<HTMLElement>("#docs-sidebar");
const backdrop = document.querySelector<HTMLElement>("#sidebar-backdrop");
const themeToggle = document.querySelector<HTMLButtonElement>("#theme-toggle");
const navigationLinks = [
  ...document.querySelectorAll<HTMLAnchorElement>(
    '.docs-sidebar a[href^="#"], .page-toc a[href^="#"]',
  ),
];

function setMenu(open: boolean) {
  if (!menuButton || !sidebar || !backdrop) return;
  menuButton.setAttribute("aria-expanded", String(open));
  menuButton.setAttribute(
    "aria-label",
    open ? "Close documentation menu" : "Open documentation menu",
  );
  document.body.toggleAttribute("data-menu-open", open);
}

function setTheme(theme: "dark" | "light") {
  document.documentElement.dataset.theme = theme;
  const light = theme === "light";
  themeToggle?.setAttribute("aria-pressed", String(light));
  themeToggle?.setAttribute(
    "aria-label",
    light ? "Switch to dark mode" : "Switch to light mode",
  );
  themeToggle?.setAttribute(
    "title",
    light ? "Switch to dark mode" : "Switch to light mode",
  );
  try {
    localStorage.setItem("speech-to-text-theme", theme);
  } catch {
    // Theme persistence is an enhancement when storage is unavailable.
  }
}

setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
themeToggle?.addEventListener("click", () => {
  setTheme(
    document.documentElement.dataset.theme === "light" ? "dark" : "light",
  );
});

initSideRays({ spread: 3 });
initSiteReveals();

menuButton?.addEventListener("click", () => {
  setMenu(menuButton.getAttribute("aria-expanded") !== "true");
});

backdrop?.addEventListener("click", () => setMenu(false));

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") setMenu(false);
});

navigationLinks.forEach((link) => {
  link.addEventListener("click", () => setMenu(false));
});

document
  .querySelectorAll<HTMLButtonElement>(".copy-button")
  .forEach((button) => {
    button.addEventListener("click", async () => {
      const templateId = button.dataset.copyTarget;
      const template = templateId
        ? document.querySelector<HTMLTemplateElement>(`#${templateId}`)
        : null;
      const text = button.dataset.copy ?? template?.content.textContent ?? "";

      try {
        await navigator.clipboard.writeText(text.trim());
        button.textContent = "Copied";
        window.setTimeout(() => {
          button.textContent = "Copy";
        }, 1600);
      } catch {
        button.textContent = "Select";
      }
    });
  });

const sectionLinks = new Map<string, HTMLAnchorElement[]>();
navigationLinks.forEach((link) => {
  const id = link.hash.slice(1);
  const links = sectionLinks.get(id) ?? [];
  links.push(link);
  sectionLinks.set(id, links);
});

const sections = [...document.querySelectorAll<HTMLElement>(".doc-section")];
const observer = new IntersectionObserver(
  (entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
    if (!visible) return;

    navigationLinks.forEach((link) => link.classList.remove("active"));
    sectionLinks
      .get(visible.target.id)
      ?.forEach((link) => link.classList.add("active"));
  },
  { rootMargin: "-18% 0px -68%", threshold: 0 },
);

sections.forEach((section) => observer.observe(section));
