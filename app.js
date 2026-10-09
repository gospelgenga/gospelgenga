// gospelgenga.com: the hero reel, live chapter tracker, chapter dropdowns and video lists, filled from data/*.json
// (refreshed by build_site.py).
(function () {
  "use strict";

  // Links that wait on an account or inbox. Empty = shown as "coming soon" and not clickable.
  const LINKS = {
    kofi: "",   // the Ko-fi page, e.g. https://ko-fi.com/<name>
    email: "gospelgenga@gmail.com",  // Contact buttons (mailto)
  };

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = n => Number(n || 0).toLocaleString("en-US");
  const compact = n => n >= 1e6 ? `${(n / 1e6).toFixed(2).replace(/0$/, "")}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : num(n);
  const clean = t => String(t || "").replace(/\s*\(Bible Anime\)\s*$/i, "").replace(/\s*\|\s*Bible Anime Movie\s*$/i, "");
  const dur = s => { s = Math.round(s || 0); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return h ? `${h}:${String(m).padStart(2, "0")}:${String(x).padStart(2, "0")}` : `${m}:${String(x).padStart(2, "0")}`; };
  const fresh = p => fetch(`${p}?t=${Date.now()}`, { cache: "no-store" }).then(r => { if (!r.ok) throw new Error(p); return r.json(); });
  const chapterList = s => String(s || "").split(",").flatMap(part => {
    const [a, b] = part.split(/[-–]/).map(Number);
    if (!a) return [];
    return Array.from({ length: (b || a) - a + 1 }, (_, i) => a + i);
  });
  const range = s => String(s || "").replace("-", "–");
  const saveData = !!(navigator.connection && navigator.connection.saveData);
  const quietMotion = matchMedia("(prefers-reduced-motion: reduce)").matches || saveData;

  // solid nav once the hero scrolls away
  const nav = $(".nav");
  const onScroll = () => nav.classList.toggle("solid", window.scrollY > window.innerHeight * 0.7);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  $$("[data-year]").forEach(el => { el.textContent = new Date().getFullYear(); });

  // pending links
  $$("[data-link]").forEach(a => {
    const v = LINKS[a.dataset.link];
    if (v) {
      a.href = a.dataset.link === "email" ? `mailto:${v}?subject=${encodeURIComponent(a.dataset.subject || "")}` : v;
      return;
    }
    if (a.closest(".foot")) { a.hidden = true; return; }
    a.classList.add("pending");
    a.removeAttribute("href");
    a.setAttribute("aria-disabled", "true");
    a.title = "Coming soon";
    a.textContent = a.dataset.link === "kofi" ? "Ko-fi link coming soon" : "Contact details coming soon";
  });

  // ---- video index: book -> chapter -> videos ----
  const index = {};
  const lookup = (book, chapters) => {
    const first = chapterList(chapters)[0];
    const list = (index[book] && index[book][first]) || [];
    return list.find(v => v.lane !== "movie") || list[0];
  };

  // ---- hero reel ----
  // Plays muted on loop for everyone (owner's choice, 2026-10-09). Only with data saver on does it wait for Play.
  function reel() {
    const video = $(".hero-video"), ui = $("[data-reel-ui]"), btn = $("[data-reel-toggle]");
    if (!video) return;
    let marks = [];
    fresh("assets/hero-reel.json").then(j => { marks = j.clips || []; }).catch(() => {});
    const now = $("[data-now]"), text = $("[data-now-text]");
    const start = () => { if (!video.getAttribute("src")) video.src = video.dataset.reel; video.play().catch(() => {}); };
    const icon = playing => {
      btn.innerHTML = playing ? '<i class="ic-pause"></i>' : `<i class="ic-play"></i>${video.classList.contains("on") ? "" : "<span>Play highlights</span>"}`;
      btn.classList.toggle("labelled", !playing && !video.classList.contains("on"));
      btn.setAttribute("aria-label", playing ? "Pause the background video" : "Play the background video");
    };
    video.addEventListener("playing", () => { video.classList.add("on"); now.hidden = false; icon(true); });
    video.addEventListener("pause", () => icon(false));
    let userPaused = saveData;
    btn.addEventListener("click", () => { userPaused = !video.paused; if (video.paused) start(); else video.pause(); });
    ui.hidden = false;
    if (saveData) { now.hidden = true; icon(false); } else start();
    // a page opened in a background tab may not start playing; start it when the tab comes forward
    document.addEventListener("visibilitychange", () => { if (!document.hidden && video.paused && !userPaused) start(); });

    let shown = -1;
    video.addEventListener("timeupdate", () => {
      if (!marks.length) return;
      const t = video.currentTime;
      let i = 0;
      while (i + 1 < marks.length && marks[i + 1].t + 0.2 <= t) i++;
      if (i === shown) return;
      shown = i;
      const m = marks[i], v = lookup(m.book, m.chapters);
      now.classList.add("swap");
      setTimeout(() => {
        text.textContent = m.caption;
        if (v) { now.href = v.url; now.title = `Watch ${clean(v.title)}`; now.classList.remove("nolink"); }
        else { now.removeAttribute("href"); now.removeAttribute("title"); now.classList.add("nolink"); }
        now.classList.remove("swap");
      }, 180);
    });
  }

  function card(v) {
    const id = encodeURIComponent(v.youtube_id);
    const when = String(v.published_sgt || "").slice(0, 10);
    const date = when ? new Date(when + "T00:00:00Z").toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" }) : "";
    return `<a class="card" href="${esc(v.url)}" target="_blank" rel="noopener">
      <div class="thumb"><img src="https://i.ytimg.com/vi/${id}/maxresdefault.jpg" alt="" loading="lazy" data-yt="${id}">${v.duration_s ? `<span class="dur">${dur(v.duration_s)}</span>` : ""}</div>
      <h4>${esc(clean(v.title))}</h4>
      <span class="meta">${esc(v.book)} ${esc(range(v.chapters))}${date ? ` · ${esc(date)}` : ""}</span></a>`;
  }

  // YouTube answers a missing HD thumbnail with a tiny grey stand-in (not always an error), so check the size.
  function fixThumbs(root) {
    $$("img[data-yt]", root).forEach(img => {
      const fallback = () => { if (!img.dataset.fb) { img.dataset.fb = "1"; img.src = `https://i.ytimg.com/vi/${img.dataset.yt}/hqdefault.jpg`; } };
      const check = () => { if (img.naturalWidth && img.naturalWidth < 200) fallback(); };
      img.addEventListener("load", check);
      img.addEventListener("error", fallback);
      if (img.complete) check();
    });
  }

  // ---- book grid with chapter dropdowns ----
  let openBook = null;

  function panelHtml(b) {
    const chapters = index[b.book] || {};
    const done = new Set(b.animated);
    const chips = Array.from({ length: b.chapters }, (_, i) => {
      const c = i + 1, v = done.has(c) && lookup(b.book, String(c));
      return v
        ? `<a class="ch done" href="${esc(v.url)}" target="_blank" rel="noopener" title="${esc(`${b.book} ${c}: ${clean(v.title)}`)}">${c}</a>`
        : `<span class="ch" title="${esc(`${b.book} ${c}: still to come`)}">${c}</span>`;
    }).join("");
    const seen = new Set(), eps = [], movies = [];
    Object.values(chapters).flat().forEach(v => {
      if (seen.has(v.youtube_id)) return;
      seen.add(v.youtube_id);
      (v.lane === "movie" ? movies : eps).push(v);
    });
    const first = v => chapterList(v.chapters)[0] || 0;
    const row = v => `<a class="bp-row" href="${esc(v.url)}" target="_blank" rel="noopener">
        <img src="https://i.ytimg.com/vi/${encodeURIComponent(v.youtube_id)}/mqdefault.jpg" alt="" loading="lazy">
        <span><span class="bp-ch">${chapterList(v.chapters).length > 1 ? "Chapters" : "Chapter"} ${esc(range(v.chapters))}${v.duration_s ? ` · ${dur(v.duration_s)}` : ""}</span>
        <span class="bp-t">${esc(clean(v.title))}</span></span></a>`;
    const n = b.animated.length;
    return `<div class="bp-head">
        <div><h4>${esc(b.book)}</h4><span class="small muted">${n} of ${b.chapters} chapters animated</span></div>
        <button class="bp-close" type="button" aria-label="Close ${esc(b.book)}">×</button></div>
      <div class="bp-chapters" aria-label="${esc(b.book)} chapters">${chips}</div>
      ${eps.length ? `<p class="bp-sub">Episodes</p><div class="bp-list">${eps.sort((x, y) => first(x) - first(y)).map(row).join("")}</div>` : ""}
      ${movies.length ? `<p class="bp-sub">Full movies</p><div class="bp-list">${movies.sort((x, y) => first(x) - first(y)).map(row).join("")}</div>` : ""}`;
  }

  function closePanel() {
    $$(".book-panel").forEach(p => p.remove());
    $$(".book.open").forEach(t => { t.classList.remove("open"); t.setAttribute("aria-expanded", "false"); });
  }

  function showPanel(tile, b, focus) {
    closePanel();
    const row = [...tile.parentElement.children].filter(t => t.classList.contains("book") && t.offsetTop === tile.offsetTop);
    const panel = document.createElement("div");
    panel.className = "book-panel";
    panel.id = "book-panel";
    panel.setAttribute("role", "region");
    panel.setAttribute("aria-label", `${b.book} chapters`);
    panel.innerHTML = panelHtml(b);
    row[row.length - 1].after(panel);
    tile.classList.add("open");
    tile.setAttribute("aria-expanded", "true");
    $(".bp-close", panel).addEventListener("click", () => { openBook = null; closePanel(); tile.focus(); });
    openBook = { tile, b };
    if (focus) {
      const r = panel.getBoundingClientRect();
      if (r.bottom > innerHeight) window.scrollBy({ top: Math.min(r.bottom - innerHeight + 24, r.top - 90), behavior: quietMotion ? "auto" : "smooth" });
    }
  }

  function books(prog) {
    const tile = b => {
      const n = b.animated.length, pct = (100 * n / b.chapters).toFixed(1), cls = n >= b.chapters ? "done" : n ? "some" : "none";
      const bar = n && n < b.chapters ? `<i style="width:${pct}%"></i>` : cls === "done" ? `<i style="width:100%"></i>` : "";
      const inner = `<b>${esc(b.book)}</b><span>${n} / ${b.chapters}</span>${bar}`;
      return n
        ? `<button class="book ${cls}" type="button" data-book="${esc(b.book)}" aria-expanded="false" aria-controls="book-panel">${inner}</button>`
        : `<div class="book ${cls}" title="${esc(`${b.book}: still to come`)}">${inner}</div>`;
    };
    const ot = prog.books.slice(0, 39), nt = prog.books.slice(39);
    const sum = list => list.reduce((a, b) => a + b.animated.length, 0);
    const all = list => list.reduce((a, b) => a + b.chapters, 0);
    $("[data-books=ot]").innerHTML = ot.map(tile).join("");
    $("[data-books=nt]").innerHTML = nt.map(tile).join("");
    $("[data-ot]").textContent = `${num(sum(ot))} of ${num(all(ot))} chapters`;
    $("[data-nt]").textContent = `${num(sum(nt))} of ${num(all(nt))} chapters`;
    const byName = Object.fromEntries(prog.books.map(b => [b.book, b]));
    $$("button.book").forEach(t => t.addEventListener("click", () => {
      if (openBook && openBook.tile === t) { openBook = null; closePanel(); return; }
      showPanel(t, byName[t.dataset.book], true);
    }));
    let w = innerWidth;
    window.addEventListener("resize", () => {
      if (innerWidth === w) return;
      w = innerWidth;
      if (openBook) showPanel(openBook.tile, openBook.b, false);
    });
    document.addEventListener("keydown", e => { if (e.key === "Escape" && openBook) { const t = openBook.tile; openBook = null; closePanel(); t.focus(); } });

    // gospelgenga.com/?book=Daniel opens that book's chapters (handy for video descriptions)
    const want = new URLSearchParams(location.search).get("book");
    const t = want && $$("button.book").find(el => el.dataset.book.toLowerCase() === want.toLowerCase());
    if (t) {
      showPanel(t, byName[t.dataset.book], false);
      const go = () => t.scrollIntoView({ block: "start" });
      go();
      document.fonts.ready.then(() => requestAnimationFrame(go)); // fonts change the height above it
      if (document.readyState !== "complete") window.addEventListener("load", go, { once: true });
    }
  }

  // ---- numbers count up from zero when they come into view ----
  const fmt = {
    videos: num, chapters: num, movies: num, views: compact, top: compact,
    subs: n => n >= 1e6 ? `${(n / 1e6).toFixed(2).replace(/0$/, "")}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : num(n),
  };
  const parseShort = s => {
    const m = String(s).replace(/,/g, "").match(/([\d.]+)\s*([KM]?)/i);
    return m ? parseFloat(m[1]) * ({ k: 1e3, m: 1e6 }[m[2].toLowerCase()] || 1) : 0;
  };
  const ease = t => 1 - Math.pow(1 - t, 4);
  const counters = new Map();
  const runCounter = el => {
    const c = counters.get(el);
    if (!c || c.started) return;
    c.started = true;
    const t0 = performance.now(), D = 2600;
    const step = now => {
      const k = Math.min(1, (now - t0) / D), v = c.target * ease(k);
      el.textContent = k < 1 ? c.fmt(Math.floor(v)) : c.final;
      if (c.onStep) c.onStep(k < 1 ? v / (c.target || 1) : 1);
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  const io = "IntersectionObserver" in window
    ? new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { io.unobserve(e.target); runCounter(e.target); } }), { threshold: 0.5 })
    : null;
  const countTo = (el, target, final, onStep) => {
    const f = fmt[el.dataset.stat] || num;
    counters.set(el, { target, final, fmt: f, onStep, started: false });
    el.textContent = f(0);
    if (io) io.observe(el); else runCounter(el);
  };
  // until the data arrives, the counters wait at zero (the HTML keeps real fallbacks for no-JS visitors)
  const fallback = new Map($$("[data-stat]").filter(el => el.dataset.stat !== "total").map(el => [el, el.textContent]));
  fallback.forEach((_, el) => { el.textContent = "0"; });
  const fillBar = pct => share => { $("[data-bar]").style.width = `${share * Math.max(pct, 0.8)}%`; };

  // ---- genga panel: each scene as a pencil key drawing, then coloured in, then the next cut ----
  function genga() {
    const fig = $("[data-genga]");
    if (!fig || fig.dataset.on) return;
    fig.dataset.on = "1";
    const frame = $(".frame", fig), color = $(".g-color", fig), sketch = $(".g-sketch", fig);
    const cut = $("[data-genga-cut]", fig), book = $("[data-genga-book]", fig), cap = $("[data-genga-cap]", fig);
    const step = $("[data-genga-step]", fig), link = $("[data-genga-link]", fig), keys = $$(".timing span", fig);
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const loaded = src => new Promise(r => { const im = new Image(); im.onload = im.onerror = () => r(); im.src = src; });
    let scenes = [], i = 0, started = false;
    const label = sc => {
      cut.textContent = `CUT ${String(sc.n).padStart(2, "0")}`;
      book.textContent = sc.cut;
      cap.textContent = sc.caption;
      const v = lookup(sc.book, sc.chapters);
      if (v) link.href = v.url; else link.removeAttribute("href");
    };
    const mark = (k, text) => { step.textContent = text; keys.forEach((el, n) => el.classList.toggle("on", n === k)); };
    async function run() {
      for (;;) {
        mark(0, "key drawing");
        await wait(2200);
        frame.classList.add("colored");
        mark(2, "in colour");
        await wait(1900);
        frame.classList.add("final");
        mark(5, "finished frame");
        await wait(2800);
        i = (i + 1) % scenes.length;
        const next = scenes[i];
        const src = n => [`assets/genga/${n}-color.jpg`, `assets/genga/${n}-sketch.png`];
        await Promise.all(src(next.n).map(loaded));
        frame.classList.add("out");
        await wait(480);
        frame.classList.add("reset");
        frame.classList.remove("colored", "final");
        [color.src, sketch.src] = src(next.n);
        label(next);
        void frame.offsetWidth; // apply the reset before transitions come back
        frame.classList.remove("reset", "out");
        await wait(500);
      }
    }
    fresh("assets/genga/genga.json").then(j => {
      scenes = j.scenes || [];
      if (scenes.length < 2) return;
      label(scenes[0]);
      const go = () => { if (!started) { started = true; run(); } };
      if ("IntersectionObserver" in window) {
        const io2 = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io2.disconnect(); go(); } }, { threshold: 0.3 });
        io2.observe(fig);
      } else go();
    }).catch(() => {});
  }

  reel();

  Promise.all([fresh("data/progress.json"), fresh("data/published.json")]).then(([prog, pub]) => {
    const vids = pub.videos || [];
    vids.forEach(v => chapterList(v.chapters).forEach(c => (((index[v.book] ||= {})[c] ||= []).push(v))));

    const views = vids.reduce((a, v) => a + (Number(v.views_at_snapshot) || 0), 0);
    const top = Math.max(0, ...vids.map(v => Number(v.views_at_snapshot) || 0));
    const subs = (pub.channel && pub.channel.subscribers_display) || "";
    const set = (k, target, final) => $$(`[data-stat=${k}]`).forEach(el =>
      countTo(el, target, final, k === "chapters" && el.closest(".tracker") ? fillBar(Number(prog.percent) || 0) : null));
    set("videos", vids.length, num(vids.length));
    set("views", views, compact(views));
    set("top", top, compact(top));
    const nMovies = new Set(vids.filter(v => v.lane === "movie").map(v => v.book)).size; // Revelation's parts count as one movie
    set("movies", nMovies, num(nMovies));
    set("subs", parseShort(subs), subs);
    set("chapters", prog.animated_chapters, num(prog.animated_chapters));
    $$("[data-stat=total]").forEach(el => { el.textContent = num(prog.total_chapters); });
    if (prog.generated) {
      const d = new Date(prog.generated);
      if (!isNaN(d)) {
        const day = d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
        $("[data-updated]").textContent = `${prog.percent}% of the Bible · updated ${day}`;
        const asOf = pub.stats_fetched_at ? new Date(pub.stats_fetched_at) : d;
        $("[data-kit-note]").textContent = `Public YouTube figures as of ${asOf.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.`;
      }
    }
    books(prog);
    genga(); // after the video index exists, so its captions can link to the episodes

    $$("[data-path]").forEach(a => {
      const [book, ch] = a.dataset.path.split("|"), v = lookup(book, ch);
      if (v) a.href = v.url; else a.removeAttribute("target");
    });

    const byDate = (a, b) => String(b.published_sgt).localeCompare(String(a.published_sgt));
    const movies = vids.filter(v => v.lane === "movie").sort((a, b) => String(a.published_sgt).localeCompare(String(b.published_sgt)));
    $("[data-movies]").innerHTML = movies.map(card).join("");
    fixThumbs($("[data-movies]"));
    const eps = vids.filter(v => v.lane !== "movie").sort(byDate);
    const paint = f => {
      const list = f === "all" ? eps.slice(0, 9) : f === "standalone" ? eps.filter(v => v.lane === "standalone") : eps.filter(v => v.book === f);
      $("[data-episodes]").innerHTML = list.map(card).join("");
      fixThumbs($("[data-episodes]"));
      $$("[data-filter]").forEach(b => { b.classList.toggle("on", b.dataset.filter === f); b.setAttribute("aria-pressed", String(b.dataset.filter === f)); });
    };
    $$("[data-filter]").forEach(b => b.addEventListener("click", () => paint(b.dataset.filter)));
    paint("all");
  }).catch(() => {
    // data didn't load: count up to the numbers written into the HTML instead
    fallback.forEach((text, el) => { if (!counters.has(el)) countTo(el, parseShort(text), text, el.closest(".tracker") ? fillBar(3.6) : null); });
    genga();
  });
})();
