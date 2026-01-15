/**
 * AWS Lambda Function for Bedrock Translation
 *
 * This Lambda function acts as a proxy for Amazon Bedrock API calls.
 * It should be deployed with:
 * - IAM Role with bedrock:InvokeModel permission
 * - Function URL with IAM authentication enabled
 *
 * Setup:
 * 1. Create a Lambda function with Node.js 18.x+ runtime
 * 2. Attach IAM role with bedrock:InvokeModel policy
 * 3. Enable Function URL with AWS_IAM auth type
 * 4. Configure CORS as needed
 */

import {
    BedrockRuntimeClient,
    ConverseCommand
} from "@aws-sdk/client-bedrock-runtime";

// Initialize Bedrock client
const client = new BedrockRuntimeClient({
    region: process.env.AWS_REGION || "us-east-1"
});

// CORS headers for browser requests
const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Amz-Date, X-Amz-Security-Token, X-Amz-Content-Sha256",
    "Content-Type": "application/json"
};

export const handler = async (event) => {
    // Handle preflight requests
    if (event.requestContext?.http?.method === "OPTIONS") {
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: ""
        };
    }

    try {
        // Parse request body
        const body = typeof event.body === "string"
            ? JSON.parse(event.body)
            : event.body;

        const { modelId, message } = body;

        if (!modelId || !message) {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({
                    error: "Missing required fields: modelId and message"
                })
            };
        }

        // Prepare messages for Converse API
        const messages = [
            {
                role: "user",
                content: [{ text: message }]
            }
        ];

        // Call Bedrock using Converse API (unified interface)
        const command = new ConverseCommand({
            modelId: modelId,
            messages: messages,
            inferenceConfig: {
                maxTokens: 2000,
                temperature: 0.3  // Lower temperature for more consistent translations
            }
        });

        const response = await client.send(command);

        // Extract text from response
        const outputText = response.output?.message?.content?.[0]?.text || "";

        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
                output: outputText,
                usage: response.usage,
                stopReason: response.stopReason
            })
        };

    } catch (error) {
        console.error("Error:", error);

        // Handle specific errors
        let statusCode = 500;
        let errorMessage = error.message;

        if (error.name === "ValidationException") {
            statusCode = 400;
        } else if (error.name === "AccessDeniedException") {
            statusCode = 403;
            errorMessage = "Access denied. Check IAM permissions for bedrock:InvokeModel";
        } else if (error.name === "ResourceNotFoundException") {
            statusCode = 404;
            errorMessage = "Model not found. Check if the model is available in your region.";
        } else if (error.name === "ThrottlingException") {
            statusCode = 429;
            errorMessage = "Rate limit exceeded. Please try again later.";
        }

        return {
            statusCode: statusCode,
            headers: corsHeaders,
            body: JSON.stringify({
                error: errorMessage,
                errorType: error.name
            })
        };
    }
};
