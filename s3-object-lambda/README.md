# S3 Object Lambdaによる画像処理

S3 Object Lambdaを使用した包括的なサーバーレス画像処理ソリューションです。AWSの「Dynamic Image Transformation for Amazon CloudFront」アーキテクチャと互換性があり、署名検証、スマートクロップ、コンテンツモデレーション等の高度な機能を提供するオンザフライ画像変換を実装しています。

## アーキテクチャ概要

このソリューションでは、AWS Dynamic Image Transformation for CloudFrontソリューションのS3 Object Lambdaパターンを実装し、以下のAWSサービスを使用します：

- **S3 Bucket**: ライフサイクル管理付きで元画像を保存
- **S3 Access Point**: S3バケットへのセキュアで制御されたアクセスを提供
- **S3 Object Lambda Access Point**: GETリクエストを傍受して画像変換を適用
- **Lambda Function**: 包括的なエラーハンドリングを含むPillow(PIL)を使用した画像処理
- **CloudFront Distribution**: 最適化されたキャッシュポリシーを持つグローバルCDN
- **CloudWatch Logs**: 監視とデバッグのための構造化ログ

## 主要機能

### 基本画像処理
- **動的リサイズ**: アスペクト比保持での幅・高さ変更
- **フォーマット変換**: JPEG、PNG、WebP、AVIFサポート
- **品質制御**: 設定可能な圧縮レベル（10-100）
- **回転**: 90°、180°、270°回転サポート
- **反転**: 水平・垂直反転操作
- **カラー効果**: グレースケール変換
- **ぼかし効果**: 設定可能な半径でのガウシアンぼかし

### 高度な機能
- **スマートクロップ**: Amazon Rekognitionを使用したAI駆動クロップ（オプション）
- **コンテンツモデレーション**: 不適切なコンテンツの自動検出（オプション）
- **自動WebP**: Acceptヘッダーに基づく自動WebP変換
- **署名検証**: セキュリティのためのURL署名検証
- **フォールバック画像**: エラーシナリオ用のデフォルト画像
- **CORSサポート**: 設定可能なクロスオリジンリソース共有

### パフォーマンス & 信頼性
- **包括的エラーハンドリング**: フォールバック戦略による優雅な劣化
- **構造化ログ**: 可観測性向上のためのJSON形式ログ
- **リクエスト検証**: 入力サニタイズとパラメータ検証
- **キャッシュ最適化**: 画像配信に最適化されたCloudFrontポリシー
- **セキュリティ**: 最小権限の原則に従ったIAMポリシー

## 設定

スタックはCDKコンテキストまたは環境変数を通じて広範囲な設定をサポートします：

### 基本設定
```bash
# 署名検証を有効化
cdk deploy -c enableSignature=true -c secretName=my-secret

# デモUIとサンプル画像でデプロイ
cdk deploy -c deployDemoUi=true -c deploySampleImages=true

# スマート機能を有効化
cdk deploy -c enableSmartCrop=true -c enableContentModeration=true
```

### 環境変数
```bash
export ENABLE_SIGNATURE=true
export SECRET_NAME=image-processing-secret
export ENABLE_SMART_CROP=true
export ENABLE_CONTENT_MODERATION=true
export AUTO_WEBP=true
export ENABLE_DEFAULT_FALLBACK_IMAGE=true
export FALLBACK_IMAGE_S3_BUCKET=my-fallback-bucket
export FALLBACK_IMAGE_S3_KEY=fallback.jpg
```

## 🛠️ セットアップ

### 前提条件
- 適切な権限で設定されたAWS CLI
- Node.js 18+およびnpm
- グローバルにインストールされたAWS CDK v2

### スタックのデプロイ

1. **依存関係のインストール**:
   ```bash
   cd cdk
   npm install
   ```

2. **デプロイメントの設定**（オプション）:
   ```bash
   # 設定用CDKコンテキストの設定
   cdk deploy -c deployDemoUi=true -c deploySampleImages=true

   # または環境変数を使用
   export ENABLE_SIGNATURE=true
   export SECRET_NAME=my-image-secret
   ```

3. **スタックのデプロイ**:
   ```bash
   # デフォルト設定でデプロイ
   npx cdk deploy

   # 特定の設定でデプロイ
   npx cdk deploy -c enableSignature=true -c secretName=my-secret
   ```

