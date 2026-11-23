# アーティスト公式サイト（INOHARA JUN）

GitHub Pages で**無料**公開できる、軽量な静的サイトです。

| これまでの悩み | このサイトでの解決 |
|---|---|
| 年間約2万円の使用料 | GitHub Pages は無料（必要なのは独自ドメイン代 年1,500円前後のみ） |
| 更新が面倒 | スマホ／PCのブラウザからフォームで投稿（Pages CMS）。ファイル1つ追加でも可 |
| 過去ログが残らない | ニュースは年別アーカイブ、終わったライブは毎日自動で「Archive」へ移動。記事ごとに固定URL |
| SNSとの連携が難しい | SNSリンクを一括管理／記事ごとのシェアボタン／OGP（シェア時のカード表示）／RSSで自動投稿連携 |
| ページが重い | 外部ライブラリなし。YouTubeはクリックするまで読み込まない軽量埋め込み |

## ページ構成
- `/` トップ（直近のライブ3件・最新ニュース5件・おすすめ動画）
- `/news/` ニュース（年ごとの過去ログ）
- `/live/` ライブ（予定／過去の公演アーカイブ）
- `/profile/` `/discography/` `/contact/`

## 更新のしかた

### 方法A：Pages CMS（おすすめ・フォーム入力）
1. https://app.pagescms.org に GitHub アカウントでログイン
2. このリポジトリを選ぶ → 左メニューに「ニュース」「ライブ」「プロフィール」「SNSリンク」「ディスコグラフィー」が出ます
3. 入力して保存 → 1〜2分でサイトに反映

### 方法B：GitHub で直接ファイルを追加
- ニュース：`_posts/2026-12-01-new-album.md`（ファイル名先頭が日付）
- ライブ：`_lives/2026-12-20-year-end.md`
- 書き方は同じフォルダのサンプルを参照

### 全体設定
- サイト名・肩書き・連絡先・トップの YouTube 動画：`_config.yml`
- SNS の URL：`_data/sns.yml`（空欄のものは表示されません）
- 画像：`assets/img/` に置く（プロフィール写真 `profile.svg`、SNSシェア画像 `ogp.png` を差し替え）

## SNS への自動投稿（任意）
`https://(サイトURL)/feed.xml` が RSS です。IFTTT や Zapier などの「RSS → X / Facebook 投稿」連携に登録すると、ニュースを書くだけで SNS にも告知できます。

## 公開手順（初回のみ）
1. GitHub で新しいリポジトリ（例：`inohara-jun-web`）を作り、このフォルダの中身をルートに置く
2. Settings → Pages → Source を **GitHub Actions** にする（`.github/workflows/pages.yml` が自動でビルド・公開）
3. 独自ドメインを使う場合：Settings → Pages → Custom domain に `www.inohara-jun-web.com` を入力し、ドメイン管理会社の DNS に CNAME（`<ユーザー名>.github.io`）を設定
   - 現在のサービスでドメインを取得している場合は、ドメインの移管または DNS 設定変更が必要です

## 手元で確認する
```sh
bundle install
bundle exec jekyll serve   # → http://localhost:4000
```
