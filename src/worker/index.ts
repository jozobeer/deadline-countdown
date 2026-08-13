import { Hono } from "hono";

// workers-types 非依存方針（DOM lib と衝突するため）の最小 KV 型。使うメソッドだけ宣言する
export interface KvLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
}

type Bindings = { KV: KvLike };
type CountdownRecord = { label: string; targetAt: string };

const MAX_BODY_BYTES = 1024;
const MAX_LABEL_LENGTH = 100;
const RATE_LIMIT = 10;
const RATE_TTL_SEC = 60;

/** UTC オフセット付き ISO 8601（YYYY-MM-DDTHH:mm:ss[.sss]Z|±HH:MM|±HHMM） */
const ISO_WITH_OFFSET =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/i;

export function parseCountdownInput(
  body: unknown,
): { label: string; targetAt: string } | null {
  if (!body || typeof body !== "object") return null;
  const { label, targetAt } = body as Record<string, unknown>;
  if (typeof label !== "string" || label.length < 1 || label.length > MAX_LABEL_LENGTH) {
    return null;
  }
  if (typeof targetAt !== "string" || !ISO_WITH_OFFSET.test(targetAt)) {
    return null;
  }
  if (Number.isNaN(Date.parse(targetAt))) return null;
  return { label, targetAt };
}

/** true = 許可、false = 上限超過 */
export async function checkRateLimit(kv: KvLike, ip: string): Promise<boolean> {
  const key = `rl:${ip}`;
  const current = Number((await kv.get(key)) ?? "0");
  if (current >= RATE_LIMIT) return false;
  await kv.put(key, String(current + 1), { expirationTtl: RATE_TTL_SEC });
  return true;
}

const app = new Hono<{ Bindings: Bindings }>();

// 機械検証と監視が依存する。KV への書込→読出を実往復して 200 を返す。壊さないこと
app.get("/api/health", async (c) => {
  const stamp = String(Date.now());
  await c.env.KV.put("health", stamp, { expirationTtl: 60 });
  const read = await c.env.KV.get("health");
  return read === stamp ? c.json({ ok: true }) : c.json({ ok: false }, 500);
});

app.post("/api/countdowns", async (c) => {
  const raw = await c.req.text();
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) {
    return c.json({ error: "bad_request" }, 400);
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return c.json({ error: "bad_request" }, 400);
  }

  const parsed = parseCountdownInput(body);
  if (!parsed) {
    return c.json({ error: "bad_request" }, 400);
  }

  const ip = c.req.header("CF-Connecting-IP") ?? "unknown";
  if (!(await checkRateLimit(c.env.KV, ip))) {
    return c.json({ error: "rate_limited" }, 429);
  }

  const id = crypto.randomUUID().slice(0, 8);
  const record: CountdownRecord = {
    label: parsed.label,
    targetAt: parsed.targetAt,
  };
  await c.env.KV.put(`cd:${id}`, JSON.stringify(record));
  return c.json({ id }, 201);
});

app.get("/api/countdowns/:id", async (c) => {
  const id = c.req.param("id");
  const raw = await c.env.KV.get(`cd:${id}`);
  if (!raw) {
    return c.json({ error: "not_found" }, 404);
  }
  const record = JSON.parse(raw) as CountdownRecord;
  return c.json(record);
});

export default app;
