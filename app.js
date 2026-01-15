// ===== State Management =====
const state = {
    currentStep: 1,
    selectedCategories: [],
    selectedProblems: [],
    selectedTemplate: null,
    selectedAiServices: [],
    selectedOtherServices: [],
    selectedModel: 'claude-3-5-haiku-20241022', // Default model
    formData: {
        teamName: '',
        bigIdea: '',
        vision: '',
        impact: '',
        gamePlan: ''
    },
    translatedData: {}
};

// ===== Model Configuration =====
const modelConfig = {
    anthropic: {
        models: [
            { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', desc: '高速・低コスト', mood: 'claude' }
        ],
        default: 'claude-3-5-haiku-20241022'
    },
    openai: {
        models: [
            { id: 'gpt-4o-mini', name: 'GPT-4o-mini', desc: '高速・低コスト', mood: 'claude' }
        ],
        default: 'gpt-4o-mini'
    },
    bedrock: {
        models: [
            { id: 'anthropic.claude-3-5-haiku-20241022-v1:0', name: 'Claude 3.5 Haiku', desc: '高速・低コスト', mood: 'claude' },
            { id: 'amazon.nova-lite-v1:0', name: 'Amazon Nova Lite', desc: '超高速・最安', mood: 'nova' },
            { id: 'amazon.nova-pro-v1:0', name: 'Amazon Nova Pro', desc: 'バランス型', mood: 'nova' },
            { id: 'amazon.titan-text-lite-v1', name: 'Amazon Titan Lite', desc: 'AWS純正', mood: 'titan' },
            { id: 'meta.llama3-8b-instruct-v1:0', name: 'Llama 3 8B', desc: 'オープンソース', mood: 'llama' },
            { id: 'mistral.mistral-7b-instruct-v0:2', name: 'Mistral 7B', desc: '欧州産', mood: 'mistral' }
        ],
        default: 'amazon.nova-lite-v1:0'
    }
};

// ===== Kiro Messages =====
const kiroMessages = {
    step1: [
        '一緒にアイデアを形にしよう！',
        'どんなアイデアも大歓迎だよ！',
        'ワクワクするアイデアを教えて！'
    ],
    step2: [
        '詳しく教えてくれると嬉しいな！',
        '日本語でOKだよ！',
        'いい感じ！続けて！'
    ],
    step3: [
        '翻訳の準備はバッチリ？',
        'APIキーを入れてね！',
        '英語に変身させるよ！'
    ],
    step4: [
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

// ===== Initialize =====
document.addEventListener('DOMContentLoaded', () => {
    initializeChips();
    initializeTemplates();
    initializeTextareas();
    initializeApiSettings();
    updateKiroMessage();
});

// ===== Chip Selection =====
function initializeChips() {
    // Category chips
    document.querySelectorAll('.category-chips .chip').forEach(chip => {
        chip.addEventListener('click', () => {
            chip.classList.toggle('selected');
            const category = chip.dataset.category;
            if (chip.classList.contains('selected')) {
                state.selectedCategories.push(category);
            } else {
                state.selectedCategories = state.selectedCategories.filter(c => c !== category);
            }
            updateProblemChips();
        });
    });

    // Problem chips
    document.querySelectorAll('.problem-chips .chip').forEach(chip => {
        chip.addEventListener('click', () => {
            if (chip.dataset.problem === 'custom') {
                document.getElementById('custom-problem').classList.toggle('hidden');
                chip.classList.toggle('selected');
                return;
            }
            chip.classList.toggle('selected');
            const problem = chip.dataset.problem;
            if (chip.classList.contains('selected')) {
                state.selectedProblems.push(problem);
            } else {
                state.selectedProblems = state.selectedProblems.filter(p => p !== problem);
            }
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

// ===== Template Selection =====
function initializeTemplates() {
    document.querySelectorAll('.template-card').forEach(card => {
        card.addEventListener('click', () => {
            document.querySelectorAll('.template-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            state.selectedTemplate = card.dataset.template;

            // Auto-fill based on template
            applyTemplate(state.selectedTemplate);
        });
    });
}

function applyTemplate(templateId) {
    const templates = {
        translator: {
            bigIdea: 'AIを活用したリアルタイム翻訳ツールで、言語の壁を越えたコミュニケーションを実現します。誰でも簡単に多言語でのコラボレーションができるようになります。',
            vision: '・リアルタイム音声/テキスト翻訳\n・100以上の言語に対応\n・文脈を理解したAI翻訳で自然な表現\n・シンプルで直感的なUI\n・API連携で既存システムに統合可能',
            impact: '・言語の壁で困っている旅行者や留学生\n・多国籍チームで働くビジネスパーソン\n・外国語学習中の学生\nコミュニケーションの障壁をなくし、世界中の人々がより簡単につながれるようになります。',
            gamePlan: 'フェーズ1: Amazon Transcribeで音声認識の実装\nフェーズ2: Amazon Bedrockで文脈理解と翻訳処理\nフェーズ3: Amazon Pollyで音声合成\nフェーズ4: React/Next.jsでフロントエンド構築\nフェーズ5: AWS Amplifyでデプロイ\nフェーズ6: ユーザーテストとフィードバック収集'
        },
        assistant: {
            bigIdea: '特定業務に特化したAIアシスタントで、日々の作業を効率化します。自然な対話で複雑なタスクをシンプルにこなせるようになります。',
            vision: '・自然言語での対話インターフェース\n・業務コンテキストの理解と記憶\n・ドキュメント検索と要約機能\n・タスクの自動化と提案\n・セキュアなデータ管理',
            impact: '・繰り返し作業に時間を取られている社員\n・情報検索に時間がかかっているチーム\n・新入社員のオンボーディング支援\n生産性の向上と、より創造的な仕事への集中を実現します。',
            gamePlan: 'フェーズ1: Amazon Bedrockで対話エンジン構築\nフェーズ2: Amazon Kendraでナレッジベース構築\nフェーズ3: AWS Lambdaでバックエンド処理\nフェーズ4: Amazon DynamoDBでデータ管理\nフェーズ5: フロントエンドUI開発\nフェーズ6: テストと改善'
        },
        analyzer: {
            bigIdea: 'AIでデータ分析を民主化し、誰でも簡単にインサイトを得られるツールを作ります。専門知識がなくても、自然言語で質問するだけでデータを理解できます。',
            vision: '・自然言語でのデータクエリ\n・自動的なグラフ・チャート生成\n・トレンド分析と予測機能\n・レポート自動生成\n・複数データソースの統合',
            impact: '・データ分析スキルを持たないビジネスユーザー\n・意思決定に時間がかかっている経営者\n・レポート作成に追われるアナリスト\nデータドリブンな意思決定を、すべての人に開放します。',
            gamePlan: 'フェーズ1: Amazon Bedrockで自然言語処理\nフェーズ2: Amazon Athenaでデータクエリ\nフェーズ3: Amazon QuickSightで可視化\nフェーズ4: AWS Glueでデータ統合\nフェーズ5: ダッシュボードUI開発\nフェーズ6: セキュリティとアクセス管理'
        },
        generator: {
            bigIdea: 'AIを活用したコンテンツ生成ツールで、クリエイティブな作業を加速します。アイデアから完成品まで、AIがサポートします。',
            vision: '・テキスト/画像/コードの生成\n・ブランドガイドラインに沿った出力\n・複数バリエーションの提案\n・編集・微調整機能\n・チームコラボレーション',
            impact: '・コンテンツ制作に時間がかかっているマーケター\n・クリエイティブなアイデアに行き詰まっているデザイナー\n・効率化を求める開発チーム\n創造性を解放し、より価値の高い仕事に集中できます。',
            gamePlan: 'フェーズ1: Amazon Bedrockでテキスト生成\nフェーズ2: Amazon Titan Imageで画像生成\nフェーズ3: プロンプトテンプレート管理\nフェーズ4: バージョン管理とコラボ機能\nフェーズ5: フロントエンド開発\nフェーズ6: ワークフロー統合'
        }
    };

    if (templates[templateId]) {
        const template = templates[templateId];
        document.getElementById('big-idea').value = template.bigIdea;
        document.getElementById('vision').value = template.vision;
        document.getElementById('impact').value = template.impact;
        document.getElementById('game-plan').value = template.gamePlan;

        // Update character counts
        updateCharCount('big-idea');
        updateCharCount('vision');
        updateCharCount('impact');
        updateCharCount('game-plan');

        // Store in state
        state.formData.bigIdea = template.bigIdea;
        state.formData.vision = template.vision;
        state.formData.impact = template.impact;
        state.formData.gamePlan = template.gamePlan;
    }
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

        // Visual feedback for character limits
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

// ===== API Settings =====
function initializeApiSettings() {
    const providerSelect = document.getElementById('api-provider');

    providerSelect.addEventListener('change', () => {
        const provider = providerSelect.value;
        const bedrockSettings = document.querySelector('.bedrock-settings');

        if (provider === 'bedrock') {
            bedrockSettings.classList.remove('hidden');
            renderModelSelector();
        } else {
            bedrockSettings.classList.add('hidden');
            // Set default model for non-Bedrock providers
            state.selectedModel = modelConfig[provider].default;
        }

        // Update Kiro's mood based on provider
        updateKiroMood(provider);
    });
}

function renderModelSelector() {
    const bedrockSettings = document.querySelector('.bedrock-settings');

    // Check if model selector already exists
    let modelSelector = bedrockSettings.querySelector('.model-selector-container');
    if (modelSelector) {
        modelSelector.remove();
    }

    // Create model selector
    modelSelector = document.createElement('div');
    modelSelector.className = 'model-selector-container';
    modelSelector.innerHTML = `
        <label>モデルを選択</label>
        <div class="model-selector">
            ${modelConfig.bedrock.models.map(model => `
                <button class="model-chip ${state.selectedModel === model.id ? 'selected' : ''}"
                        data-model="${model.id}" data-mood="${model.mood}">
                    <span class="model-name">${model.name}</span>
                    <span class="model-desc">${model.desc}</span>
                </button>
            `).join('')}
        </div>
    `;

    bedrockSettings.appendChild(modelSelector);

    // Add click handlers
    modelSelector.querySelectorAll('.model-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            modelSelector.querySelectorAll('.model-chip').forEach(c => c.classList.remove('selected'));
            chip.classList.add('selected');
            state.selectedModel = chip.dataset.model;

            // Update Kiro's mood based on model
            updateKiroMood('bedrock', chip.dataset.mood);
        });
    });
}

function updateKiroMood(provider, mood = null) {
    const kiroIcons = document.querySelectorAll('.kiro-icon');

    // Determine mood based on provider or specific mood
    let finalMood = mood;
    if (!finalMood) {
        if (provider === 'anthropic' || provider === 'openai') {
            finalMood = 'claude';
        } else if (provider === 'bedrock') {
            // Get mood from selected model
            const selectedModel = modelConfig.bedrock.models.find(m => m.id === state.selectedModel);
            finalMood = selectedModel ? selectedModel.mood : 'nova';
        }
    }

    // Remove all mood classes and add new one
    kiroIcons.forEach(icon => {
        icon.classList.remove('mood-claude', 'mood-nova', 'mood-titan', 'mood-llama', 'mood-mistral');
        icon.classList.add(`mood-${finalMood}`);
    });

    // Update Kiro's message
    const messageElement = document.getElementById('kiro-message');
    if (messageElement && kiroMessages.models[finalMood]) {
        messageElement.textContent = kiroMessages.models[finalMood];
    }
}

// ===== Navigation =====
function goToStep(step) {
    // Validate before moving forward
    if (step > state.currentStep && !validateCurrentStep()) {
        return;
    }

    // Update step classes
    document.querySelectorAll('.step').forEach((stepEl, index) => {
        stepEl.classList.remove('active', 'completed');
        if (index + 1 < step) {
            stepEl.classList.add('completed');
        } else if (index + 1 === step) {
            stepEl.classList.add('active');
        }
    });

    // Show/hide sections
    document.querySelectorAll('.form-section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(`step${step}`).classList.add('active');

    // Update state
    state.currentStep = step;

    // Update Kiro message
    updateKiroMessage();

    // Special handling for step 3 (preview)
    if (step === 3) {
        updateTranslationPreview();
    }

    // Scroll to top
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

function updateTranslationPreview() {
    const preview = document.getElementById('translation-preview');
    const bigIdea = document.getElementById('big-idea').value.trim();

    if (bigIdea) {
        preview.textContent = bigIdea.substring(0, 200) + (bigIdea.length > 200 ? '...' : '');
        preview.style.fontStyle = 'normal';
    } else {
        preview.textContent = '入力した内容がここに表示されます...';
        preview.style.fontStyle = 'italic';
    }
}

function updateProblemChips() {
    // Could dynamically update problems based on selected categories
    // For now, keep all problems visible
}

// ===== Translation =====
async function translateAll() {
    const apiKey = document.getElementById('api-key').value.trim();
    const provider = document.getElementById('api-provider').value;

    // Validate based on provider
    if (provider === 'bedrock') {
        const lambdaUrl = document.getElementById('lambda-function-url').value.trim();
        const accessKey = document.getElementById('aws-access-key').value.trim();
        const secretKey = document.getElementById('aws-secret-key').value.trim();

        if (!lambdaUrl) {
            showToast('Lambda Function URLを入力してください', 'error');
            return;
        }
        if (!accessKey || !secretKey) {
            showToast('AWS認証情報を入力してください', 'error');
            return;
        }
    } else if (!apiKey) {
        showToast('APIキーを入力してください', 'error');
        return;
    }

    const translateBtn = document.getElementById('translate-btn');
    const btnText = translateBtn.querySelector('.btn-text');
    const btnLoading = translateBtn.querySelector('.btn-loading');

    // Show loading state
    btnText.classList.add('hidden');
    btnLoading.classList.remove('hidden');
    translateBtn.disabled = true;

    try {
        // Translate each field
        const fields = [
            { key: 'bigIdea', elementId: 'big-idea', limit: 500 },
            { key: 'vision', elementId: 'vision', limit: 1000 },
            { key: 'impact', elementId: 'impact', limit: 1000 },
            { key: 'gamePlan', elementId: 'game-plan', limit: 1500 }
        ];

        for (const field of fields) {
            const content = document.getElementById(field.elementId).value.trim();
            if (content) {
                const translated = await translateText(content, field.limit, apiKey, provider);
                state.translatedData[field.key] = translated;
            }
        }

        // Team name (usually doesn't need translation but clean it up)
        state.translatedData.teamName = document.getElementById('team-name').value.trim();

        // Services don't need translation
        state.translatedData.aiServices = state.selectedAiServices.join(', ');
        state.translatedData.otherServices = state.selectedOtherServices.join(', ');

        // Update results
        updateResults();

        // Go to step 4
        goToStep(4);

        showToast('翻訳完了！');

    } catch (error) {
        console.error('Translation error:', error);
        showToast(`翻訳エラー: ${error.message}`, 'error');
    } finally {
        // Reset button state
        btnText.classList.remove('hidden');
        btnLoading.classList.add('hidden');
        translateBtn.disabled = false;
    }
}

async function translateText(content, charLimit, apiKey, provider) {
    const prompt = translationPrompt
        .replace('{charLimit}', charLimit)
        .replace('{content}', content);

    if (provider === 'anthropic') {
        return await callAnthropicAPI(prompt, apiKey);
    } else if (provider === 'openai') {
        return await callOpenAIAPI(prompt, apiKey);
    } else if (provider === 'bedrock') {
        return await callBedrockAPI(prompt, apiKey);
    }

    throw new Error('Unknown provider');
}

async function callAnthropicAPI(prompt, apiKey) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
            model: 'claude-3-5-haiku-20241022',
            max_tokens: 2000,
            messages: [
                { role: 'user', content: prompt }
            ]
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'API request failed');
    }

    const data = await response.json();
    return data.content[0].text;
}

async function callOpenAIAPI(prompt, apiKey) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'user', content: prompt }
            ],
            max_tokens: 2000
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'API request failed');
    }

    const data = await response.json();
    return data.choices[0].message.content;
}

async function callBedrockAPI(prompt, apiKey) {
    // Get Bedrock settings
    const lambdaFunctionUrl = document.getElementById('lambda-function-url').value.trim();
    const region = document.getElementById('bedrock-region').value;
    const accessKeyId = document.getElementById('aws-access-key').value.trim();
    const secretAccessKey = document.getElementById('aws-secret-key').value.trim();
    const sessionToken = document.getElementById('aws-session-token').value.trim() || null;
    const modelId = state.selectedModel;

    // Validate required fields
    if (!lambdaFunctionUrl) {
        throw new Error('Lambda Function URLを入力してください');
    }
    if (!accessKeyId || !secretAccessKey) {
        throw new Error('AWS Access Key IDとSecret Access Keyを入力してください');
    }

    // Create Bedrock Lambda client with SigV4 signing
    const client = new BedrockLambdaClient({
        functionUrl: lambdaFunctionUrl,
        region: region,
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey,
        sessionToken: sessionToken
    });

    // Prepare payload for Lambda function
    // Lambda function should handle the model invocation
    const payload = {
        modelId: modelId,
        message: prompt
    };

    try {
        const response = await client.invoke(payload);

        // Parse response based on expected Lambda response format
        // Lambda should return: { output: "translated text" } or similar
        if (response.output) {
            return response.output;
        } else if (response.content && response.content[0]) {
            // Anthropic format from Converse API
            return response.content[0].text;
        } else if (response.message) {
            return response.message;
        } else if (typeof response === 'string') {
            return response;
        }

        throw new Error('Unexpected response format from Lambda');
    } catch (error) {
        // Check for common errors
        if (error.message.includes('403')) {
            throw new Error('認証エラー: AWS認証情報を確認してください。Lambda Function URLのIAM認証設定も確認してください。');
        } else if (error.message.includes('404')) {
            throw new Error('Lambda Function URLが見つかりません。URLを確認してください。');
        } else if (error.message.includes('CORS')) {
            throw new Error('CORSエラー: Lambda Function URLのCORS設定を確認してください。');
        }
        throw error;
    }
}

// ===== Results =====
function updateResults() {
    // Team name
    document.getElementById('result-team-name').textContent = state.translatedData.teamName || '-';

    // Big idea
    const bigIdea = state.translatedData.bigIdea || '-';
    document.getElementById('result-big-idea').textContent = bigIdea;
    document.getElementById('big-idea-chars').textContent = bigIdea.length;
    updateCharIndicator('big-idea-chars', bigIdea.length, 500);

    // Vision
    const vision = state.translatedData.vision || '-';
    document.getElementById('result-vision').textContent = vision;
    document.getElementById('vision-chars').textContent = vision.length;
    updateCharIndicator('vision-chars', vision.length, 1000);

    // Impact
    const impact = state.translatedData.impact || '-';
    document.getElementById('result-impact').textContent = impact;
    document.getElementById('impact-chars').textContent = impact.length;
    updateCharIndicator('impact-chars', impact.length, 1000);

    // Game plan
    const gamePlan = state.translatedData.gamePlan || '-';
    document.getElementById('result-game-plan').textContent = gamePlan;
    document.getElementById('game-plan-chars').textContent = gamePlan.length;
    updateCharIndicator('game-plan-chars', gamePlan.length, 1500);

    // Services
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
    // Remove existing toast
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
        existingToast.remove();
    }

    // Create new toast
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    // Show toast
    setTimeout(() => toast.classList.add('show'), 10);

    // Hide after 3 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
