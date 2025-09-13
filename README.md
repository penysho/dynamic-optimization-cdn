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

### 1. API Gateway + Lambda アプローチ 🚀
**ディレクトリ**: `api-gateway/`

高性能REST APIによる包括的画像変換システム

#### アーキテクチャ図
```plaintext
[Browser/App] → [CloudFront] → [API Gateway] → [Lambda] → [S3]
                      ↓                           ↓
                 [Cache Layer]              [Rekognition]
                                               ↓
                                        [Secrets Manager]
```

#### 技術スタック
- **フロントエンド**: CloudFront + CloudFront Functions
- **API Layer**: Amazon API Gateway (REST API)
- **処理エンジン**: AWS Lambda (TypeScript + Sharp.js)
- **ストレージ**: Amazon S3
- **AI機能**: Amazon Rekognition（オプション）
- **セキュリティ**: AWS Secrets Manager + HMAC署名

#### 主要特徴
- **TypeScript実装**: 型安全性と優れた開発体験
- **Sharp.js処理**: ネイティブ性能による高速画像処理
- **包括的セキュリティ**: 署名検証、入力サニタイズ、XSS対策
- **AWS Serverless Image Handler互換**: 既存システムからの移行が容易
- **CloudFront Functions**: エッジでのリクエスト最適化
- **詳細な可観測性**: 構造化ログ、メトリクス、X-Ray対応

#### 適用場面
- **本格的Webアプリケーション**: 商用サービス、高負荷環境
- **セキュリティ重視**: 金融、医療等の規制業界
- **高度な画像処理**: スマートクロップ、コンテンツモデレーション必須
- **既存システム移行**: Serverless Image Handlerからの移行

### 2. S3 Object Lambda アプローチ 🔧
**ディレクトリ**: `s3-object-lambda/`

透過的で軽量なS3統合画像変換システム

#### アーキテクチャ図
```plaintext
[Browser/App] → [CloudFront] → [S3 Object Lambda] → [Lambda] → [S3 Bucket]
                      ↓              ↓                  ↓           ↓
                 [Cache Layer]  [Access Point]    [PIL Processing] [Original Images]
```

#### 技術スタック
- **フロントエンド**: CloudFront Distribution
- **変換レイヤー**: S3 Object Lambda Access Point
- **処理エンジン**: AWS Lambda (Python + Pillow)
- **ストレージ**: Amazon S3 (Standard Access Point)
- **AI機能**: Amazon Rekognition（オプション）

#### 主要特徴
- **透過的変換**: S3 GETリクエスト時の自動変換
- **Python + Pillow**: シンプルで理解しやすい実装
- **軽量アーキテクチャ**: 最小限のコンポーネント構成
- **既存システム統合**: S3 URLをそのまま利用可能
- **コスト効率**: シンプルな構成によるコスト最適化

#### 適用場面
- **プロトタイピング**: 迅速な概念実証、MVP開発
- **既存S3統合**: 既存のS3ワークフローを変更せずに機能追加
- **学習・教育**: AWS Lambda、S3の学習用途
- **軽量サービス**: 基本的な画像変換で十分なアプリケーション

## 🚀 クイックスタート

### 前提条件

#### 必須ツール
- **Node.js**: 18.x以上（API Gatewayは22.x以上推奨）
- **Python**: 3.11以上（S3 Object Lambdaソリューション用）
- **AWS CLI**: 設定済み（`aws configure`完了）
- **AWS CDK CLI**: `npm install -g aws-cdk`

#### AWS権限
以下のAWSサービスに対する適切な権限が必要：
- CloudFormation（スタック作成・更新）
- Lambda（関数作成・実行）
- API Gateway（API作成・設定）
- S3（バケット・オブジェクト操作）
- CloudFront（ディストリビューション管理）
- IAM（ロール・ポリシー作成）

### 30秒でデプロイ（最短手順）

#### API Gateway ソリューション
```bash
# 1. プロジェクトクローン
git clone <repository-url>
cd dynamic-optimization-cdn/api-gateway

# 2. 依存関係インストール
cd cdk && npm install
cd ../lambda/image-transform && npm install && npm run build

# 3. デプロイ（新しいS3バケット作成）
cd ../../cdk
npx cdk bootstrap  # 初回のみ
npx cdk deploy --context createImageBucket=true --context deploySampleImages=true
```

#### S3 Object Lambda ソリューション
```bash
# 1. プロジェクトクローン
git clone <repository-url>
cd dynamic-optimization-cdn/s3-object-lambda

# 2. 依存関係インストール
cd cdk && npm install
cd ../lambda && uv sync  # または pip install -r requirements.txt

# 3. デプロイ
cd ../cdk
npx cdk bootstrap  # 初回のみ
npx cdk deploy --context deploySampleImages=true
```

