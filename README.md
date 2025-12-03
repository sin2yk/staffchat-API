# ①課題名
- StaffChat API版（自店舗クチコミ連携チャット）

## ②課題内容（どんな作品か）
- 小規模飲食店などの「店舗スタッフ専用」チャットアプリです。
- お客様ごとに「カルテ（顧客カード）」を作成し、その中でスタッフ同士がメモを残せます。
- 好み・NG食材・来店頻度・一言メモなどを共有して、引き継ぎをスムーズにすることを目的としています。
- 個人情報保護の観点から、フルネームや電話番号などは扱わず、「表示名＋ざっくりしたメモ」のみに絞っています。
- Firebase Authentication でスタッフごとのログイン管理
- Firestore 上の `customers` / `notes` コレクションを使った「カスタマーごとのメモ（カルテ）チャット」
- 06版では、Google Maps Places API を利用して
  - 自店舗の Google クチコミ（平均★・件数・レビュー本文）を右カラムに表示
  - 「店内共有メモ」と「外部のクチコミ」を同じ画面で参照できる構成に拡張

## ③アプリのデプロイURL
https://sin2yk.github.io/staffchat-API/

## ④アプリのログイン用IDまたはPassword（ある場合）

※すべて Firebase Authentication（Email/Password）で作成したアカウントです。  
※実際の本番運用では適宜変更・削除してください。

- 担任用（teacher）
  - ID: `teacher@staffchat.dev`
  - PW: `gsacademy2025`

- デモ用スタッフ1
  - ID: `staff01@staffchat.dev`
  - PW: `staff2025`

- デモ用スタッフ2
  - ID: `staff02@staffchat.dev`
  - PW: `staff2025`

- デモ用スタッフ3
  - ID: `staff03@staffchat.dev`
  - PW: `staff2025`

（※上記アカウントは Firebase コンソールの Authentication 画面から手動で作成）

## ⑤工夫した点・こだわった点
- 05版 StaffChat の構造をそのまま活かしつつ、06版では
  - Google Maps JavaScript API ＋ Places API で「自店舗のクチコミ」だけを取得
  - Place ID を固定して「自店専用のレビュー欄」にしている点
- 画面レイアウトはすべて `app.js` 内の `setupLayout()` で構築し、  
  - 左：カスタマーリスト（260px）
  - 中央：カスタマーチャット
  - 右：店舗レビュー（Google）
 という 3カラム構成を Tailwind CSS で実現
- DOM構築 → Firestore購読 → Google API 呼び出しの順番を整理して、
  - `initApp()` → `setupLayout()` → `initStoreReviews()` の流れにすることで  
    「Places API の callback とレイアウト生成の競合」を解消
- APIキーは
  - HTTPリファラ制限（`http://127.0.0.1:5500/*` とhttps://sin2yk.github.io/staffchat-API/* を許可）
  - API制限（Maps JavaScript API / Places API に限定）
  を設定し、課題レベルでも最低限のセキュリティを意識

## ⑥難しかった点・次回トライしたいこと（又は機能）
- 難しかった点
  - Google Maps JS の `callback` と、ES Modules（`type="module"`）で組んだ `app.js` の実行タイミング調整
  - 「DOMがまだ無いのに callback が走ってしまう」「グローバル関数が無い」といったエラーの切り分け
  - スマホ／タブレット／PC での 3カラムレイアウト調整（Tailwind の `grid` と `flex-1`、`max-h` の組み合わせ）
- 今後やりたいこと
  - カスタマーごとに「Googleクチコミと自前メモの差分」を分かりやすくする UI（タグ・フラグ・強調表示など）
  - 未読メモのバッジ表示、セグメント別フィルタ（初回来店／VIP／要注意など）
  - 右カラムのレビューから、そのまま「クレーム分析」「人気メニュー抽出」などのダッシュボード化

