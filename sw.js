# VISION BREAK

> 近未来視覚トレーニング × 高速リアクションゲーム

ランドルト環（視力検査の「C」）の切れ目方向に上下左右フリックして破壊していく、30秒間の反射神経ゲームです。

## 🎮 ゲームルール

| フェーズ | 内容 |
|---|---|
| 0〜10秒 | ランドルト環が1個ずつ出現 |
| 10〜20秒 | 2個同時出現 |
| 20〜30秒 | 3個同時出現（ラストスパート） |

- **フリック** → C の切れ目方向へフリック
- **タップ** → ボーナスの「O」を破壊（+300点）
- **ミスしたら即終了**

### ボーナスステージ
1. 「O」をタップ → スプーンが大量出現（×2点）
2. スプーンを全滅 → フォーク＆ナイフが出現（×4点）
3. 全滅 → パーフェクトボーナス！

## 🚀 動かし方

### ローカル開発
```bash
# Python
python3 -m http.server 8080

# Node.js
npx serve .

# VS Code
# Live Server 拡張でindex.htmlを開く
```

ブラウザで `http://localhost:8080` を開く。

### GitHub Pages 公開
```bash
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/YOUR_NAME/vision-break.git
git push -u origin main
```

リポジトリの Settings → Pages → Source: `main` ブランチ → Save

公開URL: `https://YOUR_NAME.github.io/vision-break/`

## 📁 ファイル構成

```
vision-break/
├── index.html          # エントリーポイント（PWA対応）
├── manifest.json       # PWAマニフェスト
├── sw.js               # Service Worker（オフライン対応）
├── icon-192.svg
├── icon-512.svg
└── src/
    ├── main.js         # 起動・入力とゲームの接続
    ├── constants.js    # 全定数
    ├── game.js         # ゲームステートマシン・メインループ
    ├── ring.js         # ランドルト環エンティティ
    ├── bullet.js       # 発射体（C→Oを補完する弾）
    ├── background.js   # 近未来アニメ背景
    ├── particles.js    # パーティクルシステム
    ├── utensils.js     # スプーン/フォーク/ナイフ
    ├── ui.js           # HUD・スタート/リザルト画面
    └── input.js        # タッチ/マウス統合入力
```

## 📐 技術仕様

- **フレームワーク不要** — バニラJS (ES Modules)
- **描画** — Canvas 2D API
- **入力** — Pointer Events (touch + mouse 統合)
- **PWA** — Service Worker + Web App Manifest
- **スコア保存** — localStorage
- **外部依存なし** — CDN不要、完全ローカル動作

## ✨ 演出一覧

| トリガー | 演出 |
|---|---|
| フリック成功 | 弾発射 → C が閉じる → 砕けるシャード + パーティクル |
| コンボ5以上 | 画面揺れ + ビッグメッセージ + 背景脈動 |
| ボーナスO破壊 | 金色パーティクル爆発 + スプーン出現 |
| ミス | スローモーション + 赤フラッシュ + ガラス割れ演出 |
| ラスト10秒 | 背景が赤みを帯びる + スキャン速度UP |
| 全ウテンシル破壊 | PERFECT演出 + 画面揺れ |
