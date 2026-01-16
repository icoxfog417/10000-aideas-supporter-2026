/**
 * Test script for AI suggestion parsing
 *
 * This script calls Amazon Bedrock to generate AI suggestions
 * and verifies that the parsing logic correctly extracts all sections.
 *
 * Usage: node tests/test-suggestion-parsing.js
 *
 * Requires AWS credentials to be configured.
 */

const {
    BedrockRuntimeClient,
    ConverseCommand,
} = require("@aws-sdk/client-bedrock-runtime");

// Initialize Bedrock client
const bedrockClient = new BedrockRuntimeClient({
    region: process.env.AWS_REGION || "us-east-1",
});

// AI Idea Suggestion Prompt Template (same as app.js)
const ideaSuggestionPrompt = `You are an expert product manager helping generate innovative hackathon ideas using the Amazon Working Backwards methodology. Based on the selected categories and problems, create a compelling project idea for an AWS AI hackathon.

Selected categories: {categories}
Selected problems to solve: {problems}

=== Available AWS AI Services (use these in your idea) ===
- Amazon Bedrock: Fully managed service to access foundation models (Claude, Llama, etc.) via API
- Amazon Bedrock AgentCore: Managed infrastructure for deploying, scaling, and securing AI agents in production. Handles compute, memory, authentication, and observability automatically.
- Kiro: AI-powered IDE by AWS that uses "specs" (natural language requirements, design docs, task lists) to guide development. Combines AI code generation with structured specifications.
- Amazon Nova: AWS's own foundation model family offering text, image, and video generation capabilities with excellent cost-performance ratio
- Amazon SageMaker: Complete ML platform for building, training, and deploying custom machine learning models
- Strands Agents SDK: Open-source Python SDK for building AI agents. Simple model-agnostic approach with tools, conversation history, and agent loops.

Generate a creative, feasible hackathon project idea in Japanese. The idea should leverage these AWS AI services and be achievable within a hackathon timeframe.

CRITICAL RULES:
- Do NOT use bullet points (・, -, *) anywhere in your response
- Write in flowing paragraph style for all sections
- Be specific and concrete, not generic
- Actively incorporate the newer AWS AI services (AgentCore, Kiro, Nova, Strands) where appropriate

Output format (in Japanese, with these exact section headers):

プロジェクト名: [catchy and memorable project name]

ビッグアイデア:
[Follow this format exactly: 「○○な人が××したい時に、△△することができるサービス」- describe WHO the target user is, WHAT they want to do, and WHAT capability they gain]

ビジョン:
[Describe the functional flow: what the user inputs, what the system processes using which technology, and what output/result is returned. Write as connected sentences, not bullet points. Be specific about the user journey from input to output.]

インパクト:
[Follow this format: 「いままでは○○するのに××しなければならなかったが、本プロジェクトの■■機能により△△が可能になり、結果として□□という効果を発揮する」- contrast the old way vs the new way and the transformative impact]

実装計画:
[Create an agile sprint plan with 3-4 sprints. For each sprint, describe what working increment will be delivered. Format as: 「Sprint 1: ○○を実装し動作確認。Sprint 2: ○○機能を追加しエンドツーエンドで動作。Sprint 3: ○○を改善しユーザーテスト実施。」Write as connected text, not bullet points.]

使用AWSサービス: [comma-separated list of AWS services from the available services above]

Only output in this exact format, no other explanations or bullet points.`;

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

// Call Bedrock API
async function generateSuggestion(categories, problems) {
    const prompt = ideaSuggestionPrompt
        .replace('{categories}', categories)
        .replace('{problems}', problems);

    const messages = [
        {
            role: "user",
            content: [{ text: prompt }],
        },
    ];

    const command = new ConverseCommand({
        modelId: 'anthropic.claude-haiku-4-5-20251001-v1:0',
        messages: messages,
        inferenceConfig: {
            maxTokens: 2000,
            temperature: 0.7,
        },
    });

    const response = await bedrockClient.send(command);
    return response.output.message.content[0].text;
}

// Validate parsed sections
function validateParsedSections(sections, testNumber) {
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

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Test #${testNumber} Results`);
    console.log(`${'='.repeat(60)}`);

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
        const preview = value.substring(0, 50).replace(/\n/g, ' ');
        console.log(`  📌 ${key}: "${preview}${value.length > 50 ? '...' : ''}"`);
    }

    return errors.length === 0;
}

// Test scenarios
const testScenarios = [
    { categories: 'ヘルスケア', problems: '高齢者の健康管理' },
    { categories: '教育', problems: 'プログラミング学習の効率化' },
    { categories: 'ビジネス', problems: '業務の自動化、コスト削減' },
    { categories: 'エンターテイメント', problems: 'コンテンツ作成の効率化' },
];

// Main test runner
async function runTests() {
    console.log('🧪 Starting AI Suggestion Parsing Tests');
    console.log(`   Running ${testScenarios.length} test scenarios...\n`);

    let passCount = 0;
    let failCount = 0;

    for (let i = 0; i < testScenarios.length; i++) {
        const scenario = testScenarios[i];
        console.log(`\n🔄 Test #${i + 1}: Generating suggestion for "${scenario.categories}" / "${scenario.problems}"...`);

        try {
            const rawText = await generateSuggestion(scenario.categories, scenario.problems);

            // Log raw output for debugging
            console.log('\n--- Raw AI Output ---');
            console.log(rawText.substring(0, 500) + (rawText.length > 500 ? '...' : ''));
            console.log('--- End Raw Output ---');

            const sections = parseSuggestionSections(rawText);
            const passed = validateParsedSections(sections, i + 1);

            if (passed) {
                passCount++;
            } else {
                failCount++;
            }

            // Add delay to avoid rate limiting
            if (i < testScenarios.length - 1) {
                console.log('\n⏳ Waiting 2 seconds before next test...');
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        } catch (error) {
            console.log(`\n❌ Test #${i + 1} failed with error: ${error.message}`);
            failCount++;
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Final Results');
    console.log('='.repeat(60));
    console.log(`✅ Passed: ${passCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log(`📈 Success Rate: ${((passCount / testScenarios.length) * 100).toFixed(1)}%`);

    if (failCount > 0) {
        console.log('\n⚠️  Some tests failed. Please review the parsing logic or AI prompt.');
        process.exit(1);
    } else {
        console.log('\n🎉 All tests passed! Parsing logic is working correctly.');
        process.exit(0);
    }
}

// Run tests
runTests().catch(error => {
    console.error('Test runner error:', error);
    process.exit(1);
});
