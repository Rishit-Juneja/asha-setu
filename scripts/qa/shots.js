const { chromium } = require("playwright");

const BASE = "http://127.0.0.1:8000";
const OUT = "/tmp/opencode/asha-qa";

async function settle(page, ms = 700) {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(ms);
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath:
      "/home/dangerking8x/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome",
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      "--use-file-for-fake-audio-capture=/tmp/ashasetu_hinglish.wav",
    ],
  });

  const desktop = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1.5,
    serviceWorkers: "block",
    permissions: ["microphone"],
  });
  const page = await desktop.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") console.log("CONSOLE:", message.text());
  });
  page.on("pageerror", (error) => console.log("PAGEERROR:", error.message));

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await settle(page);
  await page.screenshot({ path: `${OUT}/01-login-desktop.png`, fullPage: true });

  await page.getByRole("button", { name: /Dr\. Rao/ }).click();
  await page.waitForURL("**/dashboard");
  await settle(page, 1000);
  await page.screenshot({ path: `${OUT}/02-dashboard-desktop.png`, fullPage: true });

  await page.goto(`${BASE}/visits?status=attention`, { waitUntil: "networkidle" });
  await settle(page);
  await page.screenshot({ path: `${OUT}/03-visits-attention.png`, fullPage: true });

  await page.locator('a[href^="/visits/"]').first().click();
  await page.waitForURL(/\/visits\/[a-f0-9]+/);
  await settle(page, 900);
  await page.screenshot({ path: `${OUT}/04-visit-detail.png`, fullPage: true });

  await page.goto(`${BASE}/readback/65a1ecfd48d1436c8dc513ef3a75c2cf`, {
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: `${OUT}/05-readback.png`, fullPage: true });

  await desktop.close();

  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    serviceWorkers: "block",
    permissions: ["microphone"],
  });
  const phone = await mobile.newPage();
  phone.on("pageerror", (error) => console.log("MOBILE PAGEERROR:", error.message));

  await phone.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await settle(phone);
  await phone.screenshot({ path: `${OUT}/06-login-mobile.png`, fullPage: true });

  await phone.getByRole("button", { name: /Lakshmi/ }).click();
  await phone.waitForURL(`${BASE}/`);
  await settle(phone, 900);
  await phone.screenshot({ path: `${OUT}/07-home-mobile.png`, fullPage: true });

  await phone.goto(`${BASE}/record`, { waitUntil: "networkidle" });
  await settle(phone);
  await phone.screenshot({ path: `${OUT}/08-record-mobile.png`, fullPage: true });

  await phone.goto(`${BASE}/visits`, { waitUntil: "networkidle" });
  await settle(phone);
  await phone.screenshot({ path: `${OUT}/09-visits-mobile.png`, fullPage: true });

  await mobile.close();
  await browser.close();
  console.log("done");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
