# API Gatewayによる動的画像変換

このプロジェクトは、AWSの「Dynamic Image Transformation for Amazon CloudFront」アーキテクチャをベースに、Amazon API Gateway、Lambda、CloudFrontを使用した動的画像変換ソリューションを実装しています。

## アーキテクチャ概要

このソリューションでは以下のAWSサービスを使用します：
- **Amazon CloudFront**: エッジサイドリクエスト最適化による変換済み画像のキャッシュ配信CDN
- **CloudFront Functions**: エッジでのリクエスト/レスポンス変更を行う軽量JavaScript関数
- **Amazon API Gateway**: 画像リクエスト用のREST APIエンドポイント
- **AWS Lambda**: Sharpを使用した画像変換のためのサーバーレス関数
- **Amazon S3**: 元画像とログの保存ストレージ
- **AWS Secrets Manager**: （オプション）署名検証用シークレットの保存
- **Amazon Rekognition**: （オプション）スマートクロップとコンテンツモデレーション

## 主要機能

1. **動的画像変換**: リサイズ、クロップ、フォーマット変換、品質調整
2. **TypeScript実装**: 包括的なエラーハンドリングを含む型安全で保守性の高いコード
3. **CloudFront Function統合**: エッジでのリクエスト最適化によるパフォーマンス向上
4. **自動WebP変換**: Acceptヘッダーに基づく自動WebPフォーマット変換
5. **キャッシュ**: 最適化されたエラーレスポンス処理を含むCloudFrontキャッシュ
6. **セキュリティ**: リクエスト認証のためのオプション署名検証
7. **スマート機能**: Amazon Rekognitionを使用したオプションのスマートクロップとコンテンツモデレーション
8. **堅牢な検証**: 包括的な入力検証とサニタイズ
9. **構造化ログ**: 可観測性向上のためのJSONベース構造化ログ
10. **拡張性**: 新しい変換機能を簡単に追加できるモジュラー設計
11. **監視**: ログとメトリクスのためのCloudWatch統合

## APIエンドポイント

プロキシ統合パターン（`{proxy+}`）を使用し、S3オブジェクトキーをパスとして直接受け取ります：

- `GET /{key}?edits={base64-encoded-json}` - 指定されたeditsによる画像変換（AWS Serverless Image Handler互換）
- `GET /{key}?{transformation-params}` - クエリパラメータによる画像変換

**パス形式の例:**
- `/images/photo.jpg?width=800&height=600&format=webp`
- `/folder/subfolder/image.png?quality=80&fit=cover`
- `/photos/vacation.jpg?edits=eyJ3aWR0aCI6ODAwLCJoZWlnaHQiOjYwMH0=`

## 変換パラメータ

- `width`: 対象幅
- `height`: 対象高さ
- `fit`: リサイズフィットモード (cover, contain, fill, inside, outside)
- `format`: 出力フォーマット (jpeg, png, webp, avif など)
- `quality`: 出力品質 (1-100)
- `rotate`: 回転角度
- `flip`: 水平反転
- `flop`: 垂直反転
- `grayscale`: グレースケール変換
- `blur`: ぼかし半径

## 🛠️ セットアップ

### 前提条件

- Node.js 22.x以降
- AWS CLI設定済み
- AWS CDK CLI (`npm install -g aws-cdk`)

### インストール

1. **CDK依存関係のインストール**
   ```bash
   cd cdk
   npm install
   ```

2. **Lambda依存関係のインストール**
   ```bash
   cd lambda/image-transform
   npm install
   npm run build
   cd ../..
   ```

### デプロイ

1. **CDKのブートストラップ（初回のみ）**
   ```bash
   cd cdk
   npx cdk bootstrap
   ```

2. **CDK TypeScriptコードをビルド**
   ```bash
   npm run build
   ```

3. **スタックをデプロイ**

   ```bash
   # 新しいバケットを作成する場合
   npx cdk deploy --context createImageBucket=true

   # 既存のバケットを使用する場合
   npx cdk deploy --context existingImageBucketName=my-existing-bucket

   # 追加オプション付きでデプロイ
   npx cdk deploy \
     --context createImageBucket=true \
     --context deployDemoUi=true \
     --context enableSmartCrop=true \
     --context deploySampleImages=true
   ```

**必須パラメータ:**
- `createImageBucket=true` または `existingImageBucketName=bucket-name` のいずれかが必要

### 画像ソースバケットの作成

画像用の既存のS3バケットがない場合、スタックで新しく作成できます：
```bash
cd cdk
npx cdk deploy \
  --context createImageBucket=true \
  --context deploySampleImages=true
```

### 既存のS3バケットの使用

既存のS3バケットを使用する場合：
```bash
cd cdk
npx cdk deploy \
  --context existingImageBucketName=my-existing-bucket
```

## 📁 プロジェクト構造

```plaintext
api-gateway/
├── cdk/                          # AWS CDK設定
│   ├── bin/api-gateway.ts       # CDKアプリケーションエントリーポイント
│   ├── lib/api-gateway-stack.ts # メインスタック定義
│   ├── cdk.json                 # CDK設定
│   ├── package.json             # Node.js依存関係
│   ├── tsconfig.json            # TypeScript設定
│   ├── jest.config.js           # テスト設定
│   └── test/                    # CDKテスト
├── lambda/                      # Lambda関数
│   └── image-transform/         # 画像変換Lambda
│       ├── src/                 # TypeScriptソース
│       ├── package.json         # Lambda依存関係
│       ├── tsconfig.json        # Lambda TypeScript設定
│       └── Dockerfile           # Lambda Docker設定
├── cloudfront-functions/        # CloudFront Functions
├── demo-ui/                     # デモUI
├── sample-images/               # サンプル画像
└── README.md                    # このファイル
```

