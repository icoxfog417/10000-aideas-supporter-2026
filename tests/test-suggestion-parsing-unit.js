/**
 * Unit tests for AI suggestion parsing
 *
 * Tests parsing logic with sample AI outputs that represent
 * various edge cases and real-world scenarios.
 *
 * Usage: node tests/test-suggestion-parsing-unit.js
 */

// Parsing function (same as app.js - with trim fix)
function parseSuggestionSections(text) {
    const sections = {};
    const sectionHeaders = ['プロジェクト名', 'ビッグアイデア', 'ビジョン', 'インパクト', '実装計画', '使用AWSサービス'];

    let currentSection = null;
    let currentContent = [];

    const lines = text.split('\n');

    for (const line of lines) {
        // Trim to handle leading spaces from AI output
        const trimmedLine = line.trim();
        let foundHeader = null;
        for (const header of sectionHeaders) {
            if (trimmedLine.startsWith(header + ':') || trimmedLine.startsWith(header + '：')) {
                foundHeader = header;
                break;
            }
        }

        if (foundHeader) {
            if (currentSection) {
                sections[currentSection] = currentContent.join('\n').trim();
            }
            currentSection = foundHeader;
            const afterHeader = trimmedLine.replace(new RegExp(`^${foundHeader}[:：]\\s*`), '').trim();
            currentContent = afterHeader ? [afterHeader] : [];
        } else if (currentSection) {
            currentContent.push(line);
        }
    }
    if (currentSection) {
        sections[currentSection] = currentContent.join('\n').trim();
    }

    return sections;
}

// Test case definitions
const testCases = [
    {
        name: 'Standard format with half-width colon',
        input: `プロジェクト名: AIヘルスケアアシスタント

ビッグアイデア:
「高齢者やその家族が日々の健康状態を把握したい時に、音声で簡単に記録・分析することができるサービス」

ビジョン:
ユーザーは毎日の体調を音声で入力します。Amazon Bedrockが自然言語を解析し、Nova Canvasで視覚的なレポートを生成します。

インパクト:
「いままでは健康記録を取るのにアプリに手入力しなければならなかったが、本プロジェクトの音声入力機能により話すだけで記録が可能になり、結果として継続率が大幅に向上する」

実装計画:
Sprint 1: 音声入力とBedrock連携を実装し動作確認。Sprint 2: レポート生成機能を追加しエンドツーエンドで動作。Sprint 3: UIを改善しユーザーテスト実施。

使用AWSサービス: Amazon Bedrock, Amazon Nova, Amazon Transcribe`,
    },
    {
        name: 'Format with full-width colon (：)',
        input: `プロジェクト名： AI学習コーチ

ビッグアイデア：
「プログラミング初学者が効率的に学習したい時に、パーソナライズされた学習プランを提供することができるサービス」

ビジョン：
ユーザーが学習目標を入力すると、Bedrockが最適な学習パスを生成し、Kiroで実際のコーディング練習環境を提供します。

インパクト：
「いままではプログラミングを学ぶのに自分で教材を探さなければならなかったが、本プロジェクトのAI学習機能により最適な教材が自動推薦され、結果として学習効率が3倍向上する」

実装計画：
Sprint 1: Bedrock連携と学習プラン生成を実装し動作確認。Sprint 2: Kiro連携でコード演習機能を追加。Sprint 3: 進捗追跡とフィードバック機能を実装。

使用AWSサービス： Amazon Bedrock, Kiro, Amazon DynamoDB`,
    },
    {
        name: 'Format with leading spaces (edge case)',
        input: `  プロジェクト名: スマートビジネスアナライザー

  ビッグアイデア:
「経営者が意思決定を迅速に行いたい時に、リアルタイムでビジネスインサイトを得ることができるサービス」

  ビジョン:
経営データをアップロードすると、Amazon BedrockのClaudeが分析し、Amazon Novaで視覚的なダッシュボードを自動生成します。

  インパクト:
「いままではビジネス分析を行うのに専門家に依頼しなければならなかったが、本プロジェクトのAI分析機能により即座にインサイトが得られ、結果として意思決定スピードが10倍速くなる」

  実装計画:
Sprint 1: データ取込とBedrock分析を実装。Sprint 2: Nova連携でダッシュボード生成。Sprint 3: アラート機能とレポート出力を追加。Sprint 4: セキュリティ強化とパフォーマンステスト。

  使用AWSサービス: Amazon Bedrock, Amazon Nova, Amazon S3, Amazon QuickSight`,
    },
    {
        name: 'Mixed format (some leading spaces, mixed colons)',
        input: `プロジェクト名: クリエイティブAIスタジオ

ビッグアイデア：
「コンテンツクリエイターが効率的に作品を作りたい時に、AIの力を借りて高品質なコンテンツを生成することができるサービス」

  ビジョン:
ユーザーがアイデアをテキストで入力すると、Amazon Nova Canvasが画像を生成し、Nova Reelが動画に変換します。Bedrockが全体の品質を監視し、改善提案を行います。

インパクト:
「いままではコンテンツを作るのに専門的なスキルと時間が必要だったが、本プロジェクトのAI生成機能によりアイデアだけで高品質なコンテンツが作成可能になり、結果として制作時間が90%削減される」

  実装計画:
Sprint 1: テキスト入力とNova Canvas連携を実装し動作確認。Sprint 2: Nova Reel連携で動画生成機能を追加しエンドツーエンドで動作。Sprint 3: 品質フィードバック機能を改善しユーザーテスト実施。

使用AWSサービス： Amazon Bedrock, Amazon Nova Canvas, Amazon Nova Reel, Amazon S3`,
    },
];

