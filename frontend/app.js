// ===== State Management =====
const state = {
    currentStep: 1,
    selectedCategories: [],
    selectedProblems: [],
    selectedAiServices: [],
    selectedOtherServices: [],
    selectedModel: 'global.anthropic.claude-haiku-4-5-20251001-v1:0', // Default model - Claude Haiku 4.5 inference profile
    formData: {
        teamName: '',
        bigIdea: '',
        vision: '',
        impact: '',
        gamePlan: ''
    },
    translatedData: {}
};

// ===== Kiro Messages =====
const kiroMessages = {
    step1: [
        '一緒にアイデアを形にしよう！',
        'どんなアイデアも大歓迎だよ！',
        'ワクワクするアイデアを教えて！',
        'AIにアイデア提案してもらおう！'
    ],
    step2: [
        '詳しく教えてくれると嬉しいな！',
        '日本語でOKだよ！',
        'いい感じ！続けて！',
        '翻訳はお任せあれ！'
    ],
    step3: [
        'お疲れ様！素敵なアイデアだね！',
        '完璧！あとは応募するだけ！',
        'コンテスト頑張ってね！'
    ],
    models: {
        claude: 'Claudeで翻訳するよ！自然な英語にするね！',
        nova: 'Nova選んだね！超高速で翻訳するよ！',
        titan: 'Titan選んだね！AWS純正パワーで翻訳！',
        llama: 'Llama選んだね！オープンソースの力！',
        mistral: 'Mistral選んだね！欧州の技術で翻訳！'
    }
};

// ===== AI Idea Suggestion Prompt Template (Working Backwards Style) =====
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

// ===== Translation Prompt Template =====
const translationPrompt = `You are a professional translator specializing in tech startup pitches and AWS hackathon submissions. Your task is to translate the following content from the source language to natural, professional English suitable for a tech competition submission.

IMPORTANT GUIDELINES:
1. Maintain the original meaning and enthusiasm
2. Use professional but accessible language
3. Keep technical terms accurate (especially AWS service names)
4. Make it sound natural to native English speakers
5. Ensure the tone is confident and compelling
6. Do NOT add any explanations or notes - only output the translation
7. Preserve bullet points and formatting if present
8. Keep it concise and within the character limit specified

Character limit for this field: {charLimit} characters

Content to translate:
{content}

Translated English (only output the translation, nothing else):`;

