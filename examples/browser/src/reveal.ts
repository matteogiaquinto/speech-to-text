import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

function revealHeader() {
  document
    .querySelectorAll<HTMLElement>("[data-header-reveal]")
    .forEach((header) => {
      const items = [...header.children] as HTMLElement[];
      if (!items.length || reducedMotion.matches) return;

      gsap.fromTo(
        items,
        { autoAlpha: 0, x: -12, y: -22 },
        {
          autoAlpha: 1,
          x: 0,
          y: 0,
          duration: 0.54,
          ease: "power3.out",
          stagger: 0.075,
          clearProps: "transform,opacity,visibility",
        },
      );
    });
}

function revealGroups() {
  document
    .querySelectorAll<HTMLElement>("[data-reveal-group]")
    .forEach((group) => {
      const items = [...group.children].filter(
        (child): child is HTMLElement =>
          child instanceof HTMLElement && child.dataset.ignore !== "true",
      );
      if (!items.length || reducedMotion.matches) return;

      const animation = gsap.fromTo(
        items,
        { autoAlpha: 0, y: group.dataset.distance ?? "1.25em" },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.62,
          ease: "power3.out",
          stagger: Number(group.dataset.stagger ?? 85) / 1000,
          paused: true,
          clearProps: "transform,opacity,visibility",
        },
      );

      ScrollTrigger.create({
        trigger: group,
        start: group.dataset.start ?? "top 84%",
        once: true,
        onEnter: () => animation.play(),
      });
    });
}

function initFooterParallax() {
  document
    .querySelectorAll<HTMLElement>("[data-footer-parallax]")
    .forEach((section) => {
      const inner = section.querySelector<HTMLElement>(
        "[data-footer-parallax-inner]",
      );
      const shade = section.querySelector<HTMLElement>(
        "[data-footer-parallax-dark]",
      );
      if (!inner || !shade || reducedMotion.matches) return;

      const timeline = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: "clamp(top bottom)",
          end: "clamp(top top)",
          scrub: true,
        },
      });

      timeline.from(inner, { yPercent: -18, ease: "none" });
      timeline.from(shade, { autoAlpha: 0.46, ease: "none" }, "<");
    });
}

export function initSiteReveals() {
  if (reducedMotion.matches) return;
  const context = gsap.context(() => {
    revealHeader();
    revealGroups();
    initFooterParallax();
  });

  reducedMotion.addEventListener("change", () => context.revert(), {
    once: true,
  });
}
