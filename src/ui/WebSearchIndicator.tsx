import { h } from "preact";
import { useEffect, useRef } from "preact/hooks";
import { colors, fonts } from "./theme.js";

/**
 * Browser mockup animation for the web_search phase.
 * Pure DOM manipulation via useRef for 60fps.
 */

interface Site {
  domain: string;
  path: string;
  status: string;
}

const SITES: Site[] = [
  { domain: "en.wikipedia.org", path: "/wiki/Neural_network", status: "Reading article..." },
  { domain: "arxiv.org", path: "/abs/2401.12345", status: "Fetching paper..." },
  { domain: "github.com", path: "/openai/gpt-4", status: "Scanning repo..." },
  { domain: "news.ycombinator.com", path: "/item?id=39284721", status: "Checking thread..." },
  { domain: "docs.python.org", path: "/3/library/asyncio.html", status: "Loading docs..." },
  { domain: "stackoverflow.com", path: "/questions/7843210", status: "Reading answers..." },
  { domain: "medium.com", path: "/@author/llm-guide", status: "Parsing article..." },
  { domain: "api.openai.com", path: "/v1/models", status: "Querying API..." },
  { domain: "scholar.google.com", path: "/scholar?q=attention", status: "Searching papers..." },
  { domain: "reddit.com", path: "/r/MachineLearning/comments/abc", status: "Scanning discussion..." },
];

const MAX_TABS = 4;

function pickSite(): Site {
  return SITES[Math.floor(Math.random() * SITES.length)];
}

const SKELETON_WIDTHS = [85, 60, 90, 40, 70];

