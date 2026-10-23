"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Progressive enhancement: content is visible without JavaScript or observers.
// Play once on entry, never tie rendering or stock/payment actions to animation.
export function StorefrontMotion() {
  const pathname = usePathname();
  useEffect(() => {
    if (
      !("IntersectionObserver" in window) ||
      typeof window.matchMedia !== "function"
    )
      return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const seen = new WeakSet<Element>();
    let intersection: IntersectionObserver | undefined;
    let mutations: MutationObserver | undefined;
    const main = document.getElementById("main");
    function stop() {
      intersection?.disconnect();
      mutations?.disconnect();
      document
        .querySelectorAll(".motion-enter")
        .forEach((el) => el.classList.remove("motion-enter"));
    }
    function observe(el: Element) {
      if (seen.has(el) || !el.matches("[data-motion]")) return;
      seen.add(el);
      // Already visible during hydration stays still: no flash or disappearing
      // text. Subsequent offscreen content gets its one entry animation.
      const bounds = el.getBoundingClientRect();
      if (bounds.top < window.innerHeight && bounds.bottom > 0) return;
      intersection?.observe(el);
    }
    function start() {
      stop();
      if (preference.matches) return;
      intersection = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            intersection?.unobserve(entry.target);
            if (
              entry.target.isConnected &&
              !preference.matches &&
              !entry.target.contains(document.activeElement)
            )
              entry.target.classList.add("motion-enter");
          }
        },
        { threshold: 0.08, rootMargin: "0px 0px -16px 0px" },
      );
      document.querySelectorAll("[data-motion]").forEach(observe);
      // Query/filter navigation may replace cards without changing pathname.
      mutations = new MutationObserver((records) => {
        for (const record of records)
          for (const node of record.addedNodes) {
            if (!(node instanceof Element)) continue;
            observe(node);
            node.querySelectorAll("[data-motion]").forEach(observe);
          }
      });
      if (main) mutations.observe(main, { childList: true, subtree: true });
    }
    function finish(event: AnimationEvent) {
      if (
        event.animationName === "benny-reveal" &&
        event.target instanceof Element
      )
        event.target.classList.remove("motion-enter");
    }
    function focus(event: FocusEvent) {
      if (event.target instanceof Element)
        event.target.closest(".motion-enter")?.classList.remove("motion-enter");
    }
    preference.addEventListener("change", start);
    document.addEventListener("animationend", finish);
    document.addEventListener("focusin", focus);
    start();
    return () => {
      stop();
      preference.removeEventListener("change", start);
      document.removeEventListener("animationend", finish);
      document.removeEventListener("focusin", focus);
    };
  }, [pathname]);
  return null;
}
