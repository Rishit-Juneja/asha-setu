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
  page.on("pageerror", (error) => console.log("PAGEERROR:", error.message));

  const measure = async (label) => {
    const data = await page.evaluate(() => ({
      url: location.pathname,
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      scrollY: Math.round(window.scrollY),
    }));
    console.log(label, JSON.stringify(data));
  };

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  await measure("login");
  await page.screenshot({ path: `${OUT}/20-login-mobile-fixed.png` });

  await page.getByRole("button", { name: /Lakshmi/ }).click();
  await page.waitForURL(`${BASE}/`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(800);
  await measure("home-top");
  await page.screenshot({ path: `${OUT}/21-home-mobile-top.png` });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
  await measure("home-bottom");
  await page.screenshot({ path: `${OUT}/22-home-mobile-bottom.png` });

  await page.goto(`${BASE}/record`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await measure("record-top");
  await page.screenshot({ path: `${OUT}/23-record-mobile-top.png` });
  await page.evaluate(() => {
    const mic = [...document.querySelectorAll("h2")].find((el) =>
      el.textContent.includes("Tap to speak"),
    );
    mic?.scrollIntoView({ block: "center" });
  });
  await page.waitForTimeout(400);
  await measure("record-mic");
  await page.screenshot({ path: `${OUT}/24-record-mobile-mic.png` });

  await page.goto(`${BASE}/visits`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await measure("visits");
  await page.screenshot({ path: `${OUT}/25-visits-mobile.png` });

  await page.locator('a[href^="/visits/"]').first().click();
  await page.waitForURL(/\/visits\/[a-f0-9]+/);
  await page.waitForTimeout(700);
  await measure("visit-detail");
  await page.screenshot({ path: `${OUT}/26-visit-detail-mobile.png` });

  await browser.close();
  console.log("done");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
