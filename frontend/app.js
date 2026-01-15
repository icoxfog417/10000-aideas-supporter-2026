// ===== State Management =====
const state = {
    currentStep: 1,
    selectedCategories: [],
    selectedProblems: [],
    selectedTemplate: null,
    selectedAiServices: [],
    selectedOtherServices: [],
    selectedModel: 'amazon.nova-pro-v1:0', // Default model
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
        'ワクワクするアイデアを教えて！'
    ],
    step2: [
        '詳しく教えてくれると嬉しいな！',
        '日本語でOKだよ！',
        'いい感じ！続けて！'
    ],
    step3: [
        'AWS認証情報を入れてね！',
        'Bedrockで翻訳するよ！',
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
    document.querySelectorAll('.category-chips .chip').forEach(chip => {
        chip.addEventListener('click', () => {
            chip.classList.toggle('selected');
            const category = chip.dataset.category;
            if (chip.classList.contains('selected')) {
                state.selectedCategories.push(category);
            } else {
                state.selectedCategories = state.selectedCategories.filter(c => c !== category);
            }
        });
    });

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

        updateCharCount('big-idea');
        updateCharCount('vision');
        updateCharCount('impact');
        updateCharCount('game-plan');

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

    if (step === 3) {
        updateTranslationPreview();
    }

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

// ===== Translation =====
async function translateAll() {
    // Check if config is available (CloudFront API endpoint)
    const config = window.APP_CONFIG || {};
    const hasCloudFrontApi = config.apiEndpoint && !config.apiEndpoint.includes('__');

    if (!hasCloudFrontApi) {
        // Fallback mode - require manual input
        const lambdaUrl = document.getElementById('lambda-function-url')?.value?.trim();
        const accessKey = document.getElementById('aws-access-key')?.value?.trim();
        const secretKey = document.getElementById('aws-secret-key')?.value?.trim();

        if (!lambdaUrl) {
            showToast('Lambda Function URLを入力してください', 'error');
            return;
        }
        if (!accessKey || !secretKey) {
            showToast('AWS認証情報を入力してください', 'error');
            return;
        }
    }

    const translateBtn = document.getElementById('translate-btn');
    const btnText = translateBtn.querySelector('.btn-text');
    const btnLoading = translateBtn.querySelector('.btn-loading');

    btnText.classList.add('hidden');
    btnLoading.classList.remove('hidden');
    translateBtn.disabled = true;

    try {
        const fields = [
            { key: 'bigIdea', elementId: 'big-idea', limit: 500 },
            { key: 'vision', elementId: 'vision', limit: 1000 },
            { key: 'impact', elementId: 'impact', limit: 1000 },
            { key: 'gamePlan', elementId: 'game-plan', limit: 1500 }
        ];

        for (const field of fields) {
            const content = document.getElementById(field.elementId).value.trim();
            if (content) {
                const translated = await translateText(content, field.limit);
                state.translatedData[field.key] = translated;
            }
        }

        state.translatedData.teamName = document.getElementById('team-name').value.trim();
        state.translatedData.aiServices = state.selectedAiServices.join(', ');
        state.translatedData.otherServices = state.selectedOtherServices.join(', ');

        updateResults();
        goToStep(4);
        showToast('翻訳完了！');

    } catch (error) {
        console.error('Translation error:', error);
        showToast(`翻訳エラー: ${error.message}`, 'error');
    } finally {
        btnText.classList.remove('hidden');
        btnLoading.classList.add('hidden');
        translateBtn.disabled = false;
    }
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