### ソリューション選択ガイド

#### 🎯 用途別推奨

| 用途 | API Gateway | S3 Object Lambda | 理由 |
|------|-------------|------------------|------|
| 本格的なWebサービス | ✅ **推奨** | ⚠️ | 包括的セキュリティ、高機能 |
| プロトタイピング | ⚠️ | ✅ **推奨** | シンプル、迅速導入 |
| 既存S3ワークフロー統合 | ⚠️ | ✅ **推奨** | 透過的変換、既存システム改修不要 |
| 高負荷商用サービス | ✅ **推奨** | ⚠️ | 高性能、詳細監視 |
| 学習・検証目的 | ⚠️ | ✅ **推奨** | 理解しやすい、軽量 |

#### 📊 技術特性比較

| 項目 | API Gateway | S3 Object Lambda |
|------|-------------|------------------|
| **実装言語** | TypeScript | Python |
| **画像処理ライブラリ** | Sharp.js | PIL/Pillow |
| **学習コスト** | 高（型安全、豊富な機能） | 低（シンプル構造） |
| **実装複雑度** | 高（包括的機能） | 低（必要最小限） |
| **パフォーマンス** | 高速（native処理） | 標準（Python処理） |
| **スケーラビリティ** | 高（API Gateway制限） | 高（S3制限） |
| **既存システム連携** | API変更必要 | 透過的（変更不要） |

### 🛠️ 開発環境セットアップ

#### 推奨IDE設定
```bash
# VS Code拡張（推奨）
ext install ms-vscode.vscode-typescript-next  # TypeScript
ext install ms-python.python                   # Python
ext install aws-scripting-guy.cdk-snippets    # CDK
```

#### 開発用環境変数（.env.local）
```bash
# 共通設定
AWS_REGION=us-east-1
LOG_LEVEL=DEBUG

# デバッグ用
ENABLE_SIGNATURE=false
ENABLE_SMART_CROP=false
ENABLE_CONTENT_MODERATION=false
```

## 📁 プロジェクト構造

```plaintext
dynamic-optimization-cdn/
├── api-gateway/                        # API Gateway + Lambda ソリューション
│   ├── cdk/                           # AWS CDK設定
│   │   ├── bin/api-gateway.ts         # CDKエントリーポイント
│   │   ├── lib/api-gateway-stack.ts   # スタック定義
│   │   ├── test/api-gateway.test.ts   # CDKテスト
│   │   ├── package.json               # CDK依存関係
│   │   ├── tsconfig.json              # TypeScript設定
│   │   ├── jest.config.js             # テスト設定
│   │   └── cdk.json                   # CDK設定
│   ├── lambda/                        # Lambda関数
│   │   └── image-transform/           # TypeScript画像変換Lambda
│   │       ├── src/                   # TypeScriptソースコード
│   │       │   ├── index.ts           # Lambda関数エントリーポイント
│   │       │   ├── image-processor.ts # 画像処理ロジック
│   │       │   ├── request-parser.ts  # リクエスト解析
│   │       │   ├── config.ts          # 設定管理
│   │       │   ├── validators.ts      # 入力検証
│   │       │   └── types.ts           # 型定義
│   │       ├── package.json           # Lambda依存関係
│   │       ├── tsconfig.json          # TypeScript設定
│   │       └── Dockerfile             # コンテナビルド設定
│   ├── cloudfront-functions/          # CloudFront Functions
│   │   └── request-modifier.js        # エッジリクエスト最適化
│   ├── demo-ui/                       # デモ用UI
│   │   └── index.html                 # デモWebインターフェース
│   ├── sample-images/                 # サンプル画像
│   └── README.md                      # 詳細ドキュメント
├── s3-object-lambda/                  # S3 Object Lambda ソリューション
│   ├── cdk/                           # AWS CDK設定
│   │   ├── bin/cdk.ts                 # CDKエントリーポイント
│   │   ├── lib/s3-object-lambda-stack.ts # スタック定義
│   │   ├── test/cdk.test.ts           # CDKテスト
│   │   ├── package.json               # CDK依存関係
│   │   ├── tsconfig.json              # TypeScript設定
│   │   ├── jest.config.js             # テスト設定
│   │   └── cdk.json                   # CDK設定
│   ├── lambda/                        # Lambda関数（Python）
│   │   ├── index.py                   # メイン画像処理関数
│   │   ├── aws_clients.py             # AWSクライアント管理
│   │   ├── config.py                  # 設定管理
│   │   ├── logger.py                  # 構造化ログ
│   │   ├── signature_validator.py     # 署名検証
│   │   ├── types.py                   # 型定義
│   │   ├── validators.py              # 入力検証
│   │   ├── pyproject.toml             # Python依存関係
│   │   ├── uv.lock                    # 依存関係ロック
│   │   └── README.md                  # Lambda実装詳細
│   ├── demo-ui/                       # デモ用UI
│   │   └── index.html                 # デモWebインターフェース
│   ├── sample-images/                 # サンプル画像
│   └── README.md                      # 詳細ドキュメント
├── dynamic-image-transformation-for-amazon-cloudfront.template # AWS公式テンプレート
├── CLAUDE.md                          # 開発履歴・メモ
└── README.md                          # このファイル
```