// ===== Category-specific Problems (2025-2026 Trends) =====
const categoryProblems = {
    'workplace-efficiency': [
        { id: 'meeting-notes', label: '📝 議事録・会議要約の自動化' },
        { id: 'ai-agent', label: '🤖 AIエージェントによるタスク自動化' },
        { id: 'knowledge-search', label: '🔍 社内ナレッジの検索・要約' },
        { id: 'code-assist', label: '💻 コード生成・レビュー支援' },
        { id: 'doc-creation', label: '📄 ドキュメント・メール自動作成' },
        { id: 'schedule-opt', label: '📅 スケジュール・会議最適化' },
        { id: 'project-mgmt', label: '📊 プロジェクト管理の効率化' },
        { id: 'customer-support', label: '💬 カスタマーサポート自動化' },
        { id: 'data-report', label: '📈 データ分析・レポート生成' },
        { id: 'multilang-comm', label: '🌐 多言語コミュニケーション' },
    ],
    'daily-life': [
        { id: 'personal-ai', label: '🎯 パーソナルAIアシスタント' },
        { id: 'health-fitness', label: '💪 健康管理・フィットネス' },
        { id: 'finance-advice', label: '💰 家計管理・資産運用' },
        { id: 'recipe-meal', label: '🍳 料理レシピ・献立提案' },
        { id: 'learning-skill', label: '📚 学習・スキルアップ支援' },
        { id: 'travel-guide', label: '✈️ 旅行計画・観光ガイド' },
        { id: 'smart-home', label: '🏠 スマートホーム連携' },
        { id: 'mental-health', label: '🧘 メンタルヘルスケア' },
        { id: 'childcare', label: '👶 子育て・育児支援' },
        { id: 'elderly-care', label: '👴 高齢者見守り・介護' },
    ],
    'commercial': [
        { id: 'ec-personalize', label: '🛒 ECパーソナライズ' },
        { id: 'demand-forecast', label: '📦 需要予測・在庫最適化' },
        { id: 'marketing-auto', label: '📣 マーケティング自動化' },
        { id: 'dynamic-pricing', label: '💲 動的価格設定' },
        { id: 'fraud-detect', label: '🔒 不正検知・セキュリティ' },
        { id: 'supply-chain', label: '🚚 サプライチェーン最適化' },
        { id: 'recommendation', label: '⭐ レコメンデーション' },
        { id: 'chatbot-sales', label: '🤝 チャットボット接客' },
        { id: 'ad-optimize', label: '📱 広告・コンテンツ最適化' },
        { id: 'contract-legal', label: '📋 契約書・法務文書分析' },
    ],
    'social-impact': [
        { id: 'disaster-prevention', label: '🌊 災害予測・防災支援' },
        { id: 'environment', label: '🌱 環境モニタリング・気候変動' },
        { id: 'medical-diagnosis', label: '🏥 医療診断支援' },
        { id: 'education-gap', label: '📖 教育格差の解消' },
        { id: 'accessibility', label: '♿ アクセシビリティ向上' },
        { id: 'agriculture', label: '🌾 農業・食料問題' },
        { id: 'mobility', label: '🚗 交通・移動の最適化' },
        { id: 'energy', label: '⚡ エネルギー効率化' },
        { id: 'local-community', label: '🏘️ 地域活性化・まちづくり' },
        { id: 'multicultural', label: '🤝 多文化共生・言語バリアフリー' },
    ],
    'creative': [
        { id: 'image-video', label: '🖼️ AI画像・動画生成' },
        { id: 'music-sound', label: '🎵 音楽・サウンド制作' },
        { id: 'storytelling', label: '📖 ストーリーテリング・脚本' },
        { id: 'game-interactive', label: '🎮 ゲーム・インタラクティブ' },
        { id: 'virtual-influencer', label: '👤 バーチャルインフルエンサー' },
        { id: '3d-metaverse', label: '🌐 3Dモデリング・メタバース' },
        { id: 'fashion-design', label: '👗 ファッション・デザイン' },
        { id: 'architecture', label: '🏛️ 建築・インテリアデザイン' },
        { id: 'art-nft', label: '🎨 アート・NFT制作' },
        { id: 'personalized-content', label: '✨ パーソナライズドコンテンツ' },
    ],
};

// ===== Initialize =====
document.addEventListener('DOMContentLoaded', () => {
    initializeChips();
    initializeTextareas();
    initializeModelSelector();
    updateKiroMessage();
});

// ===== Model Selector =====
function initializeModelSelector() {
    const modelSelector = document.getElementById('model-selector');
    if (!modelSelector) return;

    modelSelector.querySelectorAll('.model-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            modelSelector.querySelectorAll('.model-chip').forEach(c => c.classList.remove('selected'));
            chip.classList.add('selected');
            state.selectedModel = chip.dataset.model;
            updateKiroMood(chip.dataset.mood);
        });
    });
}

function updateKiroMood(mood) {
    const kiroIcons = document.querySelectorAll('.kiro-icon');

    kiroIcons.forEach(icon => {
        icon.classList.remove('mood-claude', 'mood-nova', 'mood-titan', 'mood-llama', 'mood-mistral');
        icon.classList.add(`mood-${mood}`);
    });

    const messageElement = document.getElementById('kiro-message');
    if (messageElement && kiroMessages.models[mood]) {
        messageElement.textContent = kiroMessages.models[mood];
    }
}

