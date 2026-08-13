# 共有カウントダウン

ラベルと目標日時を登録すると共有URL（`#/c/<id>`）が発行され、URLを開いた誰もが同じ残り日数・時間・分のカウントダウンを見られる Web アプリです。目標日時は UTC 付き ISO 8601 で KV に保存され、閲覧者のタイムゾーンによらず同じ瞬間を指します。目標超過後は「経過」と表示し、存在しない ID では「見つかりません」のみを出してカウントダウンは描画しません。認証・編集・削除はありません。

## 公開URL

https://deadline-countdown.jozo.beer

## 開発

[kojo](https://github.com/jozobeer/kojo)（1日1アプリ自動生成基盤）により生成されたリポジトリです。

初回セットアップ: `npm install`（Playwright ブラウザ未取得の環境では `npx playwright install chromium`）

- `npm run dev` — wrangler dev でローカル起動（http://127.0.0.1:8787）
- `npm test` — build → typecheck → vitest（ユニット）→ Playwright（E2E）
- `npm run verify` — 不変条件チェック（favicon / apps.jozo.beer フッター / 単一ファイル出力）
- `npm run deploy` — ビルドして Cloudflare Workers へデプロイ

## 構成

- `index.html` + `src/ui/` — React UI の正本（`public/index.html` はビルド出力）
  - `App.tsx` — ハッシュルーティング（`#/c/<id>`）で登録フォームとカウントダウンを出し分け
  - `CreateForm.tsx` — ラベル＋`datetime-local` → UTC ISO に正規化して `POST /api/countdowns`
  - `Countdown.tsx` — `GET /api/countdowns/:id` と毎秒更新の残り時間表示
  - `formatRemaining.ts` — 残り日・時間・分（および超過判定）の純関数
- `src/worker/index.ts` — Hono（`GET /api/health`・`POST /api/countdowns`・`GET /api/countdowns/:id`。永続化は KV）
- `tests/unit/` — vitest ユニットテスト、`tests/app.spec.ts` — Playwright E2E
- `PLAN.md` — 初回実装時の計画（歴史的文書。現状の正は本 README とテスト）