## 🛠️ デプロイ手順

### 基本デプロイフロー

各ソリューション共通の基本的なデプロイ手順：

1. **依存関係のインストール**
   ```bash
   # CDK依存関係
   cd [solution-name]/cdk
   npm install

   # アプリケーション依存関係（ソリューション固有）
   cd ../lambda
   # API Gateway: npm install && npm run build
   # S3 Object Lambda: uv sync
   ```

2. **CDKブートストラップ（初回のみ）**
   ```bash
   cd cdk
   npx cdk bootstrap
   ```

3. **デプロイ実行**
   ```bash
   npx cdk deploy
   ```

### 詳細な手順

各ソリューションの詳細なデプロイ手順とオプション設定は、それぞれのディレクトリ内のREADMEを参照してください：

- **API Gateway ソリューション**: [`api-gateway/README.md`](./api-gateway/README.md)
- **S3 Object Lambda ソリューション**: [`s3-object-lambda/README.md`](./s3-object-lambda/README.md)

## ⚙️ 設定オプション

### 共通設定オプション

両ソリューションで利用可能な主要な設定項目：

| 設定項目 | 説明 | API Gateway | S3 Object Lambda |
|---------|------|-------------|------------------|
| `deployDemoUi` | デモUIのデプロイ | ✅ | ✅ |
| `deploySampleImages` | サンプル画像のデプロイ | ✅ | ✅ |
| `enableSignature` | 署名検証の有効化 | ✅ | ✅ |
| `secretName` | Secrets Managerシークレット名 | ✅ | ✅ |
| `enableSmartCrop` | スマートクロップの有効化 | ✅ | ✅ |
| `enableContentModeration` | コンテンツモデレーション | ✅ | ✅ |
| `enableAutoWebP` | 自動WebP変換 | ✅ | ✅ |
| `lambdaMemorySize` | Lambdaメモリサイズ(MB) | ✅ | ✅ |
| `lambdaTimeout` | Lambdaタイムアウト(秒) | ✅ | ✅ |

### API Gateway固有設定

| 設定項目 | デフォルト値 | 説明 |
|---------|-------------|------|
| `createImageBucket` | false | 新しい画像バケットの作成 |
| `existingImageBucketName` | - | 既存バケット名 |
| `enableCorsSupport` | false | CORS有効化 |
| `corsAllowedOrigins` | "*" | CORS許可オリジン |

### S3 Object Lambda固有設定

| 設定項目 | デフォルト値 | 説明 |
|---------|-------------|------|
| `priceClass` | PRICE_CLASS_100 | CloudFront価格クラス |
| `enableDefaultFallbackImage` | false | フォールバック画像有効化 |
| `fallbackImageBucket` | - | フォールバック画像バケット |
| `fallbackImageKey` | - | フォールバック画像キー |

### 環境変数

実行時設定で使用される主要な環境変数：

#### 共通環境変数

- `LOG_LEVEL`: ログレベル（DEBUG, INFO, WARN, ERROR）
- `ENABLE_SIGNATURE`: 署名検証有効化フラグ
- `SECRET_NAME`: AWS Secrets Managerシークレット名
- `ENABLE_SMART_CROP`: スマートクロップ有効化
- `ENABLE_CONTENT_MODERATION`: コンテンツモデレーション有効化
- `AUTO_WEBP`: 自動WebP変換有効化

#### API Gateway固有

- `IMAGE_BUCKET`: 画像ソースバケット名
- `ENABLE_CORS`: CORS有効化フラグ
- `CORS_ORIGIN`: CORS許可オリジン

#### S3 Object Lambda固有

- `ENABLE_DEFAULT_FALLBACK_IMAGE`: フォールバック画像有効化
- `FALLBACK_IMAGE_S3_BUCKET`: フォールバック画像バケット
- `FALLBACK_IMAGE_S3_KEY`: フォールバック画像オブジェクトキー

## 📊 機能比較

### 基本変換機能

