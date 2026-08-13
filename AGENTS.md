# 共有カウントダウン

このリポジトリは kojo が生成した Web アプリです（React UI + Hono API）。

## アイデア

# 共有カウントダウン

目標の日時とラベルを登録すると共有URLが発行され、URLを開いた誰もが同じ残り日数・時間のカウントダウンを見られるアプリ。

## 意図

締切や記念日、リリース日までの残り時間を、毎回入力し直さずブックマークやチームへの共有URLで開くたびにすぐ確認したい人のための道具。カウントダウンがサーバ（KV）に保存され、URLを知る誰もが同じものを見られる匿名共有が核。個人認証・編集・削除は扱わず、登録と閲覧のみに絞る。

## 受け入れ条件の種

- 目標日時とラベルを登録すると共有URLが発行され、そのURLを開くと現在時刻との差分が残り日数・時間・分の形式でカウントダウン表示される
- 別のブラウザ（別セッション）で同じ共有URLを開いても、同じ目標日時とラベルのカウントダウンが表示される
- 存在しないIDの共有URLを開くと、見つからない旨の表示になりカウントダウンは表示されない


## 技術スタック（不変）

- TypeScript / React 19（ReactCompiler有効。状態管理ライブラリ禁止、リフトアップとprops受け渡しのみ） / Hono / Vite + vite-plugin-singlefile / vitest + Playwright
- UI の正本は `index.html` と `src/ui/`。`public/index.html` は単一ファイルのビルド出力（直接編集しない）
- 配信: Cloudflare Workers（main=`src/worker/index.ts`、assets=`public/`、/api/* が Worker に落ちる）
- 保守時もこのスタックを維持すること。フレームワーク・ビルドツール・宣言外ライブラリの導入は禁止

## 制約

- サーバは src/worker/index.ts の Hono アプリ。/api/* の JSON のみを提供し、HTML を返さない
- サーバ側の永続化は KV binding（c.env.KV）のみ。D1/DO・外部 API は使わない
- GET /api/health は KV 書込→読出を実往復して 200 と {"ok":true} を返し続けること（機械検証が依存。壊さない）
- 匿名書込エンドポイントには入力サイズ上限・バリデーション・簡易レートリミットを必ず実装する
- UI は API に到達できなくても骨格（タイトル・フッター）を描画すること（視覚検証は file:// で行われる）
- 受け入れ条件のテスト: API/ロジックは tests/unit/*.test.ts（vitest、KV はフェイクを app.request の第3引数で注入）、ブラウザ挙動は tests/app.spec.ts（Playwright）に書く
- PLAN.md の受け入れ条件それぞれに対応するテストを書き、`npm test` が通ること。API/ロジックは `tests/unit/*.test.ts`（vitest）、ブラウザ挙動は `tests/app.spec.ts`（Playwright）。雛形のスモークテストと health テストは削除しない
- UI の正本は `index.html` と `src/ui/`。`public/` は `npm run build` の出力なので直接編集しない
- favicon は `index.html` の `<head>` に `<link rel="icon" href="data:image/svg+xml,...">` のインライン data URI で含める（外部ファイル・外部URL不可。アプリのテーマに合った絵柄にする）
- hub（apps.jozo.beer）へのフッター導線は `index.html` の React ルート（`#root`）の外に置く（JS が読めない環境でも描画されるため）。マークアップは次のとおり固定する:

  ```html
  <footer style="margin-top:3rem;text-align:center;font-size:.8rem;opacity:.6">
    <a href="https://apps.jozo.beer" style="color:inherit">apps.jozo.beer</a>
  </footer>
  ```

  スタイル（リンク色を含む）はアプリのテーマに合わせて調整してよいが、リンク先 `https://apps.jozo.beer` とリンクテキスト `apps.jozo.beer` は変えない。リンク色を変える場合は背景とのコントラストを確保すること
- README.md はテンプレートが生成済み。削除しないこと
- apple-touch-icon / manifest / og-image / robots / sitemap は factory が公開時に自動生成するため、builder は書かない
- 完成条件: PLAN.md の受け入れ条件をすべて満たし、`npm run verify` と `npm test` が通ること
