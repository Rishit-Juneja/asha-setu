const { chromium } = require("playwright");
const BASE = "http://127.0.0.1:8000";
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "/home/dangerking8x/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome",
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      "--use-file-for-fake-audio-capture=/tmp/ashasetu_hinglish.wav",
    ],
  });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    permissions: ["microphone"],
    serviceWorkers: "allow",
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR:", e.message));

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  const sw = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return { scope: reg.scope, active: !!reg.active, controller: !!navigator.serviceWorker.controller };
  });
  console.log("sw:", JSON.stringify(sw));
  await page.reload({ waitUntil: "networkidle" });
  console.log("controller after reload:", await page.evaluate(() => !!navigator.serviceWorker.controller));

  await page.getByRole("button", { name: /Lakshmi/ }).click();
  await page.waitForURL(`${BASE}/`);
  await page.waitForTimeout(500);

  await ctx.setOffline(true);
  console.log("online after offline:", await page.evaluate(() => navigator.onLine));
  try {
    await page.goto(`${BASE}/record`, { waitUntil: "domcontentloaded", timeout: 30000 });
    console.log("offline nav ok:", page.url());
  } catch (e) {
    console.log("OFFLINE NAV FAILED:", e.message);
    await browser.close();
    process.exit(1);
  }
  await page.waitForTimeout(500);
  const heading = await page.locator("h1").first().textContent();
  console.log("offline page heading:", heading);

  await page.getByRole("button", { name: "Start recording" }).click();
  await page.waitForTimeout(8300);
  await page.getByRole("button", { name: "Stop recording" }).click();
  await page.getByText("Saved on this phone").waitFor({ timeout: 15000 });
  console.log("offline saved state visible");
  await page.screenshot({ path: "/tmp/opencode/asha-qa/30-offline-saved.png", fullPage: true });

  await ctx.setOffline(false);
  console.log("online after reconnect:", await page.evaluate(() => navigator.onLine));
  try {
    await page.getByText(/synced — ready to review/).waitFor({ timeout: 60000 });
    console.log("sync toast seen");
  } catch (e) {
    console.log("SYNC TOAST NOT SEEN:", e.message);
  }
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "/tmp/opencode/asha-qa/31-after-sync.png", fullPage: true });

  await page.goto(`${BASE}/visits?status=drafts`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const body = await page.locator("main").innerText();
  console.log("drafts page snippet:", body.slice(0, 250).replace(/\n/g, " | "));
  await page.screenshot({ path: "/tmp/opencode/asha-qa/32-offline-synced-draft.png", fullPage: true });
  await browser.close();
  console.log("done");
})().catch((e) => { console.error(e); process.exit(1); });
