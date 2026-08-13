# 共有カウントダウン

このリポジトリは kojo が生成した Web アプリです（React UI + Hono API）。公開後の保守はこのリポジトリ単体で行います。

## アプリ概要と構成

ラベルと目標日時を登録すると共有URL（`#/c/<id>`）が発行され、同じ URL を開いた誰もが同じ残り日数・時間・分を見られる。目標は UTC 付き ISO 8601 で KV に保存し、閲覧者のタイムゾーンによらず同じ瞬間を指す。超過後は「経過」、未知 ID は「見つかりません」（カウントダウン非表示）。認証・編集・削除は扱わない。

| 領域 | 実装 |
|------|------|
| UI | `index.html` + `src/ui/`（正本）。`App.tsx` が `location.hash` でフォーム／カウントダウンを出し分け |
| 登録 | `CreateForm.tsx`。`datetime-local` を `toISOString()` で正規化し `POST /api/countdowns` |
| 閲覧 | `Countdown.tsx`。`GET /api/countdowns/:id`、毎秒 `formatRemaining`、共有URL表示 |
| 残り時間 | `formatRemaining.ts` の純関数（日・時間・分・`overdue`） |
| API | `src/worker/index.ts`。`POST /api/countdowns`（バリデーション・1KB上限・IP レートリミット）、`GET /api/countdowns/:id`、`GET /api/health`（KV 往復） |
| 永続化 | KV のみ。`cd:<id>` に `{ label, targetAt }`、レート制限は `rl:<IP>`（1分・10件） |
| テスト | ロジック・API は `tests/unit/*.test.ts`、ブラウザ挙動は `tests/app.spec.ts` |

サーバは `/api/*` の JSON のみ（HTML を返さない）。UI は API 到達不能でもタイトルとフッターを描画する。

## 技術スタック（不変）

- TypeScript / React 19（ReactCompiler有効。状態管理ライブラリ禁止、リフトアップとprops受け渡しのみ） / Hono / Vite + vite-plugin-singlefile / vitest + Playwright
- UI の正本は `index.html` と `src/ui/`。`public/index.html` は単一ファイルのビルド出力（直接編集しない）
- 配信: Cloudflare Workers（main=`src/worker/index.ts`、assets=`public/`、/api/* が Worker に落ちる）
- 保守時もこのスタックを維持すること。フレームワーク・ビルドツール・宣言外ライブラリの導入は禁止

## 品質不変条件

次を壊さないこと。変更後は `npm run verify` が通る状態を維持する。

- favicon は `index.html` の `<head>` に `<link rel="icon" href="data:image/svg+xml,...">` のインライン data URI（外部ファイル・外部 URL 不可）
- hub（apps.jozo.beer）へのフッターは `#root` の外に置く。リンク先 `https://apps.jozo.beer` とリンクテキスト `apps.jozo.beer` は変えない

```html
<footer style="margin-top:3rem;text-align:center;font-size:.8rem;opacity:.6">
  <a href="https://apps.jozo.beer" style="color:inherit">apps.jozo.beer</a>
</footer>
```

スタイル（リンク色を含む）はテーマに合わせて調整してよい。リンク色を変える場合は背景とのコントラストを確保する。

その他:

- `public/` は `npm run build` の出力なので直接編集しない
- README.md は削除しない
- apple-touch-icon / manifest / og-image / robots / sitemap は factory が公開時に自動生成するため書かない
- 雛形のスモークテストと health テストは削除しない
- サーバ側の永続化は KV binding（`c.env.KV`）のみ。D1/DO・外部 API は使わない
- `GET /api/health` は KV 書込→読出の実往復で 200 と `{"ok":true}` を返し続ける（機械検証が依存）
- 匿名書込エンドポイントには入力サイズ上限・バリデーション・簡易レートリミットを維持する

## 保守の進め方

1. 変更前に受け入れ条件をテストにする（API/ロジックは `tests/unit/*.test.ts`、ブラウザ挙動は `tests/app.spec.ts`）
2. 実装する
3. `npm test` が通ることを確認する（必要なら `npm run verify` も）
4. `git commit` と `git push`
5. `npm run deploy`

## PLAN.md について

`PLAN.md` は初回実装時の計画であり歴史的文書である。現状の正は README.md とテスト（`tests/`）である。受け入れ条件の追加・変更はテストと README に反映する。
