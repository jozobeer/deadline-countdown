# PLAN: 共有カウントダウン

## 概要

目標日時とラベルを登録すると共有URLが発行され、そのURLを開いた誰もが同じ残り日数・時間・分のカウントダウンを見られる Web アプリを作る。カウントダウンは Cloudflare Workers の KV に保存され、URL を知っていれば別ブラウザ・別セッションからでも同じ内容が見られる。

## 意図（明示）

締切や記念日、リリース日までの残り時間を、毎回入力し直さずブックマークやチームへの共有URLで開くたびにすぐ確認したい人のための道具。カウントダウンがサーバ（KV）に保存され、URLを知る誰もが同じものを見られる匿名共有が核。個人認証・編集・削除は扱わず、登録と閲覧のみに絞る。

## 受け入れ条件

- [ ] 目標日時とラベルを登録すると共有URLが発行され、そのURLを開くと現在時刻との差分が残り日数・時間・分の形式でカウントダウン表示される
- [ ] 別のブラウザ（別セッション）で同じ共有URLを開いても、同じ目標日時とラベルのカウントダウンが表示される（目標日時は UTC 付き ISO 8601 で保存され、閲覧者のタイムゾーンによらず同じ瞬間を指す）
- [ ] 存在しないIDの共有URLを開くと、見つからない旨の表示になりカウントダウンは表示されない
- [ ] POST /api/countdowns は不正入力（ラベル欠落・空・100文字超、目標日時の欠落・非ISO形式、1KB超のボディ）を 400 で拒否し、同一IPからの過剰な連続登録を 429 で拒否する
- [ ] GET /api/health が KV 書込→読出の実往復で 200 と {"ok":true} を返し続ける（雛形テストを維持）
- [ ] API に到達できない環境（file:// 直開き）でもタイトルとフッターの骨格が描画される

## 実装方針

### API（src/worker/index.ts、Hono）

既存の Hono アプリに 2 エンドポイントを追加する。永続化は c.env.KV のみ。

- `POST /api/countdowns`
  - 入力: JSON `{ label: string, targetAt: string }`
  - バリデーション: ボディ 1KB 以下、label は 1〜100 文字、targetAt は UTC オフセット付き ISO 8601（末尾 `Z` またはオフセット指定あり）かつ `Date.parse` 可能。タイムゾーン情報のない日時文字列（datetime-local の生値など）は 400 で拒否し、閲覧者ごとに解釈が揺れる値を保存させない
  - レートリミット: KV キー `rl:<IP>`（IP は CF-Connecting-IP ヘッダ）に 1 分 TTL のカウンタを置き、1 分あたり 10 件超で 429
  - 保存: `crypto.randomUUID()` の先頭 8 文字を id とし、KV キー `cd:<id>` に `{ label, targetAt }` を JSON で保存（TTL なし）
  - 応答: 201 `{ id }`
- `GET /api/countdowns/:id`
  - KV `cd:<id>` を読み、あれば 200 `{ label, targetAt }`、なければ 404 `{ error: "not_found" }`
- 既存の `GET /api/health` は変更しない

主要関数: `parseCountdownInput(body): { label, targetAt } | null`（バリデーション）、`checkRateLimit(kv, ip): Promise<boolean>`。どちらも純粋寄りに切り出して vitest で直接テストする。

### UI（index.html + src/ui/、React 19）

単一ページ・ハッシュルーティング（`#/c/<id>`）。サーバは HTML を返さないため、共有URLは `https://<host>/#/c/<id>` の形式にする。状態はリフトアップと props のみで管理する。

- `App.tsx`: `location.hash` を state に持ち、`hashchange` を購読してフォーム画面とカウントダウン画面を出し分ける
- `CreateForm.tsx`: ラベル入力＋日時入力（`<input type="datetime-local">`）。送信時に datetime-local の値（タイムゾーンなしローカル時刻）を `new Date(value).toISOString()` で UTC 付き ISO 8601（例: `2026-12-31T15:00:00.000Z`）へ正規化してから POST する。保存値は常に絶対時刻となり、閲覧者のタイムゾーンによらず同じ瞬間を指す。成功したら共有URLを表示（コピー可能なテキスト）してそのままカウントダウン画面へ遷移
- `Countdown.tsx`: id で GET し、404 なら「見つかりません」を表示してカウントダウン（残り日数・時間・分）は一切描画しない。取得できたら `targetAt - now` を残り日数・時間・分に分解して表示し、`setInterval` で毎秒更新。目標超過後は「経過」表示に切り替える
- 残り時間の分解は純粋関数 `formatRemaining(targetAt: string, now: number): { days, hours, minutes, overdue }` として `src/ui/` に切り出し、UI とテストの双方から使う
- タイトルとフッター（apps.jozo.beer、`#root` の外・マークアップは AGENTS.md 指定のまま）は index.html 側にあり、fetch 失敗でも描画される。favicon は砂時計系の SVG data URI を `<head>` にインラインで置く

### テスト

- `tests/unit/countdowns.test.ts`（vitest、フェイク KV を app.request の第3引数で注入）: 登録→取得の往復（保存された targetAt が送信した UTC ISO 値と一致することを含む）、別インスタンス相当の再取得で同一データ、404、バリデーション各違反の 400（タイムゾーン情報なしの日時文字列を含む）、レートリミットの 429
- `tests/unit/remaining.test.ts`（vitest）: `formatRemaining` を固定時刻で検証する。now を固定引数で与え、既知の targetAt との組で日・時間・分の期待値が正確に一致すること（例: 差が 2 日 3 時間 4 分 → `{ days: 2, hours: 3, minutes: 4 }`）、超過時に `overdue: true` になる境界を確認する。固定表示の実装では通らない期待値照合にする
- `tests/app.spec.ts`（Playwright）: 登録→共有URL遷移→残り時間表示の確認（`page.clock` で現在時刻を固定し、登録した目標日時から計算した具体的な日・時間・分の値が表示されることを検証）、新規ブラウザコンテキスト（別セッション）で同じURLを開いて同一ラベル・同一目標日時に基づく同一の残り時間表示を検証、存在しないIDで「見つかりません」が表示されかつ日・時間・分のカウントダウン要素が存在しないことを検証
- file:// 骨格表示: `tests/app.spec.ts` に `page.goto('file://.../public/index.html')` でビルド出力を直接開き、API 不達でもタイトルとフッター（apps.jozo.beer リンク）が描画されることを検証するテストを追加する
- 雛形の health テスト・スモークテストは削除しない

### 申し送りへの対応

前回の失敗は plan-fixer 実行環境の JSON パース例外（env 分類）で、計画内容の欠陥ではない。本計画は機械処理で壊れにくいようプレーンな Markdown のみで記述し（コードフェンス内以外に JSON 断片や特殊記号を置かない）、受け入れ条件は前回の種を全て含めて緩めていない。