| 機能 | API Gateway | S3 Object Lambda | 詳細 |
|------|-------------|------------------|------|
| リサイズ | ✅ | ✅ | 幅・高さ指定、アスペクト比保持 |
| クロップ | ✅ | ✅ | 任意位置・サイズでのクロップ |
| フォーマット変換 | ✅ JPEG/PNG/WebP/AVIF | ✅ JPEG/PNG/WebP/AVIF | 出力フォーマット選択 |
| 品質調整 | ✅ 1-100 | ✅ 10-100 | 圧縮レベル調整 |
| フィットモード | ✅ 5種類 | ✅ 5種類 | cover, contain, fill, inside, outside |

### 高度な変換機能

| 機能 | API Gateway | S3 Object Lambda | 詳細 |
|------|-------------|------------------|------|
| 回転 | ✅ | ✅ | 90°、180°、270° |
| 反転 | ✅ | ✅ | 水平・垂直反転 |
| ぼかし | ✅ | ✅ | 0-100の半径指定 |
| グレースケール | ✅ | ✅ | カラーからモノクロ変換 |
| 自動WebP変換 | ✅ | ✅ | Acceptヘッダー対応 |
| スマートクロップ | ✅ (Rekognition) | ✅ (Rekognition) | AI顔検出ベース |

### セキュリティ・検証機能

| 機能 | API Gateway | S3 Object Lambda | 詳細 |
|------|-------------|------------------|------|
| 署名検証 | ✅ | ✅ | HMAC-SHA256署名検証 |
| 入力検証 | ✅ 包括的 | ✅ 基本的 | パラメータ範囲・型チェック |
| サニタイズ | ✅ XSS対策 | ⚠️ 基本的 | 悪意ある入力の無害化 |
| コンテンツモデレーション | ✅ (Rekognition) | ✅ (Rekognition) | 不適切コンテンツ検出 |
| サイズ制限 | ✅ 設定可能 | ✅ 設定可能 | 画像ファイルサイズ制限 |
| レート制限 | ✅ API Gateway | ⚠️ S3制限のみ | リクエスト頻度制御 |

### 運用・監視機能

| 機能 | API Gateway | S3 Object Lambda | 詳細 |
|------|-------------|------------------|------|
| 構造化ログ | ✅ JSON | ✅ JSON | 可観測性向上 |
| エラーハンドリング | ✅ 包括的 | ✅ 包括的 | 適切なHTTPステータス |
| フォールバック画像 | ✅ | ✅ | エラー時デフォルト画像 |
| メトリクス | ✅ API Gateway + Lambda | ✅ S3 + Lambda | CloudWatch統合 |
| X-Ray トレーシング | ✅ | ✅ | 分散トレース対応 |

### パフォーマンス・アーキテクチャ

| 項目 | API Gateway | S3 Object Lambda | 比較 |
|------|-------------|------------------|------|
| 実装言語 | TypeScript | Python | TypeScript: 型安全、Python: シンプル |
| 画像処理ライブラリ | Sharp.js | Pillow (PIL) | Sharp: 高性能、Pillow: 豊富な機能 |
| コールドスタート | コンテナ最適化 | レイヤー最適化 | 両者とも最適化済み |
| メモリ効率 | 高効率 | 標準 | Sharpがメモリ効率良い |
| 処理速度 | 高速 | 標準 | Native処理で高速 |
| 互換性 | Serverless Image Handler | 独自API | 既存システム移行考慮 |

## 🔧 開発・保守

### 統一された開発体験

両ソリューションは以下の共通原則に基づいて設計されています：

- **明確な関心事の分離**: インフラ定義（CDK）とアプリケーション実装（Lambda）の分離
- **一貫したプロジェクト構造**: 学習コストを削減し、保守性を向上
- **包括的なドキュメント**: セットアップから運用まで詳細に記載
- **ベストプラクティスの適用**: 各技術スタックの推奨パターンを採用

### 開発ワークフロー

1. **ローカル開発**
   ```bash
   cd [solution-name]/lambda
   # コード変更・テスト実行
   ```

2. **差分確認**
   ```bash
   cd cdk
   npx cdk diff
   ```

3. **デプロイ**
   ```bash
   npx cdk deploy
   ```

## 🔍 監視・運用

### 共通監視ポイント

- **CloudWatch Logs**: Lambda関数の実行ログ
- **CloudFront メトリクス**: キャッシュヒット率、レスポンス時間
- **API Gateway メトリクス**: リクエスト数、エラー率（API Gatewayソリューションのみ）
- **コスト監視**: Lambda実行時間、データ転送量

### パフォーマンス最適化

- **適切なキャッシュ設定**: CloudFrontでの効率的なキャッシュ戦略
- **Lambda最適化**: メモリサイズ・タイムアウトの適切な設定
- **画像フォーマット選択**: WebP/AVIF等の最新フォーマット活用

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