4. **サンプル画像のアップロード**（自動デプロイされていない場合）:
   ```bash
   aws s3 cp sample-images/ s3://your-bucket-name/samples/ --recursive
   ```

### 設定オプション

| パラメータ | 型 | デフォルト | 説明 |
|-----------|------|---------|-------------|
| `enableSignature` | boolean | false | URL署名検証の有効化 |
| `secretName` | string | - | AWS Secrets Managerシークレット名 |
| `deployDemoUi` | boolean | true | デモWebインターフェースのデプロイ |
| `enableSmartCrop` | boolean | false | AI駆動スマートクロップの有効化 |
| `enableContentModeration` | boolean | false | コンテンツモデレーションの有効化 |
| `enableAutoWebP` | boolean | false | Acceptヘッダーベース自動WebP |
| `lambdaMemorySize` | number | 1024 | Lambdaメモリ割り当て（MB） |
| `lambdaTimeout` | number | 30 | Lambdaタイムアウト（秒） |
| `priceClass` | string | PRICE_CLASS_100 | CloudFront価格クラス |
| `deploySampleImages` | boolean | true | サンプル画像のデプロイ |
| `enableDefaultFallbackImage` | boolean | false | フォールバック画像の有効化 |
| `enableCors` | boolean | false | S3バケットでのCORS有効化 |
| `corsOrigin` | string | "*" | CORS許可オリジン |

## 使用方法

### 基本的な画像変換

クエリパラメータを使用してCloudFront URLから画像にアクセス：

```url
https://d1234567890.cloudfront.net/samples/image.jpg?width=300&height=200&quality=80&format=webp
```

### サポート対象パラメータ

| パラメータ | 説明 | 値 | 例 |
|-----------|-------------|--------|---------|
| `width` | 幅（ピクセル） | 1-2000 | `width=300` |
| `height` | 高さ（ピクセル） | 1-2000 | `height=200` |
| `quality` | 品質 | 1-100 | `quality=80` |
| `profile` | **NEW** 品質プロファイル | high, standard, optimized | `profile=high` |
| `format` | 出力フォーマット | jpeg, png, webp, avif | `format=webp` |
| `rotate` | 回転 | 0, 90, 180, 270 | `rotate=90` |
| `fit` | リサイズフィットモード | contain, cover, fill, inside, outside | `fit=cover` |
| `flip` | 垂直反転 | true/false | `flip=true` |
| `flop` | 水平反転 | true/false | `flop=true` |
| `grayscale` | グレースケール変換 | true/false | `grayscale=true` |
| `blur` | ぼかし半径 | 0-100 | `blur=5` |
| `smartCrop` | スマートクロップ | true/false | `smartCrop=true` |

### 高度な使用例

```bash
# アスペクト比保持でのリサイズ
https://domain.com/image.jpg?width=400

# 特定フィットモードでのリサイズ
https://domain.com/image.jpg?width=400&height=300&fit=cover

# 品質指定でのフォーマット変換
https://domain.com/image.jpg?format=webp&quality=90

# 複数変換の組み合わせ
https://domain.com/image.jpg?width=300&height=300&fit=cover&format=webp&quality=85&grayscale=true

# 回転とぼかしの適用
https://domain.com/image.jpg?width=500&rotate=90&blur=2

# 品質プロファイルの使用
https://domain.com/image.jpg?width=800&format=webp&profile=high

# 動的品質最適化（プロファイル自動選択）
https://domain.com/image.jpg?width=200&format=avif  # 小画像 → optimized プロファイル適用

# フォーマット別最適化
https://domain.com/image.jpg?format=avif&profile=standard  # AVIF品質60
https://domain.com/image.jpg?format=webp&profile=standard  # WebP品質80
```

## 🆕 最適化された品質システム

このアップデートでは、画像処理のベストプラクティスと最新研究に基づいた高度な品質最適化システムを実装しました。

### 品質プロファイル

| プロファイル | 用途 | JPEG品質 | WebP品質 | AVIF品質 | PNG圧縮 |
|-------------|------|----------|----------|----------|---------|
| `high` | 写真・アート・詳細重視 | 90 | 85 | 70 | レベル6 |
| `standard` | 一般用途・バランス重視 | 85 | 80 | 60 | レベル6 |
| `optimized` | 高速配信・帯域幅重視 | 75 | 70 | 50 | レベル9 |

