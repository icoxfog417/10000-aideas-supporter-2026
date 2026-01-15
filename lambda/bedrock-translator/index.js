/**
 * Bedrock Translator Lambda Function
 *
 * This function acts as a proxy for Amazon Bedrock API calls.
 * It uses the Converse API for unified model interface.
 * Supports both regular and streaming responses.
 *
 * Required IAM permissions: bedrock:InvokeModel, bedrock:InvokeModelWithResponseStream
 */

const {
    BedrockRuntimeClient,
    ConverseCommand,
    ConverseStreamCommand,
} = require("@aws-sdk/client-bedrock-runtime");

// Initialize Bedrock client (uses Lambda's IAM role)
const client = new BedrockRuntimeClient({
    region: process.env.AWS_REGION || "us-east-1",
});

// CORS headers for browser requests
const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
        "Content-Type, Authorization, X-Amz-Date, X-Amz-Security-Token, X-Amz-Content-Sha256",
};

// Regular (non-streaming) handler
const handleRegularRequest = async (modelId, message) => {
    const messages = [
        {
            role: "user",
            content: [{ text: message }],
        },
    ];

    const command = new ConverseCommand({
        modelId: modelId,
        messages: messages,
        inferenceConfig: {
            maxTokens: 2000,
            temperature: 0.3,
        },
    });

    const response = await client.send(command);
    const outputText = response.output?.message?.content?.[0]?.text || "";

    return {
        statusCode: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
            output: outputText,
            usage: response.usage,
            stopReason: response.stopReason,
        }),
    };
};

// Streaming handler - collects chunks and sends as SSE
const handleStreamingRequest = async (modelId, message) => {
    const messages = [
        {
            role: "user",
            content: [{ text: message }],
        },
    ];

    const command = new ConverseStreamCommand({
        modelId: modelId,
        messages: messages,
        inferenceConfig: {
            maxTokens: 2000,
            temperature: 0.3,
        },
    });

    const response = await client.send(command);

    // Collect all text chunks
    let fullText = "";
    const chunks = [];

    for await (const event of response.stream) {
        if (event.contentBlockDelta?.delta?.text) {
            const text = event.contentBlockDelta.delta.text;
            fullText += text;
            chunks.push(text);
        }
    }

    // Return as SSE format for frontend parsing
    const sseData = chunks.map(chunk => `data: ${JSON.stringify({ text: chunk })}\n\n`).join("");
    const sseEnd = `data: ${JSON.stringify({ done: true, fullText: fullText })}\n\n`;

    return {
        statusCode: 200,
        headers: {
            ...corsHeaders,
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
        body: sseData + sseEnd,
    };
};

exports.handler = async (event) => {
    // Handle preflight OPTIONS requests
    if (event.requestContext?.http?.method === "OPTIONS") {
        return {
            statusCode: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            body: "",
        };
    }

    try {
        // Parse request body
        const body =
            typeof event.body === "string" ? JSON.parse(event.body) : event.body;

        const { modelId, message, stream } = body;

        if (!modelId || !message) {
            return {
                statusCode: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                body: JSON.stringify({
                    error: "Missing required fields: modelId and message",
                }),
            };
        }

        console.log(`Invoking model: ${modelId}, streaming: ${!!stream}`);

        // Use streaming or regular based on request
        if (stream) {
            return await handleStreamingRequest(modelId, message);
        } else {
            return await handleRegularRequest(modelId, message);
        }
    } catch (error) {
        console.error("Error:", error);

        // Handle specific Bedrock errors
        let statusCode = 500;
        let errorMessage = error.message;

        if (error.name === "ValidationException") {
            statusCode = 400;
            errorMessage = `Validation error: ${error.message}`;
        } else if (error.name === "AccessDeniedException") {
            statusCode = 403;
            errorMessage =
                "Access denied. Check IAM permissions for bedrock:InvokeModel";
        } else if (error.name === "ResourceNotFoundException") {
            statusCode = 404;
            errorMessage =
                "Model not found. Check if the model is available in your region.";
        } else if (error.name === "ThrottlingException") {
            statusCode = 429;
            errorMessage = "Rate limit exceeded. Please try again later.";
        } else if (error.name === "ModelTimeoutException") {
            statusCode = 504;
            errorMessage = "Model timed out. Please try again.";
        } else if (error.name === "ServiceQuotaExceededException") {
            statusCode = 429;
            errorMessage = "Service quota exceeded. Please try again later.";
        }

        return {
            statusCode: statusCode,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            body: JSON.stringify({
                error: errorMessage,
                errorType: error.name,
            }),
        };
    }
};
