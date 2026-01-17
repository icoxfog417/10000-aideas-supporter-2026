# CLAUDE.md - Project Guidelines for AI Assistants

## Project Overview

10000 AI Ideas Supporter - AWS Hackathon向けのアイデア生成・翻訳支援アプリケーション

## Prerequisites

### AWS CLI & CDK
- AWS CLI と AWS CDK がインストールされていない場合はインストールしてください
- 認証情報がない場合は、ユーザーにAWS認証情報をリクエストしてください

```bash
# AWS CLI インストール確認
aws --version

# CDK インストール確認
cdk --version

# 認証情報の設定
export AWS_ACCESS_KEY_ID="your-access-key"
export AWS_SECRET_ACCESS_KEY="your-secret-key"
export AWS_SESSION_TOKEN="your-session-token"  # 一時認証の場合
export AWS_REGION=us-east-1
```

## Architecture

```
frontend/          # 静的ウェブサイト (S3 + CloudFront)
├── app.js         # メインアプリケーションロジック
├── styles.css     # スタイルシート
└── index.html     # HTMLテンプレート

lambda/
├── bedrock-translator/   # Bedrock API プロキシ Lambda
└── edge-signer/          # CloudFront Edge Lambda

cdk/               # CDK インフラ定義
tests/             # テストスクリプト
```

## AI Suggestion Parsing

### 解析ロジック

AI生成結果は以下のセクションヘッダーで構造化されています：

```
プロジェクト名:
ビッグアイデア:
ビジョン:
インパクト:
実装計画:
使用AWSサービス:
```

### 重要: 行頭スペースの処理

AIの出力には行頭にスペースが含まれる場合があります。解析時には必ず `trim()` を使用してください：

```javascript
// Good - 堅牢な解析
const trimmedLine = line.trim();
if (trimmedLine.startsWith(header + ':') || trimmedLine.startsWith(header + '：')) {
    // セクション検出
}

// Bad - 行頭スペースで失敗する
if (line.startsWith(header + ':')) {
    // セクション検出 (行頭スペースがあると失敗)
}
```

### コロンの種類

半角 `:` と全角 `：` の両方に対応する必要があります。

## Data Flow

```
ストリーミング中:
  callBedrockAPIStreaming() → onChunk コールバック
       ├─→ suggestionContent.textContent += chunk  (画面表示)
       └─→ state.rawSuggestionText += chunk  (生テキスト保存)

ストリーミング完了後:
  formatSuggestionAsPressRelease(rawText) → HTML化 (見た目だけ変更)
  ★ state.rawSuggestionText は変更されない

「この提案を使う」クリック時:
  useSuggestion() → state.rawSuggestionText から解析 → フォームに転記
```

## Testing

### ユニットテスト（解析ロジック）

```bash
cd tests
npm install
npm test  # 4パターンのユニットテスト
```

### Bedrock統合テスト

実際のAI生成を行い、解析が正しく機能するか確認します：

```bash
cd tests
npm run test:bedrock  # AWS認証情報が必要
```

テストシナリオ:
1. ヘルスケア × 高齢者の健康管理
2. 教育 × プログラミング学習の効率化
3. ビジネス × 業務の自動化、コスト削減
4. エンターテイメント × コンテンツ作成の効率化

## Deployment

```bash
cd cdk
npm install
npx cdk deploy
```

## Styling

AI提案はプレスリリース風のスタイルで表示されます：

- **ヘッダー**: グラデーション背景 (紫→青紫) でプロジェクト名とビッグアイデア
- **Vision**: 紫アクセントのセクション
- **Impact**: 赤アクセントのセクション
- **Implementation Plan**: シアンアクセントのセクション
- **AWS Services**: オレンジのタグ形式

## Common Issues

### 解析エラー: セクションが空

原因: AI出力の形式がプロンプトと異なる場合
対策: プロンプトで形式を明示的に指定し、`trim()` で前後の空白を除去

### ネットワークエラー: EAI_AGAIN

原因: DNS解決失敗（サンドボックス環境など）
対策: 本番環境またはネットワークアクセス可能な環境で実行