### 動的品質調整

品質プロファイルが指定されていない場合、以下のロジックで自動選択されます：

- **高品質モード**: `quality≥90` が指定された場合
- **最適化モード**: 画像サイズが300px以下の場合（サムネイル用）
- **標準モード**: 画像サイズが1200px以上の場合（大画像用）
- **デフォルト**: 上記以外は設定された標準プロファイル

### フォーマット別最適化

各画像フォーマットの特性に応じて最適化されています：

- **JPEG**: プログレッシブスキャン有効、高品質クロマサブサンプリング
- **WebP**: method=6（高効率圧縮）、ロッシー圧縮
- **AVIF**: 新しいフォーマットの特性を活用した品質設定
- **PNG**: optimize=true、パレット・チャンク最適化

### 環境変数設定

新しい設定オプション：

```bash
# 品質プロファイル（デフォルト: standard）
QUALITY_PROFILE=standard

# 動的品質調整の有効化（デフォルト: true）
ENABLE_DYNAMIC_QUALITY=true

# プログレッシブJPEGの有効化（デフォルト: true）
ENABLE_PROGRESSIVE_JPEG=true
```

### CloudFront Function最適化

CloudFront Functionも品質プロファイル機能をサポートするように更新されました：

- **エッジでのバリデーション**: 無効な品質プロファイル値を事前にフィルタリング
- **キャッシュ効率化**: パラメータの並び順を統一してキャッシュヒット率を向上
- **パフォーマンス向上**: 不正なリクエストをエッジで早期に除外

```javascript
// サポートされる品質プロファイル
const VALID_PROFILES = ["high", "standard", "optimized"];

// 無効な値は自動的にフィルタリングされます
https://domain.com/image.jpg?profile=invalid  // profileパラメータは除外される
https://domain.com/image.jpg?profile=high     // 正常に処理される
```

### URL署名（有効化時）

署名検証が有効化されている場合、URLに署名と有効期限パラメータを含める必要があります：

```url
https://domain.com/image.jpg?width=300&expires=1640995200&signature=abc123...
```

## デモUI

`deployDemoUi=true`でデプロイした場合、スタック出力で提供されるDemo UI URLでWebインターフェースが利用可能です。デモでは以下のことができます：

- リアルタイムでの変換パラメータの調整
- 元画像と変換後画像のプレビュー
- パラメータ化されたURLの生成
- 利用可能なすべての機能のテスト

## 監視とログ

### CloudWatch Logs
- Lambda関数ログ: `/aws/lambda/{stack-name}-ImageProcessingFunction`
- リクエスト相関付きの構造化JSONログ

### 監視すべき主要メトリクス
- Lambda実行時間とメモリ使用量
- CloudFrontキャッシュヒット率
- S3リクエストパターン
- エラー率と種類

### サンプルログエントリ
```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "INFO",
  "message": "Image processing completed successfully",
  "request_id": "abc-123-def",
  "content_type": "image/webp",
  "output_size": 45678,
  "processing_time_ms": 150
}
```

## セキュリティの考慮事項

### IAM権限
- Lambda実行ロールは最小権限の原則に従う
- S3バケットポリシーはCloudFrontとLambdaへのアクセスを制限
- 署名検証が有効な場合のみSecrets Managerへのアクセス

### 入力検証
- すべてのパラメータが検証・サニタイズされる
- 拡張子ベースのファイルタイプ制限
- リソース枯渇を防ぐサイズ制限
- パストラバーサル保護

### ネットワークセキュリティ
- 転送中のすべてのトラフィックが暗号化（HTTPS）
- CloudFront Origin Access Control（OAC）によるS3アクセスの保護
- ブラウザアクセス用オプショナルCORS設定

## トラブルシューティング

### 一般的な問題

1. **画像が読み込まれない**
   - CloudFrontディストリビューションの状態を確認
   - S3バケット権限を確認
   - Lambda関数ログを確認

2. **署名検証エラー**
   - Secrets Managerにシークレットが存在することを確認
   - 署名生成アルゴリズムを確認
   - expiresパラメータが将来の時刻であることを確認

3. **スマートクロップが動作しない**
   - Rekognition権限を確認
   - RekognitionのAWSリージョンサポートを確認
   - エラーについてLambda関数ログを確認