## 設定オプション

- `deployDemoUi`: テスト用デモUIのデプロイ (デフォルト: true)
- `enableSignature`: リクエスト署名検証の有効化 (デフォルト: false)
- `enableSmartCrop`: 顔検出ベースのスマートクロップの有効化 (デフォルト: false)
- `enableContentModeration`: コンテンツモデレーションの有効化 (デフォルト: false)
- `enableAutoWebP`: Acceptヘッダーベースの自動WebP変換の有効化 (デフォルト: false)
- `createImageBucket`: 画像保存用の新しいS3バケットの作成 (デフォルト: false)
- `deploySampleImages`: 作成されたバケットへのサンプル画像のデプロイ (デフォルト: false)
- `existingImageBucketName`: 使用する既存のS3バケット名

## 環境変数

- `ENABLE_SIGNATURE`: リクエスト署名検証の有効化
- `SECRET_KEY`: 署名検証用のAWS Secrets Managerシークレット名
- `IMAGE_BUCKET`: 画像ソース用の特定のS3バケット名（制限がある場合）
- `LOG_LEVEL`: ログレベル (DEBUG, INFO, WARN, ERROR)

## 使用例

### 基本的な画像変換

クエリパラメータを使用した画像変換：
```url
https://d123456789.cloudfront.net/my-bucket/images/photo.jpg?width=800&height=600&format=webp&quality=85
```

### Edits形式の使用（Serverless Image Handler互換）

base64エンコードされたJSON editsオブジェクトを作成：
```json
{
  "resize": {
    "width": 800,
    "height": 600,
    "fit": "cover"
  },
  "webp": {
    "quality": 85
  }
}
```

エンコードしてURLで使用：
```url
https://d123456789.cloudfront.net/my-bucket/images/photo.jpg?edits=ewogICJyZXNpemUiOiB7CiAgICAid2lkdGgiOiA4MDAsCiAgICAiaGVpZ2h0IjogNjAwLAogICAgImZpdCI6ICJjb3ZlciIKICB9LAogICJ3ZWJwIjogewogICAgInF1YWxpdHkiOiA4NQogIH0KfQ==
```

### スマートクロップの例

顔検出ベースのクロップを有効化：
```url
https://d123456789.cloudfront.net/my-bucket/images/portrait.jpg?width=400&height=400&smartCrop=true
```

## アーキテクチャの利点

1. **コスト最適化**: CloudFrontキャッシュによるLambda実行回数の削減
2. **高パフォーマンス**: CloudFrontエッジロケーションによる低遅延画像配信
3. **スケーラビリティ**: 需要に応じて自動スケールするサーバーレスアーキテクチャ
4. **セキュリティ**: オプションのリクエスト署名検証とコンテンツモデレーション
5. **柔軟性**: 複数の画像フォーマットと変換オプションのサポート
6. **互換性**: 既存のS3バケットを変更なしで使用可能

## 監視とトラブルシューティング

- **CloudWatch Logs**: Lambda関数のログはCloudWatchで確認可能
- **CloudFront Logs**: アクセスログはログ用S3バケットに保存
- **API Gateway Metrics**: API のパフォーマンスとエラーの監視
- **X-Ray Tracing**: 詳細なリクエストトレース用に有効化可能（オプション）

## TypeScript実装詳細

### アーキテクチャの改善

Lambda関数は以下の改善を含むTypeScriptで書き直されています：

1. **型安全性**: すべてのインターフェースとAPIに対する包括的な型定義
2. **モジュラー設計**: 関心事を焦点化されたクラスに分離：
   - `Config`: 環境変数管理と検証
   - `Logger`: 設定可能レベルでの構造化ログ
   - `AWSClients`: 一元化されたAWSサービスクライアント管理
   - `ImageProcessor`: Sharpを使用した画像変換ロジック
   - `RequestParser`: リクエスト解析とパラメータ検証
   - `SignatureValidator`: HMAC署名検証
   - `ResponseBuilder`: HTTPレスポンス構築
   - `Validators`: 入力検証とサニタイズ

3. **強化されたエラーハンドリング**:
   - 適切なステータスコードを持つカスタム`ImageProcessingError`クラス
   - 包括的なAWSエラーマッピング
   - 適切な場所での優雅なエラー回復

4. **堅牢な検証**:
   - XSS攻撃を防ぐための入力サニタイズ
   - パラメータ範囲検証
   - S3バケットとオブジェクトキーの検証
   - 画像フォーマット検証

5. **セキュリティの向上**:
   - 一定時間署名比較
   - 包括的なセキュリティヘッダー
   - 入力サニタイズと検証

6. **可観測性の向上**:
   - 構造化JSONログ
   - 設定可能なログレベル
   - パフォーマンスメトリクスとタイミング
   - 詳細なエラーコンテキスト

## 🔧 開発

### Lambda関数の開発

```bash
cd lambda/image-transform
npm install
npm run build
npm test
```

### CDKの差分確認

```bash
cd cdk
npx cdk diff
```

### テスト実行

**Lambda関数のテスト:**
```bash
cd lambda/image-transform
npm test
```

**CDKテスト:**
```bash
cd cdk
npm test
```

### 開発ワークフロー

1. TypeScriptソースファイルは`lambda/image-transform/src/`にあります
2. ビルドにより`lambda/image-transform/dist/`にJavaScriptを生成
3. CDKがLambdaデプロイ用にdistフォルダをバンドル
4. デバッグ用にソースマップが含まれます

## 🗑️ クリーンアップ

スタックとすべてのリソースを削除するには：
```bash
cd cdk
npx cdk destroy
```
