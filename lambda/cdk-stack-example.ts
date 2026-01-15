/**
 * CDK Stack Example for Bedrock Translator Lambda
 *
 * This is an example CDK stack that creates:
 * - Lambda function with Bedrock permissions
 * - Function URL with IAM authentication
 *
 * Usage:
 *   npx cdk init app --language typescript
 *   npm install @aws-cdk/aws-lambda-nodejs
 *   Copy this file to lib/bedrock-translator-stack.ts
 *   npx cdk deploy
 */

import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";
import * as path from "path";

export class BedrockTranslatorStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // Create Lambda function
        const translatorFunction = new NodejsFunction(this, "BedrockTranslator", {
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: "handler",
            entry: path.join(__dirname, "../lambda/bedrock-translator/index.mjs"),
            timeout: cdk.Duration.seconds(60),
            memorySize: 256,
            environment: {
                AWS_NODEJS_CONNECTION_REUSE_ENABLED: "1"
            },
            bundling: {
                format: lambda.OutputFormat.ESM,
                minify: true,
                sourceMap: true
            }
        });

        // Grant Bedrock permissions
        translatorFunction.addToRolePolicy(
            new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: ["bedrock:InvokeModel"],
                resources: [
                    // Allow all models - restrict as needed
                    `arn:aws:bedrock:${this.region}::foundation-model/*`,
                    // Cross-region inference models
                    `arn:aws:bedrock:*:${this.account}:inference-profile/*`
                ]
            })
        );

        // Create Function URL with IAM authentication
        const functionUrl = translatorFunction.addFunctionUrl({
            authType: lambda.FunctionUrlAuthType.AWS_IAM,
            cors: {
                allowedOrigins: ["*"],
                allowedMethods: [lambda.HttpMethod.POST, lambda.HttpMethod.OPTIONS],
                allowedHeaders: [
                    "Content-Type",
                    "Authorization",
                    "X-Amz-Date",
                    "X-Amz-Security-Token",
                    "X-Amz-Content-Sha256"
                ],
                maxAge: cdk.Duration.hours(1)
            }
        });

        // Output the Function URL
        new cdk.CfnOutput(this, "FunctionUrl", {
            value: functionUrl.url,
            description: "Lambda Function URL for Bedrock Translator"
        });

        // Output IAM policy for users to invoke the function
        new cdk.CfnOutput(this, "InvokePolicyArn", {
            value: `arn:aws:lambda:${this.region}:${this.account}:function:${translatorFunction.functionName}`,
            description: "ARN for IAM policy to invoke this function"
        });
    }
}

/**
 * IAM Policy for users to invoke the Lambda Function URL
 *
 * Users need the following permissions to call the Function URL:
 *
 * {
 *   "Version": "2012-10-17",
 *   "Statement": [
 *     {
 *       "Effect": "Allow",
 *       "Action": "lambda:InvokeFunctionUrl",
 *       "Resource": "arn:aws:lambda:REGION:ACCOUNT:function:FUNCTION_NAME",
 *       "Condition": {
 *         "StringEquals": {
 *           "lambda:FunctionUrlAuthType": "AWS_IAM"
 *         }
 *       }
 *     }
 *   ]
 * }
 */