### デバッグコマンド

```bash
# スタック出力の確認
aws cloudformation describe-stacks --stack-name your-stack-name

# Lambdaログの表示
aws logs tail /aws/lambda/your-function-name --follow

# S3アクセスのテスト
aws s3 ls s3://your-bucket-name/

# CloudFrontディストリビューションの確認
aws cloudfront get-distribution --id your-distribution-id
```

## パフォーマンス最適化

### キャッシュ戦略
- 画像配信に最適化されたCloudFrontキャッシュポリシー
- クエリ文字列パラメータをキャッシュキーに含める
- エラーレスポンスを10分間キャッシュ

### Lambda最適化
- コールドスタート高速化のためのコンテナイメージパッケージング
- 画像処理ニーズに基づくメモリ割り当て
- AWS SDKクライアントの接続再利用

### コスト最適化
- 設定可能なCloudFront価格クラス
- ログ保持のためのS3ライフサイクルルール
- 不要な課金を防ぐLambdaタイムアウト最適化

## 🗑️ クリーンアップ

すべてのリソースを削除するには：

```bash
npx cdk destroy
```

注意：`autoDeleteObjects`が有効でない場合、コンテンツを含むS3バケットは手動削除が必要な場合があります。

## アーキテクチャの利点

1. **コスト最適化**: CloudFrontキャッシュによるLambda実行回数の削減
2. **高パフォーマンス**: CloudFrontエッジロケーションによる低遅延画像配信
3. **スケーラビリティ**: 需要に応じて自動スケールするサーバーレスアーキテクチャ
4. **セキュリティ**: オプションのリクエスト署名検証とコンテンツモデレーション
5. **柔軟性**: 複数の画像フォーマットと変換オプションのサポート
6. **互換性**: 既存のS3バケットを変更なしで使用可能

## 📁 プロジェクト構造

```plaintext
s3-object-lambda/
├── cdk/                          # AWS CDK設定
│   ├── bin/cdk.ts               # CDKアプリケーションエントリーポイント
│   ├── lib/s3-object-lambda-stack.ts # メインスタック定義
│   ├── cdk.json                 # CDK設定
│   ├── package.json             # Node.js依存関係
│   ├── tsconfig.json            # TypeScript設定
│   ├── jest.config.js           # テスト設定
│   └── test/                    # CDKテスト
├── lambda/                      # Lambda関数
│   ├── index.py                 # メイン画像処理関数
│   ├── aws_clients.py           # AWSクライアント管理
│   ├── config.py                # 設定管理
│   ├── logger.py                # 構造化ログ
│   ├── signature_validator.py   # 署名検証
│   ├── models.py                # 型定義
│   ├── validators.py            # 入力検証
│   ├── pyproject.toml           # Python依存関係
│   └── uv.lock                  # 依存関係ロック
├── demo-ui/                     # デモUI
├── sample-images/               # サンプル画像
└── README.md                    # このファイル
```

## 環境変数

- `ENABLE_SIGNATURE`: リクエスト署名検証の有効化
- `SECRET_NAME`: 署名検証用のAWS Secrets Managerシークレット名
- `ENABLE_SMART_CROP`: AI駆動スマートクロップの有効化
- `ENABLE_CONTENT_MODERATION`: コンテンツモデレーションの有効化
- `AUTO_WEBP`: Acceptヘッダーに基づく自動WebP変換の有効化
- `LOG_LEVEL`: ログレベル（DEBUG、INFO、WARN、ERROR）
- `ENABLE_DEFAULT_FALLBACK_IMAGE`: フォールバック画像の有効化
- `FALLBACK_IMAGE_S3_BUCKET`: フォールバック画像のS3バケット名
- `FALLBACK_IMAGE_S3_KEY`: フォールバック画像のS3オブジェクトキー

## 🔧 開発

### Lambda関数の開発

```bash
cd lambda
# 依存関係のインストール
uv install

# 型チェック
uv run mypy .

# テスト実行
uv run pytest
```

### CDKの差分確認

```bash
cd cdk
npx cdk diff
```

### テスト実行

**Lambda関数のテスト:**
```bash
cd lambda
uv run pytest
```

**CDKテスト:**
```bash
cd cdk
npm test
```
