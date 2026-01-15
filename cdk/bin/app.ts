#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { KiroTranslatorStack } from "../lib/kiro-translator-stack";

const app = new cdk.App();

// Get environment variables or use defaults
const env = {
    account: process.env.CDK_DEFAULT_ACCOUNT || process.env.AWS_ACCOUNT_ID,
    region: process.env.CDK_DEFAULT_REGION || process.env.AWS_REGION || "ap-northeast-1",
};

new KiroTranslatorStack(app, "KiroTranslatorStack", {
    env,
    description: "10,000 AIdeas Contest Translator - S3/CloudFront + Bedrock Lambda",
});