// ===== Chip Selection =====
function initializeChips() {
    // Category chips - single selection
    document.querySelectorAll('.category-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            // Deselect all other categories
            document.querySelectorAll('.category-chip').forEach(c => c.classList.remove('selected'));
            chip.classList.add('selected');

            const category = chip.dataset.category;
            state.selectedCategories = [category];
            state.selectedProblems = []; // Reset problems when category changes

            // Update problems based on selected category
            updateProblemsForCategory(category);
        });
    });

    // Service chips
    document.querySelectorAll('.service-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            chip.classList.toggle('selected');
            const service = chip.dataset.service;
            const isOther = chip.classList.contains('other-service');

            if (chip.classList.contains('selected')) {
                if (isOther) {
                    state.selectedOtherServices.push(service);
                } else {
                    state.selectedAiServices.push(service);
                }
            } else {
                if (isOther) {
                    state.selectedOtherServices = state.selectedOtherServices.filter(s => s !== service);
                } else {
                    state.selectedAiServices = state.selectedAiServices.filter(s => s !== service);
                }
            }
        });
    });
}

// ===== Update Problems Based on Category =====
function updateProblemsForCategory(category) {
    const problemChips = document.getElementById('problem-chips');
    const problemHint = document.getElementById('problem-hint');

    if (!problemChips) return;

    // Clear existing problems
    problemChips.innerHTML = '';
    state.selectedProblems = [];

    // Get problems for this category
    const problems = categoryProblems[category] || [];

    if (problems.length === 0) {
        problemHint.textContent = 'このカテゴリの課題はありません';
        problemHint.classList.remove('hidden');
        return;
    }

    // Hide hint
    problemHint.classList.add('hidden');

    // Create problem chips
    problems.forEach(problem => {
        const chip = document.createElement('button');
        chip.className = 'chip problem-chip';
        chip.dataset.problem = problem.id;
        chip.textContent = problem.label;
        chip.addEventListener('click', () => {
            chip.classList.toggle('selected');
            if (chip.classList.contains('selected')) {
                state.selectedProblems.push(problem.label);
            } else {
                state.selectedProblems = state.selectedProblems.filter(p => p !== problem.label);
            }
        });
        problemChips.appendChild(chip);
    });

    // Add custom input option
    const customChip = document.createElement('button');
    customChip.className = 'chip problem-chip';
    customChip.dataset.problem = 'custom';
    customChip.textContent = '✏️ 自分で入力';
    customChip.addEventListener('click', () => {
        customChip.classList.toggle('selected');
        document.getElementById('custom-problem').classList.toggle('hidden');
    });
    problemChips.appendChild(customChip);
}

// ===== Textarea Handling =====
function initializeTextareas() {
    const textareas = ['team-name', 'big-idea', 'vision', 'impact', 'game-plan'];

    textareas.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('input', () => {
                updateCharCount(id);
                const key = id.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
                state.formData[key] = element.value;
            });
        }
    });
}

function updateCharCount(id) {
    const element = document.getElementById(id);
    const countElement = document.getElementById(`${id}-count`);

    if (element && countElement) {
        const count = element.value.length;
        countElement.textContent = count;

        const parent = countElement.parentElement;
        const maxLength = parseInt(element.getAttribute('maxlength')) || 0;

        if (count > maxLength * 0.9) {
            parent.classList.add('warning');
        } else {
            parent.classList.remove('warning');
        }

        if (count >= maxLength) {
            parent.classList.add('error');
        } else {
            parent.classList.remove('error');
        }
    }
}

