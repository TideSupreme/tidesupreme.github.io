/* TideSupreme — interactions */
(() => {
  "use strict";

  const y = document.getElementById("year");
  if (y) y.textContent = new Date().getFullYear();

  /* ---- theme toggle (persisted) ---- */
  const root = document.documentElement;
  const btn = document.getElementById("theme");
  const saved = localStorage.getItem("tide-theme");
  if (saved === "dark") root.setAttribute("data-theme", "dark");
  if (btn) {
    btn.addEventListener("click", () => {
      const dark = root.getAttribute("data-theme") === "dark";
      if (dark) { root.removeAttribute("data-theme"); localStorage.setItem("tide-theme", "light"); }
      else { root.setAttribute("data-theme", "dark"); localStorage.setItem("tide-theme", "dark"); }
    });
  }

  /* ---- click a teammate to see the full photo ---- */
  const lb = document.getElementById("lightbox");
  const lbImg = document.getElementById("lightbox-img");
  const lbCap = document.getElementById("lightbox-cap");
  const openLB = (src, name) => {
    lbImg.src = src; lbImg.alt = name; lbCap.textContent = name;
    lb.classList.add("is-open"); lb.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  };
  const closeLB = () => {
    lb.classList.remove("is-open"); lb.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  };
  if (lb) {
    document.querySelectorAll(".people--team .person").forEach((card) => {
      const av = card.querySelector(".avatar--photo");
      if (!av) return;
      card.addEventListener("click", () => {
        const m = (av.style.backgroundImage || "").match(/url\(["']?(.*?)["']?\)/);
        if (!m) return;
        const name = (card.querySelector(".person__name") || {}).textContent || "";
        openLB(m[1], name);
      });
    });
    document.querySelectorAll(".walker").forEach((w) => {
      w.addEventListener("click", () => {
        const inner = w.querySelector(".walker__inner");
        const m = ((inner && inner.style.backgroundImage) || "").match(/url\(["']?(.*?)["']?\)/);
        if (!m) return;
        openLB(m[1], w.dataset.name || "");
      });
    });
    lb.addEventListener("click", (e) => {
      if (e.target === lb || e.target.classList.contains("lightbox__close")) closeLB();
    });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeLB(); });
  }

  /* ---- scroll reveal ---- */
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const els = document.querySelectorAll(".section, .stats");
  els.forEach((el) => el.classList.add("reveal"));
  if ("IntersectionObserver" in window && !reduce) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("is-visible"); io.unobserve(e.target); } });
    }, { threshold: 0.08 });
    els.forEach((el) => io.observe(el));
  } else {
    els.forEach((el) => el.classList.add("is-visible"));
  }
})();
