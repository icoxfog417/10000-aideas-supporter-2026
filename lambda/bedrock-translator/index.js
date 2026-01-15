/**
 * Bedrock Translator Lambda Function
 *
 * This function acts as a proxy for Amazon Bedrock API calls.
 * It uses the Converse API for unified model interface.
 * Supports true streaming responses using Lambda Response Streaming.
 * Also handles analytics event tracking.
 *
 * Required IAM permissions: bedrock:InvokeModel, bedrock:InvokeModelWithResponseStream, dynamodb:UpdateItem, dynamodb:Scan
 */

const {
    BedrockRuntimeClient,
    ConverseCommand,
    ConverseStreamCommand,
} = require("@aws-sdk/client-bedrock-runtime");

const {
    DynamoDBClient,
    UpdateItemCommand,
    ScanCommand,
} = require("@aws-sdk/client-dynamodb");

// Initialize clients (uses Lambda's IAM role)
const bedrockClient = new BedrockRuntimeClient({
    region: process.env.AWS_REGION || "us-east-1",
});

const dynamoClient = new DynamoDBClient({
    region: process.env.AWS_REGION || "us-east-1",
});

const ANALYTICS_TABLE = process.env.ANALYTICS_TABLE_NAME;

// CORS headers for browser requests
const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
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

    const response = await bedrockClient.send(command);
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

// Analytics: Track event (increment counter)
const trackEvent = async (eventType) => {
    if (!ANALYTICS_TABLE) {
        console.warn("ANALYTICS_TABLE_NAME not configured");
        return { success: false, error: "Analytics not configured" };
    }

    const command = new UpdateItemCommand({
        TableName: ANALYTICS_TABLE,
        Key: {
            eventType: { S: eventType },
        },
        UpdateExpression: "SET #count = if_not_exists(#count, :zero) + :inc, lastUpdated = :now",
        ExpressionAttributeNames: {
            "#count": "count",
        },
        ExpressionAttributeValues: {
            ":inc": { N: "1" },
            ":zero": { N: "0" },
            ":now": { S: new Date().toISOString() },
        },
        ReturnValues: "ALL_NEW",
    });

    const result = await dynamoClient.send(command);
    return {
        success: true,
        eventType: eventType,
        count: parseInt(result.Attributes.count.N, 10),
    };
};

// Analytics: Get all stats
const getAnalyticsStats = async () => {
    if (!ANALYTICS_TABLE) {
        return { success: false, error: "Analytics not configured" };
    }

    const command = new ScanCommand({
        TableName: ANALYTICS_TABLE,
    });

    const result = await dynamoClient.send(command);
    const stats = {};

    for (const item of result.Items || []) {
        stats[item.eventType.S] = {
            count: parseInt(item.count.N, 10),
            lastUpdated: item.lastUpdated?.S || null,
        };
    }

    return { success: true, stats };
};

// Helper to write JSON response to stream
const writeJsonResponse = (responseStream, statusCode, body) => {
    const metadata = {
        statusCode: statusCode,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    };
    responseStream = awslambda.HttpResponseStream.from(responseStream, metadata);
    responseStream.write(JSON.stringify(body));
    responseStream.end();
};

// Main handler with streaming support
exports.handler = awslambda.streamifyResponse(
    async (event, responseStream, context) => {
        // Handle preflight OPTIONS requests
        if (event.requestContext?.http?.method === "OPTIONS") {
            writeJsonResponse(responseStream, 200, "");
            return;
        }

        // Get request path for routing
        const path = event.rawPath || event.requestContext?.http?.path || "/api/invoke";

        try {
            // Route: /api/track - Track analytics event
            if (path.includes("/api/track")) {
                const body = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
                const { eventType } = body;

                if (!eventType) {
                    writeJsonResponse(responseStream, 400, { error: "Missing required field: eventType" });
                    return;
                }

                console.log(`Tracking event: ${eventType}`);
                const result = await trackEvent(eventType);
                writeJsonResponse(responseStream, 200, result);
                return;
            }

            // Route: /api/stats - Get analytics stats
            if (path.includes("/api/stats")) {
                console.log("Getting analytics stats");
                const result = await getAnalyticsStats();
                writeJsonResponse(responseStream, 200, result);
                return;
            }

            // Route: /api/invoke - Bedrock invocation (default)
            const body = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
            const { modelId, message, stream } = body;

            if (!modelId || !message) {
                writeJsonResponse(responseStream, 400, { error: "Missing required fields: modelId and message" });
                return;
            }

            console.log(`Invoking model: ${modelId}, streaming: ${!!stream}`);

            // Non-streaming request - use regular handler
            if (!stream) {
                const result = await handleRegularRequest(modelId, message);
                const metadata = {
                    statusCode: result.statusCode,
                    headers: result.headers,
                };
                responseStream = awslambda.HttpResponseStream.from(responseStream, metadata);
                responseStream.write(result.body);
                responseStream.end();
                return;
            }

            // Streaming request - stream chunks in real-time
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

            const bedrockResponse = await bedrockClient.send(command);

            // Set up SSE response
            const metadata = {
                statusCode: 200,
                headers: {
                    ...corsHeaders,
                    "Content-Type": "text/event-stream",
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                },
            };
            responseStream = awslambda.HttpResponseStream.from(responseStream, metadata);

            // Stream each chunk as it arrives from Bedrock
            let fullText = "";
            for await (const chunk of bedrockResponse.stream) {
                if (chunk.contentBlockDelta?.delta?.text) {
                    const text = chunk.contentBlockDelta.delta.text;
                    fullText += text;
                    // Write SSE format immediately
                    responseStream.write(`data: ${JSON.stringify({ text: text })}\n\n`);
                }
            }

            // Send completion message
            responseStream.write(`data: ${JSON.stringify({ done: true, fullText: fullText })}\n\n`);
            responseStream.end();

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
                errorMessage = "Access denied. Check IAM permissions for bedrock:InvokeModel";
            } else if (error.name === "ResourceNotFoundException") {
                statusCode = 404;
                errorMessage = "Model not found. Check if the model is available in your region.";
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

            writeJsonResponse(responseStream, statusCode, {
                error: errorMessage,
                errorType: error.name,
            });
        }
    }
);
