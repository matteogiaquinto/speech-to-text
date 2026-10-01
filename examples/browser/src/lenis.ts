import Lenis from "lenis";
import "lenis/dist/lenis.css";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export function initLenis() {
  const lenis = new Lenis();
  let frame = 0;

  const update = (time: number) => {
    frame = 0;
    lenis.raf(time);
    if (lenis.isScrolling === "smooth") {
      frame = requestAnimationFrame(update);
    }
  };

  const wake = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };

  lenis.on("scroll", ScrollTrigger.update);
  lenis.on("virtual-scroll", wake);
}
