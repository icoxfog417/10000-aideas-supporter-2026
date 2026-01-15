/**
 * Bedrock Translator Lambda Function
 *
 * This function acts as a proxy for Amazon Bedrock API calls.
 * It uses the Converse API for unified model interface.
 *
 * Required IAM permissions: bedrock:InvokeModel
 */

const {
    BedrockRuntimeClient,
    ConverseCommand,
} = require("@aws-sdk/client-bedrock-runtime");

// Initialize Bedrock client (uses Lambda's IAM role)
const client = new BedrockRuntimeClient({
    region: process.env.AWS_REGION || "ap-northeast-1",
});

// CORS headers for browser requests
const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
        "Content-Type, Authorization, X-Amz-Date, X-Amz-Security-Token, X-Amz-Content-Sha256",
    "Content-Type": "application/json",
};

exports.handler = async (event) => {
    // Handle preflight OPTIONS requests
    if (event.requestContext?.http?.method === "OPTIONS") {
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: "",
        };
    }

    // Validate CloudFront secret header (if configured)
    const expectedSecret = process.env.CLOUDFRONT_SECRET_HEADER;
    if (expectedSecret) {
        const receivedSecret = event.headers?.["x-cloudfront-secret"];
        if (receivedSecret !== expectedSecret) {
            console.log("Unauthorized request: invalid or missing CloudFront secret");
            return {
                statusCode: 403,
                headers: corsHeaders,
                body: JSON.stringify({
                    error: "Forbidden: Direct access not allowed",
                }),
            };
        }
    }

    try {
        // Parse request body
        const body =
            typeof event.body === "string" ? JSON.parse(event.body) : event.body;

        const { modelId, message } = body;

        if (!modelId || !message) {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({
                    error: "Missing required fields: modelId and message",
                }),
            };
        }

        console.log(`Invoking model: ${modelId}`);

        // Prepare messages for Converse API
        const messages = [
            {
                role: "user",
                content: [{ text: message }],
            },
        ];

        // Call Bedrock using Converse API (unified interface for all models)
        const command = new ConverseCommand({
            modelId: modelId,
            messages: messages,
            inferenceConfig: {
                maxTokens: 2000,
                temperature: 0.3, // Lower temperature for consistent translations
            },
        });

        const response = await client.send(command);

        // Extract text from response
        const outputText =
            response.output?.message?.content?.[0]?.text || "";

        console.log(`Translation completed. Output length: ${outputText.length}`);

        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
                output: outputText,
                usage: response.usage,
                stopReason: response.stopReason,
            }),
        };
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
            headers: corsHeaders,
            body: JSON.stringify({
                error: errorMessage,
                errorType: error.name,
            }),
        };
    }
};