// Validate parsed sections
function validateParsedSections(sections, testName) {
    const requiredSections = ['プロジェクト名', 'ビッグアイデア', 'ビジョン', 'インパクト', '実装計画', '使用AWSサービス'];
    const errors = [];
    const warnings = [];

    for (const section of requiredSections) {
        if (!sections[section]) {
            errors.push(`Missing section: ${section}`);
        } else if (sections[section].length < 10) {
            warnings.push(`Section "${section}" is very short (${sections[section].length} chars)`);
        }
    }

    console.log(`\n${'─'.repeat(60)}`);
    console.log(`📋 Test: ${testName}`);
    console.log(`${'─'.repeat(60)}`);

    if (errors.length === 0) {
        console.log('✅ All sections parsed successfully!');
    } else {
        console.log('❌ Parsing errors found:');
        errors.forEach(e => console.log(`   - ${e}`));
    }

    if (warnings.length > 0) {
        console.log('⚠️  Warnings:');
        warnings.forEach(w => console.log(`   - ${w}`));
    }

    console.log('\nParsed sections:');
    for (const [key, value] of Object.entries(sections)) {
        const preview = value.substring(0, 60).replace(/\n/g, ' ');
        console.log(`  📌 ${key}: "${preview}${value.length > 60 ? '...' : ''}"`);
    }

    return errors.length === 0;
}

// Main test runner
function runTests() {
    console.log('🧪 AI Suggestion Parsing Unit Tests');
    console.log(`   Running ${testCases.length} test cases...\n`);

    let passCount = 0;
    let failCount = 0;

    for (const testCase of testCases) {
        const sections = parseSuggestionSections(testCase.input);
        const passed = validateParsedSections(sections, testCase.name);

        if (passed) {
            passCount++;
        } else {
            failCount++;
        }
    }

    console.log('\n' + '═'.repeat(60));
    console.log('📊 Final Results');
    console.log('═'.repeat(60));
    console.log(`✅ Passed: ${passCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log(`📈 Success Rate: ${((passCount / testCases.length) * 100).toFixed(1)}%`);

    if (failCount > 0) {
        console.log('\n⚠️  Some tests failed. Please review the parsing logic.');
        process.exit(1);
    } else {
        console.log('\n🎉 All tests passed! Parsing logic is working correctly.');
        process.exit(0);
    }
}

// Run tests
runTests();
