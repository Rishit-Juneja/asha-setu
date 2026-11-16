const { chromium } = require("playwright");
const BASE = "http://127.0.0.1:8000";
const OUT = "/tmp/opencode/asha-qa";

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath:
      "/home/dangerking8x/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome",
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Lakshmi/ }).click();
  await page.waitForURL(`${BASE}/`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(800);

  const metrics = async (label) => {
    const data = await page.evaluate(() => {
      const nav = document.querySelector("nav.fixed");
      const main = document.querySelector("main");
      const stats = [...document.querySelectorAll("main p")].find(
        (p) => p.textContent.trim() === "NEED ATTENTION",
      );
      const rect = (el) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return {
          top: Math.round(r.top),
          bottom: Math.round(r.bottom),
          height: Math.round(r.height),
        };
      };
      return {
        scrollY: Math.round(window.scrollY),
        scrollHeight: document.documentElement.scrollHeight,
        viewportHeight: window.innerHeight,
        nav: rect(nav),
        main: rect(main),
        statLabel: rect(stats),
        bodyWidth: document.body.getBoundingClientRect().width,
      };
    });
    console.log(label, JSON.stringify(data));
  };

  await metrics("top");
  await page.screenshot({ path: `${OUT}/10-home-mobile-top.png` });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
  await metrics("bottom");
  await page.screenshot({ path: `${OUT}/11-home-mobile-bottom.png` });

  await page.goto(`${BASE}/record`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/12-record-mobile-top.png` });
  await page.evaluate(() => {
    const mic = [...document.querySelectorAll("h2")].find((el) =>
      el.textContent.includes("Tap to speak"),
    );
    mic?.scrollIntoView({ block: "center" });
  });
  await page.waitForTimeout(400);
  await metrics("record-mic");
  await page.screenshot({ path: `${OUT}/13-record-mobile-mic.png` });

  await page.goto(`${BASE}/visits`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  const header = await page.evaluate(() => {
    const h = document.querySelector("header.sticky");
    const r = h?.getBoundingClientRect();
    return r
      ? { width: Math.round(r.width), right: Math.round(r.right), viewport: window.innerWidth }
      : null;
  });
  console.log("visits header", JSON.stringify(header));
  const filters = await page.evaluate(() => {
    const row = document.querySelector("main .flex.gap-1\\.5.overflow-x-auto");
    if (!row) return null;
    const r = row.getBoundingClientRect();
    return {
      clientWidth: row.clientWidth,
      scrollWidth: row.scrollWidth,
      width: Math.round(r.width),
    };
  });
  console.log("filters", JSON.stringify(filters));
  await page.screenshot({ path: `${OUT}/14-visits-mobile-viewport.png` });

  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
