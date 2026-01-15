# 10,000 AIdeas 応募サポーター

AWS AI ハッカソン向けのアイデア生成・翻訳支援ツール。日本語でアイデアを入力すると、Amazon Bedrock を使って英語に翻訳し、コンテスト応募フォームに貼り付けられる形式で出力します。

**Live Demo:** https://d2yln9ekz5m28m.cloudfront.net

## Objective

- 母国語（日本語）でアイデアを入力し、自然な英語に翻訳
- AI によるアイデア提案機能（Working Backwards メソッド）
- **リアルタイムストリーミング**で AI レスポンスを表示
- サーバーレスアーキテクチャで低コスト運用

## File Structure

```
kiro-universe/
├── frontend/                    # 静的フロントエンド
│   ├── index.html              # メインHTML
│   ├── styles.css              # スタイルシート
│   ├── app.js                  # アプリケーションロジック
│   ├── config.js               # API設定（デプロイ時に生成）
│   └── assets/                 # 画像等のアセット
│
├── lambda/
│   ├── bedrock-translator/     # Bedrock API プロキシ Lambda
│   │   └── index.js            # ストリーミング対応ハンドラー
│   └── edge-signer/            # Lambda@Edge (SigV4署名)
│       └── index.js            # CloudFront → Lambda URL 署名
│
├── cdk/                        # AWS CDK インフラ定義
│   ├── lib/
│   │   └── kiro-translator-stack.ts
│   ├── bin/
│   │   └── cdk.ts
│   └── package.json
│
└── README.md
```

## Architecture

```mermaid
flowchart TB
    subgraph Client
        Browser[Browser]
    end

    subgraph AWS Cloud
        subgraph CloudFront
            CF[CloudFront Distribution]
            Edge[Lambda@Edge<br/>SigV4 Signing]
        end

        subgraph Origin
            S3[S3 Bucket<br/>Static Frontend]
            LambdaURL[Lambda Function URL<br/>RESPONSE_STREAM]
        end

        subgraph Backend
            Bedrock[Amazon Bedrock<br/>Claude Haiku 4.5]
            DynamoDB[DynamoDB<br/>Analytics]
        end
    end

    Browser -->|Static Assets| CF
    CF -->|/| S3
    CF -->|/api/*| Edge
    Edge -->|SigV4 Signed Request| LambdaURL
    LambdaURL -->|ConverseStreamCommand| Bedrock
    LambdaURL -->|Track Events| DynamoDB
```

### 主要コンポーネント

| コンポーネント | 役割 |
|---------------|------|
| **CloudFront** | CDN + Lambda@Edge でリクエストルーティング |
| **Lambda@Edge** | Lambda Function URL への SigV4 署名を付与 |
| **Lambda (RESPONSE_STREAM)** | Bedrock API 呼び出し + リアルタイムストリーミング |
| **Amazon Bedrock** | Claude Haiku 4.5 による翻訳・アイデア生成 |
| **DynamoDB** | アナリティクス（利用回数カウント） |

### ストリーミング実装のポイント

1. **Lambda Function URL**: `invokeMode: RESPONSE_STREAM` を有効化
2. **Lambda ハンドラー**: `awslambda.streamifyResponse()` でラップ
3. **Bedrock API**: `ConverseStreamCommand` でストリーミング取得
4. **フロントエンド**: `ReadableStream` API でチャンク単位で処理

## How to Deploy

### 前提条件

- Node.js 18+
- AWS CLI (認証設定済み)
- AWS CDK CLI (`npm install -g aws-cdk`)

### デプロイ手順

```bash
# 1. リポジトリをクローン
git clone <repository-url>
cd kiro-universe

# 2. CDK 依存関係をインストール
cd cdk
npm install

# 3. Lambda 依存関係をインストール
cd ../lambda/bedrock-translator
npm install
cd ../edge-signer
npm install

# 4. CDK デプロイ
cd ../../cdk
npm run cdk bootstrap  # 初回のみ
npm run cdk deploy

# 5. 出力された CloudFront URL にアクセス
```

### 環境変数（自動設定）

| 変数名 | 説明 |
|--------|------|
| `ANALYTICS_TABLE_NAME` | DynamoDB テーブル名 |
| `AWS_REGION` | Lambda 実行リージョン |

### Bedrock モデルアクセス

デプロイ前に、AWS コンソールで以下のモデルへのアクセスを有効化してください：

- `global.anthropic.claude-haiku-4-5-20251001-v1:0` (Cross-region inference profile)

## API Endpoints

| エンドポイント | メソッド | 説明 |
|---------------|----------|------|
| `/api/invoke` | POST | Bedrock モデル呼び出し（翻訳・生成） |
| `/api/track` | POST | アナリティクスイベント記録 |
| `/api/stats` | GET | アナリティクス統計取得 |

### リクエスト例

```bash
# 通常リクエスト
curl -X POST https://<domain>/api/invoke \
  -H "Content-Type: application/json" \
  -d '{"modelId":"global.anthropic.claude-haiku-4-5-20251001-v1:0","message":"Hello"}'

# ストリーミングリクエスト
curl -N -X POST https://<domain>/api/invoke \
  -H "Content-Type: application/json" \
  -d '{"modelId":"global.anthropic.claude-haiku-4-5-20251001-v1:0","message":"Hello","stream":true}'
```

## License

[Apache License 2.0](./LICENSE)
