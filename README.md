# Dynamic Optimization CDN

AWS CloudFrontを活用した動的画像最適化CDNソリューション

## 📋 概要

このプロジェクトは、AWSクラウドサービスを組み合わせて実装された、2つの異なるアプローチによる動的画像変換・配信システムです。用途や要件に応じて最適なソリューションを選択できます。

### 🎯 主要な価値提供

- **リアルタイム画像最適化**: オリジナル画像を保持したまま、リクエスト時に最適なサイズ・品質・フォーマットで画像を配信
- **高性能CDN配信**: CloudFrontによる世界規模の低遅延配信
- **自動スケーリング**: サーバーレスアーキテクチャによる需要に応じた自動拡張
- **コスト最適化**: キャッシュ機能による効率的なリソース使用

## 🏗️ ソリューション概要

### 1. API Gateway + Lambda アプローチ
**ディレクトリ**: `api-gateway/`

REST APIエンドポイントを通じた高機能な画像変換システム

**特徴:**
- TypeScript実装による型安全性と保守性
- Sharp.jsによる高品質な画像処理
- Amazon Rekognition連携（スマートクロップ・コンテンツモデレーション）
- 包括的な入力検証とセキュリティ機能
- 柔軟な変換パラメータとEdits形式サポート

**適用場面:**
- 高度な画像変換機能が必要な場合
- セキュリティ要件が厳しい環境
- Serverless Image Handler互換性が必要な場合

### 2. S3 Object Lambda アプローチ
**ディレクトリ**: `s3-object-lambda/`

S3オブジェクトアクセス時の透過的な画像変換システム

**特徴:**
- Python + PIL/Pillowによるシンプルな実装
- S3 Object Lambdaによる透過的な変換
- 軽量で理解しやすいアーキテクチャ
- 基本的な画像変換機能（リサイズ・フォーマット変換・品質調整）

**適用場面:**
- シンプルな画像変換で十分な場合
- 既存のS3ワークフローとの統合が重要な場合
- 迅速な導入・プロトタイピングが必要な場合

## 🚀 クイックスタート

### 共通前提条件

- Node.js 18.x以上
- AWS CLI設定済み
- AWS CDK CLI (`npm install -g aws-cdk`)

### ソリューション選択ガイド

| 要件 | API Gateway | S3 Object Lambda |
|------|-------------|------------------|
| 実装言語 | TypeScript | Python |
| 画像処理ライブラリ | Sharp.js | PIL/Pillow |
| 高度な変換機能 | ✅ | ⚠️ 基本機能のみ |
| セキュリティ機能 | ✅ 包括的 | ⚠️ 基本的 |
| スマートクロップ | ✅ | ❌ |
| コンテンツモデレーション | ✅ | ❌ |
| 実装複雑度 | 高 | 低 |
| 学習コスト | 高 | 低 |

## 📁 プロジェクト構造

```
dynamic-optimization-cdn/
├── api-gateway/                     # API Gateway + Lambda ソリューション
│   ├── lib/                        # CDKスタック定義
│   ├── lambda/image-transform/     # TypeScript Lambda関数
│   ├── cloudfront-functions/       # CloudFront Functions
│   ├── demo-ui/                    # デモ用UI
│   └── README.md                   # 詳細ドキュメント
├── s3-object-lambda/               # S3 Object Lambda ソリューション
│   ├── cdk/                        # CDKスタック定義
│   ├── lambda/                     # Python Lambda関数
│   └── README.md                   # 詳細ドキュメント
└── README.md                       # このファイル
```

## 🛠️ デプロイ手順

各ソリューションの詳細なデプロイ手順は、それぞれのディレクトリ内のREADMEを参照してください：

- **API Gateway ソリューション**: [`api-gateway/README.md`](./api-gateway/README.md)
- **S3 Object Lambda ソリューション**: [`s3-object-lambda/README.md`](./s3-object-lambda/README.md)

## 📊 機能比較

### 変換機能

| 機能 | API Gateway | S3 Object Lambda |
|------|-------------|------------------|
| リサイズ | ✅ | ✅ |
| クロップ | ✅ | ✅ |
| フォーマット変換 | ✅ JPEG/PNG/WebP/AVIF | ✅ JPEG/PNG/WebP |
| 品質調整 | ✅ | ✅ |
| 回転・反転 | ✅ | ❌ |
| ぼかし・グレースケール | ✅ | ❌ |
| 自動WebP変換 | ✅ | ❌ |
| スマートクロップ | ✅ (Rekognition) | ❌ |

### セキュリティ機能

| 機能 | API Gateway | S3 Object Lambda |
|------|-------------|------------------|
| 署名検証 | ✅ | ❌ |
| 入力検証・サニタイズ | ✅ 包括的 | ⚠️ 基本的 |
| コンテンツモデレーション | ✅ (Rekognition) | ❌ |
| サイズ制限 | ✅ 設定可能 | ✅ 固定 |

## 🔍 監視・運用

両ソリューション共通の監視ポイント：

- **CloudWatch Logs**: Lambda関数の実行ログ
- **CloudFront メトリクス**: キャッシュヒット率、レスポンス時間
- **API Gateway メトリクス**: リクエスト数、エラー率（API Gatewayソリューションのみ）
- **コスト監視**: Lambda実行時間、データ転送量

## 📚 参考情報

### AWSアーキテクチャ参考

- [Dynamic Image Transformation for Amazon CloudFront](https://aws.amazon.com/solutions/implementations/dynamic-image-transformation/)
- [AWS S3 Object Lambda](https://docs.aws.amazon.com/AmazonS3/latest/userguide/transforming-objects.html)

### 関連技術ドキュメント

- [AWS CDK](https://docs.aws.amazon.com/cdk/)
- [Amazon CloudFront](https://docs.aws.amazon.com/cloudfront/)
- [AWS Lambda](https://docs.aws.amazon.com/lambda/)

## 🤝 コントリビューション

プロジェクトへの貢献を歓迎します！改善提案やバグ報告は、Issueまたはプルリクエストでお知らせください。

## 📄 ライセンス

このプロジェクトはMITライセンスの下で公開されています。