export function WebSearchIndicator() {
  const containerRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = "";

    // ── Tab bar ────────────────────────────────────
    const tabBar = document.createElement("div");
    tabBar.style.cssText = `display:flex;align-items:flex-end;gap:2px;padding:4px 4px 0;background:#0d0d0d;border-bottom:1px solid ${colors.border};height:28px;overflow:hidden;`;
    container.appendChild(tabBar);

    // ── Address bar ────────────────────────────────
    const addrBar = document.createElement("div");
    addrBar.style.cssText = `display:flex;align-items:center;gap:6px;padding:4px 8px;background:${colors.surface1};border-bottom:1px solid ${colors.border};`;

    const icons = document.createElement("span");
    icons.style.cssText = `color:${colors.textMuted};font-size:9px;letter-spacing:2px;`;
    icons.textContent = "◀ ▶ ↻";
    addrBar.appendChild(icons);

    const urlBox = document.createElement("div");
    urlBox.style.cssText = `flex:1;font-size:9px;background:#0d0d0d;border:1px solid ${colors.border};padding:2px 6px;overflow:hidden;white-space:nowrap;font-family:${fonts.mono};`;

    const protocol = document.createElement("span");
    protocol.style.color = colors.textMuted;
    protocol.textContent = "https://";

    const domainEl = document.createElement("span");
    domainEl.style.color = colors.textSecondary;
    domainEl.textContent = "...";

    const pathEl = document.createElement("span");
    pathEl.style.color = colors.textMuted;

    urlBox.appendChild(protocol);
    urlBox.appendChild(domainEl);
    urlBox.appendChild(pathEl);
    addrBar.appendChild(urlBox);
    container.appendChild(addrBar);

    // ── Content (skeleton) ─────────────────────────
    const content = document.createElement("div");
    content.style.cssText = `padding:12px 10px;min-height:60px;`;

    const skeletonEls: HTMLDivElement[] = [];
    for (let i = 0; i < 5; i++) {
      const line = document.createElement("div");
      line.style.cssText = `height:8px;background:${colors.surface3};margin-bottom:5px;width:${SKELETON_WIDTHS[i]}%;animation:search-skeleton-pulse 0.8s ease-in-out infinite;animation-delay:${i * 0.1}s;`;
      content.appendChild(line);
      skeletonEls.push(line);
    }
    container.appendChild(content);

    // Inject skeleton pulse keyframes (once)
    if (!document.getElementById("search-skeleton-style")) {
      const style = document.createElement("style");
      style.id = "search-skeleton-style";
      style.textContent = `@keyframes search-skeleton-pulse { 0%,100%{opacity:0.25} 50%{opacity:0.55} }`;
      document.head.appendChild(style);
    }

    // ── Status bar ─────────────────────────────────
    const statusBar = document.createElement("div");
    statusBar.style.cssText = `display:flex;align-items:center;justify-content:space-between;padding:3px 8px;background:#0d0d0d;border-top:1px solid ${colors.border};font-size:8px;color:${colors.textMuted};font-family:${fonts.mono};`;

    const statusLeft = document.createElement("span");
    statusLeft.style.cssText = `display:flex;align-items:center;gap:4px;`;

    const spinner = document.createElement("span");
    spinner.style.cssText = `display:inline-block;width:6px;height:6px;border:1px solid ${colors.textMuted};border-top-color:${colors.text};border-radius:50%;animation:search-spin 0.6s linear infinite;`;
    statusLeft.appendChild(spinner);

    const statusText = document.createElement("span");
    statusText.textContent = "Waiting...";
    statusLeft.appendChild(statusText);

    const counterEl = document.createElement("span");
    counterEl.textContent = "0 sources";

    statusBar.appendChild(statusLeft);
    statusBar.appendChild(counterEl);
    container.appendChild(statusBar);

    // Inject spin keyframes (once)
    if (!document.getElementById("search-spin-style")) {
      const style = document.createElement("style");
      style.id = "search-spin-style";
      style.textContent = `@keyframes search-spin { to { transform: rotate(360deg); } }`;
      document.head.appendChild(style);
    }

    // ── State ──────────────────────────────────────
    const tabs: Site[] = [];
    let activeIdx = 0;
    let sourcesCount = 0;

    function renderTabs() {
      tabBar.innerHTML = "";
      for (let i = 0; i < tabs.length; i++) {
        const tab = document.createElement("div");
        const isActive = i === activeIdx;
        tab.style.cssText = `font-size:8px;padding:3px 6px 3px;background:${isActive ? colors.surface2 : colors.surface3};color:${isActive ? colors.textSecondary : colors.textMuted};border:1px solid ${isActive ? colors.borderEmphasis : colors.border};border-bottom:none;max-width:90px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:${fonts.mono};`;

        const label = document.createElement("span");
        label.textContent = tabs[i].domain;
        tab.appendChild(label);

        const close = document.createElement("span");
        close.style.cssText = `margin-left:4px;color:${colors.textMuted};font-size:8px;`;
        close.textContent = "×";
        tab.appendChild(close);

        tabBar.appendChild(tab);
      }
    }

    function updateUrl(site: Site) {
      domainEl.textContent = site.domain;
      pathEl.textContent = site.path;
    }

    function addTab() {
      const site = pickSite();
      tabs.push(site);
      if (tabs.length > MAX_TABS) tabs.shift();
      activeIdx = tabs.length - 1;
      sourcesCount++;
      renderTabs();
      updateUrl(site);
      statusText.textContent = site.status;
      counterEl.textContent = sourcesCount + " source" + (sourcesCount > 1 ? "s" : "");
    }

    function cycleTab() {
      if (tabs.length === 0) return;
      activeIdx = Math.floor(Math.random() * tabs.length);
      renderTabs();
      updateUrl(tabs[activeIdx]);
      statusText.textContent = tabs[activeIdx].status;
    }

    // Initial tab
    addTab();

    // Cycle
    intervalRef.current = setInterval(() => {
      if (Math.random() > 0.4) {
        addTab();
      } else {
        cycleTab();
      }
    }, 1500);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        margin: "4px 0",
        background: colors.surface1,
        border: `1px solid ${colors.border}`,
        overflow: "hidden",
      }}
    />
  );
}