// ===== Navigation =====
function goToStep(step) {
    // Max 3 steps now
    if (step < 1 || step > 3) return;

    if (step > state.currentStep && !validateCurrentStep()) {
        return;
    }

    document.querySelectorAll('.step').forEach((stepEl, index) => {
        stepEl.classList.remove('active', 'completed');
        if (index + 1 < step) {
            stepEl.classList.add('completed');
        } else if (index + 1 === step) {
            stepEl.classList.add('active');
        }
    });

    document.querySelectorAll('.form-section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(`step${step}`).classList.add('active');

    state.currentStep = step;
    updateKiroMessage();

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function validateCurrentStep() {
    if (state.currentStep === 2) {
        const bigIdea = document.getElementById('big-idea').value.trim();
        if (!bigIdea) {
            showToast('ビッグアイデアを入力してください', 'error');
            return false;
        }
    }
    return true;
}

function updateKiroMessage() {
    const messageElement = document.getElementById('kiro-message');
    const messages = kiroMessages[`step${state.currentStep}`];
    if (messageElement && messages) {
        const randomMessage = messages[Math.floor(Math.random() * messages.length)];
        messageElement.textContent = randomMessage;
    }
}

// ===== AI Idea Suggestion =====
async function generateAiSuggestion() {
    const suggestionBtn = document.getElementById('ai-suggest-btn');
    const suggestionResult = document.getElementById('ai-suggestion-result');
    const suggestionContent = document.getElementById('ai-suggestion-content');

    if (!suggestionBtn || !suggestionResult || !suggestionContent) {
        showToast('AI提案機能が利用できません', 'error');
        return;
    }

    // Get selected categories and problems
    const categories = state.selectedCategories.length > 0
        ? state.selectedCategories.join(', ')
        : '未選択';
    const problems = state.selectedProblems.length > 0
        ? state.selectedProblems.join(', ')
        : '未選択';

    // Show loading state
    suggestionBtn.disabled = true;
    suggestionBtn.innerHTML = '<span class="btn-loading">⏳ 生成中...</span>';

    try {
        const prompt = ideaSuggestionPrompt
            .replace('{categories}', categories)
            .replace('{problems}', problems);

        const suggestion = await callBedrockAPI(prompt);

        suggestionContent.textContent = suggestion;
        suggestionResult.classList.remove('hidden');
        showToast('アイデアを生成しました！');

    } catch (error) {
        console.error('AI suggestion error:', error);
        showToast(`アイデア生成エラー: ${error.message}`, 'error');
    } finally {
        suggestionBtn.disabled = false;
        suggestionBtn.innerHTML = '✨ AIでアイデアを生成';
    }
}

function useSuggestion() {
    const suggestionContent = document.getElementById('ai-suggestion-content');
    if (!suggestionContent) return;

    const suggestion = suggestionContent.textContent;

    // Parse the Working Backwards format suggestion
    // Section headers: プロジェクト名, ビッグアイデア, ビジョン, インパクト, 実装計画, 使用AWSサービス
    const sections = {};
    const sectionHeaders = ['プロジェクト名', 'ビッグアイデア', 'ビジョン', 'インパクト', '実装計画', '使用AWSサービス'];

    let currentSection = null;
    let currentContent = [];

    const lines = suggestion.split('\n');

    for (const line of lines) {
        // Check if this line starts a new section
        let foundHeader = null;
        for (const header of sectionHeaders) {
            if (line.startsWith(header + ':') || line.startsWith(header + '：')) {
                foundHeader = header;
                break;
            }
        }

        if (foundHeader) {
            // Save previous section content
            if (currentSection) {
                sections[currentSection] = currentContent.join('\n').trim();
            }
            // Start new section
            currentSection = foundHeader;
            // Get content after the header on the same line
            const afterHeader = line.replace(new RegExp(`^${foundHeader}[:：]\\s*`), '').trim();
            currentContent = afterHeader ? [afterHeader] : [];
        } else if (currentSection) {
            // Add line to current section
            currentContent.push(line);
        }
    }
    // Save last section
    if (currentSection) {
        sections[currentSection] = currentContent.join('\n').trim();
    }

    // Fill form fields with parsed sections
    const fieldMappings = [
        { section: 'ビッグアイデア', elementId: 'big-idea', stateKey: 'bigIdea' },
        { section: 'ビジョン', elementId: 'vision', stateKey: 'vision' },
        { section: 'インパクト', elementId: 'impact', stateKey: 'impact' },
        { section: '実装計画', elementId: 'game-plan', stateKey: 'gamePlan' }
    ];

    for (const mapping of fieldMappings) {
        const content = sections[mapping.section];
        if (content) {
            const element = document.getElementById(mapping.elementId);
            if (element) {
                element.value = content;
                updateCharCount(mapping.elementId);
                state.formData[mapping.stateKey] = content;
            }
        }
    }

    // Auto-fill team name with project name if available
    if (sections['プロジェクト名']) {
        const teamNameEl = document.getElementById('team-name');
        if (teamNameEl) {
            teamNameEl.value = sections['プロジェクト名'];
            updateCharCount('team-name');
            state.formData.teamName = sections['プロジェクト名'];
        }
    }

    // Auto-select AWS services if available
    if (sections['使用AWSサービス']) {
        const awsServices = sections['使用AWSサービス'].split(/[,、]/).map(s => s.trim());
        // Select matching service chips
        document.querySelectorAll('.service-chip').forEach(chip => {
            const serviceName = chip.dataset.service;
            if (awsServices.some(s => s.includes(serviceName) || serviceName.includes(s))) {
                if (!chip.classList.contains('selected')) {
                    chip.click(); // This will also update the state
                }
            }
        });
    }

    showToast('アイデアをフォームに反映しました！Step 2で編集してね！');
    goToStep(2);
}

// ===== Translation =====
async function translateAndComplete() {
    const translateBtn = document.getElementById('translate-btn');
    const btnText = translateBtn?.querySelector('.btn-text');
    const btnLoading = translateBtn?.querySelector('.btn-loading');

    if (translateBtn) {
        if (btnText) btnText.classList.add('hidden');
        if (btnLoading) btnLoading.classList.remove('hidden');
        translateBtn.disabled = true;
    }

    try {
        const fields = [
            { key: 'teamName', elementId: 'team-name', limit: 100 },
            { key: 'bigIdea', elementId: 'big-idea', limit: 500 },
            { key: 'vision', elementId: 'vision', limit: 1000 },
            { key: 'impact', elementId: 'impact', limit: 1000 },
            { key: 'gamePlan', elementId: 'game-plan', limit: 1500 }
        ];

        for (const field of fields) {
            const content = document.getElementById(field.elementId)?.value?.trim();
            if (content) {
                const translated = await translateText(content, field.limit);
                state.translatedData[field.key] = translated;
            }
        }

        state.translatedData.aiServices = state.selectedAiServices.join(', ');
        state.translatedData.otherServices = state.selectedOtherServices.join(', ');

        updateResults();
        goToStep(3);
        showToast('翻訳完了！');

    } catch (error) {
        console.error('Translation error:', error);
        showToast(`翻訳エラー: ${error.message}`, 'error');
    } finally {
        if (translateBtn) {
            if (btnText) btnText.classList.remove('hidden');
            if (btnLoading) btnLoading.classList.add('hidden');
            translateBtn.disabled = false;
        }
    }
}

// Keep translateAll as alias for backward compatibility
async function translateAll() {
    return translateAndComplete();
}

async function translateText(content, charLimit) {
    const prompt = translationPrompt
        .replace('{charLimit}', charLimit)
        .replace('{content}', content);

    return await callBedrockAPI(prompt);
}

async function callBedrockAPI(prompt) {
    const config = window.APP_CONFIG || {};
    const modelId = state.selectedModel;

    // Check if using CloudFront API endpoint (Lambda@Edge handles SigV4)
    if (config.apiEndpoint) {
        const payload = {
            modelId: modelId,
            message: prompt
        };

        try {
            const response = await fetch(config.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data.output) {
                return data.output;
            } else if (data.content && data.content[0]) {
                return data.content[0].text;
            } else if (data.message) {
                return data.message;
            } else if (typeof data === 'string') {
                return data;
            }

            throw new Error('Unexpected response format from API');
        } catch (error) {
            if (error.message.includes('403')) {
                throw new Error('認証エラー: Lambda@Edge署名に問題がある可能性があります。');
            } else if (error.message.includes('404')) {
                throw new Error('APIエンドポイントが見つかりません。');
            }
            throw error;
        }
    }

    // Fallback: Use direct Lambda Function URL with SigV4 (for local testing)
    const lambdaFunctionUrl = document.getElementById('lambda-function-url')?.value?.trim();
    const region = document.getElementById('bedrock-region')?.value;
    const accessKeyId = document.getElementById('aws-access-key')?.value?.trim();
    const secretAccessKey = document.getElementById('aws-secret-key')?.value?.trim();
    const sessionToken = document.getElementById('aws-session-token')?.value?.trim() || null;

    const client = new BedrockLambdaClient({
        functionUrl: lambdaFunctionUrl,
        region: region,
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey,
        sessionToken: sessionToken
    });

    const payload = {
        modelId: modelId,
        message: prompt
    };

    try {
        const response = await client.invoke(payload);

        if (response.output) {
            return response.output;
        } else if (response.content && response.content[0]) {
            return response.content[0].text;
        } else if (response.message) {
            return response.message;
        } else if (typeof response === 'string') {
            return response;
        }

        throw new Error('Unexpected response format from Lambda');
    } catch (error) {
        if (error.message.includes('403')) {
            throw new Error('認証エラー: AWS認証情報を確認してください。');
        } else if (error.message.includes('404')) {
            throw new Error('Lambda Function URLが見つかりません。');
        } else if (error.message.includes('CORS')) {
            throw new Error('CORSエラー: CORS設定を確認してください。');
        }
        throw error;
    }
}

// ===== Results =====
function updateResults() {
    document.getElementById('result-team-name').textContent = state.translatedData.teamName || '-';

    const bigIdea = state.translatedData.bigIdea || '-';
    document.getElementById('result-big-idea').textContent = bigIdea;
    document.getElementById('big-idea-chars').textContent = bigIdea.length;
    updateCharIndicator('big-idea-chars', bigIdea.length, 500);

    const vision = state.translatedData.vision || '-';
    document.getElementById('result-vision').textContent = vision;
    document.getElementById('vision-chars').textContent = vision.length;
    updateCharIndicator('vision-chars', vision.length, 1000);

    const impact = state.translatedData.impact || '-';
    document.getElementById('result-impact').textContent = impact;
    document.getElementById('impact-chars').textContent = impact.length;
    updateCharIndicator('impact-chars', impact.length, 1000);

    const gamePlan = state.translatedData.gamePlan || '-';
    document.getElementById('result-game-plan').textContent = gamePlan;
    document.getElementById('game-plan-chars').textContent = gamePlan.length;
    updateCharIndicator('game-plan-chars', gamePlan.length, 1500);

    document.getElementById('result-ai-services').textContent = state.translatedData.aiServices || '-';
    document.getElementById('result-other-services').textContent = state.translatedData.otherServices || '-';
}

function updateCharIndicator(elementId, count, limit) {
    const element = document.getElementById(elementId);
    const parent = element.parentElement;

    parent.classList.remove('warning', 'error');

    if (count > limit) {
        parent.classList.add('error');
    } else if (count > limit * 0.9) {
        parent.classList.add('warning');
    }
}

// ===== Copy Functions =====
function copyToClipboard(elementId) {
    const element = document.getElementById(elementId);
    const text = element.textContent;

    navigator.clipboard.writeText(text).then(() => {
        const btn = element.parentElement.querySelector('.copy-btn');
        btn.textContent = '✓ コピー完了';
        btn.classList.add('copied');

        setTimeout(() => {
            btn.textContent = '📋 コピー';
            btn.classList.remove('copied');
        }, 2000);
    }).catch(err => {
        showToast('コピーに失敗しました', 'error');
    });
}

function copyAllResults() {
    const results = {
        'Team Name': state.translatedData.teamName,
        'Big Idea': state.translatedData.bigIdea,
        'Vision': state.translatedData.vision,
        'Impact': state.translatedData.impact,
        'Game Plan': state.translatedData.gamePlan,
        'AWS AI Services': state.translatedData.aiServices,
        'Other AWS Services': state.translatedData.otherServices
    };

    const text = Object.entries(results)
        .map(([key, value]) => `=== ${key} ===\n${value || '-'}`)
        .join('\n\n');

    navigator.clipboard.writeText(text).then(() => {
        showToast('すべての内容をコピーしました！');
    }).catch(err => {
        showToast('コピーに失敗しました', 'error');
    });
}

// ===== Toast Notification =====
function showToast(message, type = 'success') {
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
        existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 10);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
