import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

// 雛形スモーク。builder は受け入れ条件ごとの機能テストをこのファイルに追記する（雛形は削除しない）
test("ページがロードできてページエラーがない", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("/");
  await expect(page.locator("body")).toBeVisible();
  expect(errors).toEqual([]);
});

test("GET /api/health が 200 で ok:true を返す", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({ ok: true });
});

/** ローカル解釈で差が 2日3時間4分になる組（タイムゾーンに依存しない差分） */
const FIXED_NOW = "2026-08-13T10:00:00";
const TARGET_LOCAL = "2026-08-15T13:04";

async function createCountdown(page: Page, label: string) {
  await page.clock.setFixedTime(new Date(FIXED_NOW));
  await page.goto("/");
  await page.getByTestId("label-input").fill(label);
  await page.getByTestId("target-input").fill(TARGET_LOCAL);
  await page.getByTestId("submit").click();
  await expect(page.getByTestId("countdown-label")).toHaveText(label);
  const share = page.getByTestId("share-url");
  await expect(share).toBeVisible();
  const href = await share.getAttribute("href");
  expect(href).toBeTruthy();
  expect(href!).toContain("#/c/");
  return href!;
}

test("登録すると共有URLが発行され、固定時刻で日・時間・分が一致する", async ({
  page,
}) => {
  await createCountdown(page, "リリース日");
  await expect(page.getByTestId("days")).toHaveText("2");
  await expect(page.getByTestId("hours")).toHaveText("3");
  await expect(page.getByTestId("minutes")).toHaveText("4");
});

test("別ブラウザコンテキストでも同じラベルと日・時間・分になる", async ({
  browser,
}) => {
  const contextA = await browser.newContext();
  const pageA = await contextA.newPage();
  const shareUrl = await createCountdown(pageA, "締切");
  await expect(pageA.getByTestId("days")).toHaveText("2");
  await expect(pageA.getByTestId("hours")).toHaveText("3");
  await expect(pageA.getByTestId("minutes")).toHaveText("4");

  const contextB = await browser.newContext();
  const pageB = await contextB.newPage();
  await pageB.clock.setFixedTime(new Date(FIXED_NOW));
  await pageB.goto(shareUrl);
  await expect(pageB.getByTestId("countdown-label")).toHaveText("締切");
  await expect(pageB.getByTestId("days")).toHaveText("2");
  await expect(pageB.getByTestId("hours")).toHaveText("3");
  await expect(pageB.getByTestId("minutes")).toHaveText("4");

  await contextA.close();
  await contextB.close();
});

test("存在しないIDでは見つからない表示になりカウントダウンが出ない", async ({
  page,
}) => {
  await page.goto("/#/c/does-not-exist");
  await expect(page.getByTestId("not-found")).toBeVisible();
  await expect(page.getByTestId("days")).toHaveCount(0);
  await expect(page.getByTestId("hours")).toHaveCount(0);
  await expect(page.getByTestId("minutes")).toHaveCount(0);
});

test("file:// では API 不達でもタイトルとフッターが描画される", async ({
  page,
}) => {
  const htmlPath = path.resolve(process.cwd(), "public/index.html");
  await page.goto(`file://${htmlPath}`);
  await expect(page.getByRole("heading", { name: "共有カウントダウン" })).toBeVisible();
  await expect(page.locator('footer a[href="https://apps.jozo.beer"]')).toHaveText(
    "apps.jozo.beer",
  );
  await expect(page.getByTestId("days")).toHaveCount(0);
});

function webApplicationNode(parsed: unknown): Record<string, unknown> | undefined {
  const nodes = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object"
      ? [parsed, ...(((parsed as { "@graph"?: unknown[] })["@graph"] ?? []))]
      : [];
  return nodes.find((node) => {
    if (!node || typeof node !== "object") return false;
    const type = (node as { "@type"?: unknown })["@type"];
    return type === "WebApplication" || (Array.isArray(type) && type.includes("WebApplication"));
  }) as Record<string, unknown> | undefined;
}

test("公開ページに空でない meta description がある", async ({ page }) => {
  await page.goto("/");
  const content = await page.locator('meta[name="description"]').getAttribute("content");
  expect(content?.trim()).toBeTruthy();
});

test("公開ページに WebApplication の JSON-LD がある", async ({ page }) => {
  await page.goto("/");
  const scripts = page.locator('script[type="application/ld+json"]');
  await expect(scripts.first()).toBeAttached({ timeout: 5000 });
  const count = await scripts.count();
  let app: Record<string, unknown> | undefined;
  for (let i = 0; i < count; i++) {
    const raw = await scripts.nth(i).textContent();
    if (!raw?.trim()) continue;
    app = webApplicationNode(JSON.parse(raw));
    if (app) break;
  }
  expect(app).toBeTruthy();
  expect(String(app!.name ?? "").trim()).toBeTruthy();
  expect(String(app!.description ?? "").trim()).toBeTruthy();
  expect(String(app!.url ?? "").trim()).toBeTruthy();
  expect(String(app!.applicationCategory ?? "").trim()).toBeTruthy();
  const offers = app!.offers as { price?: unknown } | undefined;
  expect(offers?.price).toBe("0");
});

test("使い方と FAQ のセクションが初期表示にある", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "使い方" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "FAQ" })).toBeVisible();
});
