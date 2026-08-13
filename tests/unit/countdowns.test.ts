import { describe, expect, it } from "vitest";
import app, {
  checkRateLimit,
  parseCountdownInput,
} from "../../src/worker/index";

function fakeKv() {
  const store = new Map<string, string>();
  return {
    get: async (k: string) => store.get(k) ?? null,
    put: async (k: string, v: string, _opts?: { expirationTtl?: number }) => {
      store.set(k, v);
    },
    delete: (k: string) => store.delete(k),
  };
}

function postCountdown(
  body: unknown,
  kv: ReturnType<typeof fakeKv>,
  headers: Record<string, string> = {},
) {
  return app.request(
    "/api/countdowns",
    {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    },
    { KV: kv },
  );
}

describe("parseCountdownInput", () => {
  it("UTC Z 付き ISO を受け入れる", () => {
    expect(
      parseCountdownInput({
        label: "リリース",
        targetAt: "2026-12-31T15:00:00.000Z",
      }),
    ).toEqual({ label: "リリース", targetAt: "2026-12-31T15:00:00.000Z" });
  });

  it("オフセット付き ISO を受け入れる", () => {
    expect(
      parseCountdownInput({
        label: "締切",
        targetAt: "2026-12-31T15:00:00+09:00",
      }),
    ).toEqual({ label: "締切", targetAt: "2026-12-31T15:00:00+09:00" });
  });

  it("タイムゾーンなしの日時文字列は拒否する", () => {
    expect(
      parseCountdownInput({
        label: "締切",
        targetAt: "2026-12-31T15:00:00",
      }),
    ).toBeNull();
  });

  it("空ラベル・欠落・100文字超・非ISOを拒否する", () => {
    expect(parseCountdownInput({ targetAt: "2026-12-31T15:00:00.000Z" })).toBeNull();
    expect(
      parseCountdownInput({ label: "", targetAt: "2026-12-31T15:00:00.000Z" }),
    ).toBeNull();
    expect(
      parseCountdownInput({
        label: "あ".repeat(101),
        targetAt: "2026-12-31T15:00:00.000Z",
      }),
    ).toBeNull();
    expect(parseCountdownInput({ label: "x", targetAt: "not-a-date" })).toBeNull();
  });

  it("RFC 2822 など Date.parse 可能な非ISOは拒否する", () => {
    expect(
      parseCountdownInput({
        label: "締切",
        targetAt: "Thu, 01 Jan 2026 00:00:00 Z",
      }),
    ).toBeNull();
  });
});

describe("checkRateLimit", () => {
  it("10回まで許可し11回目で拒否する", async () => {
    const kv = fakeKv();
    for (let i = 0; i < 10; i++) {
      expect(await checkRateLimit(kv, "203.0.113.10")).toBe(true);
    }
    expect(await checkRateLimit(kv, "203.0.113.10")).toBe(false);
  });

  it("キー消失後（TTL相当）は再び許可する", async () => {
    const kv = fakeKv();
    for (let i = 0; i < 10; i++) {
      await checkRateLimit(kv, "203.0.113.10");
    }
    expect(await checkRateLimit(kv, "203.0.113.10")).toBe(false);
    kv.delete("rl:203.0.113.10");
    expect(await checkRateLimit(kv, "203.0.113.10")).toBe(true);
  });
});

describe("POST /api/countdowns → GET /api/countdowns/:id", () => {
  it("登録したラベルと UTC ISO の目標日時を取得できる", async () => {
    const kv = fakeKv();
    const payload = {
      label: "リリース",
      targetAt: "2026-12-31T15:00:00.000Z",
    };
    const created = await postCountdown(payload, kv);
    expect(created.status).toBe(201);
    const { id } = (await created.json()) as { id: string };
    expect(id).toMatch(/^[0-9a-f]{8}$/i);

    const got = await app.request(`/api/countdowns/${id}`, {}, { KV: kv });
    expect(got.status).toBe(200);
    expect(await got.json()).toEqual(payload);
  });

  it("別リクエストでも同じ id から同一データを取得できる", async () => {
    const kv = fakeKv();
    const payload = {
      label: "記念日",
      targetAt: "2027-01-01T00:00:00.000Z",
    };
    const created = await postCountdown(payload, kv);
    const { id } = (await created.json()) as { id: string };

    const a = await app.request(`/api/countdowns/${id}`, {}, { KV: kv });
    const b = await app.request(`/api/countdowns/${id}`, {}, { KV: kv });
    expect(await a.json()).toEqual(payload);
    expect(await b.json()).toEqual(payload);
  });

  it("存在しない id は 404 と not_found", async () => {
    const res = await app.request("/api/countdowns/deadbeef", {}, { KV: fakeKv() });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_found" });
  });
});

describe("POST /api/countdowns バリデーション", () => {
  it("ラベル欠落は 400", async () => {
    const res = await postCountdown(
      { targetAt: "2026-12-31T15:00:00.000Z" },
      fakeKv(),
    );
    expect(res.status).toBe(400);
  });

  it("空ラベルは 400", async () => {
    const res = await postCountdown(
      { label: "", targetAt: "2026-12-31T15:00:00.000Z" },
      fakeKv(),
    );
    expect(res.status).toBe(400);
  });

  it("ラベル100文字超は 400", async () => {
    const res = await postCountdown(
      { label: "あ".repeat(101), targetAt: "2026-12-31T15:00:00.000Z" },
      fakeKv(),
    );
    expect(res.status).toBe(400);
  });

  it("目標日時欠落は 400", async () => {
    const res = await postCountdown({ label: "締切" }, fakeKv());
    expect(res.status).toBe(400);
  });

  it("非ISO形式は 400", async () => {
    const res = await postCountdown(
      { label: "締切", targetAt: "not-a-date" },
      fakeKv(),
    );
    expect(res.status).toBe(400);
  });

  it("RFC 2822 形式は 400", async () => {
    const res = await postCountdown(
      { label: "締切", targetAt: "Thu, 01 Jan 2026 00:00:00 Z" },
      fakeKv(),
    );
    expect(res.status).toBe(400);
  });

  it("タイムゾーンなしの日時文字列は 400", async () => {
    const res = await postCountdown(
      { label: "締切", targetAt: "2026-12-31T15:00:00" },
      fakeKv(),
    );
    expect(res.status).toBe(400);
  });

  it("リクエストボディ1KB超は 400", async () => {
    const huge = JSON.stringify({
      label: "x",
      targetAt: "2026-12-31T15:00:00.000Z",
      pad: "y".repeat(1100),
    });
    expect(new TextEncoder().encode(huge).length).toBeGreaterThan(1024);
    const res = await postCountdown(huge, fakeKv());
    expect(res.status).toBe(400);
  });
});

describe("POST /api/countdowns レートリミット", () => {
  it("同一IPで11回目は 429", async () => {
    const kv = fakeKv();
    const headers = { "CF-Connecting-IP": "203.0.113.10" };
    const body = { label: "締切", targetAt: "2026-12-31T15:00:00.000Z" };

    for (let i = 0; i < 10; i++) {
      const res = await postCountdown(body, kv, headers);
      expect(res.status).toBe(201);
    }

    const limited = await postCountdown(body, kv, headers);
    expect(limited.status).toBe(429);
  });
});
