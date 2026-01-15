import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import { Construct } from "constructs";
import * as path from "path";

export class KiroTranslatorStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // ========================================
        // S3 Bucket for Static Website
        // ========================================
        const websiteBucket = new s3.Bucket(this, "WebsiteBucket", {
            bucketName: `kiro-translator-${this.account}-${this.region}`,
            // Private bucket - CloudFront will access via OAC
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            encryption: s3.BucketEncryption.S3_MANAGED,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
        });

        // ========================================
        // CloudFront Origin Access Control
        // ========================================
        const oac = new cloudfront.S3OriginAccessControl(this, "OAC", {
            originAccessControlName: "KiroTranslatorOAC",
            signing: cloudfront.Signing.SIGV4_ALWAYS,
        });

        // ========================================
        // CloudFront Distribution
        // ========================================
        const distribution = new cloudfront.Distribution(this, "Distribution", {
            defaultBehavior: {
                origin: origins.S3BucketOrigin.withOriginAccessControl(websiteBucket, {
                    originAccessControl: oac,
                }),
                viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
                cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
                cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
            },
            defaultRootObject: "index.html",
            errorResponses: [
                {
                    httpStatus: 404,
                    responseHttpStatus: 200,
                    responsePagePath: "/index.html",
                    ttl: cdk.Duration.minutes(5),
                },
                {
                    httpStatus: 403,
                    responseHttpStatus: 200,
                    responsePagePath: "/index.html",
                    ttl: cdk.Duration.minutes(5),
                },
            ],
            priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
        });

        // ========================================
        // Deploy Frontend to S3
        // ========================================
        new s3deploy.BucketDeployment(this, "DeployWebsite", {
            sources: [s3deploy.Source.asset(path.join(__dirname, "../../frontend"))],
            destinationBucket: websiteBucket,
            distribution,
            distributionPaths: ["/*"],
        });

        // ========================================
        // Bedrock Translator Lambda Function
        // ========================================
        const bedrockTranslatorFunction = new lambda.Function(this, "BedrockTranslator", {
            functionName: "kiro-bedrock-translator",
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: "index.handler",
            code: lambda.Code.fromAsset(path.join(__dirname, "../../lambda/bedrock-translator")),
            timeout: cdk.Duration.seconds(60),
            memorySize: 256,
            architecture: lambda.Architecture.ARM_64,
            environment: {
                AWS_NODEJS_CONNECTION_REUSE_ENABLED: "1",
            },
        });

        // Grant Bedrock permissions
        bedrockTranslatorFunction.addToRolePolicy(
            new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: ["bedrock:InvokeModel"],
                resources: [
                    // Foundation models
                    `arn:aws:bedrock:${this.region}::foundation-model/*`,
                    // Cross-region inference profiles
                    `arn:aws:bedrock:*:${this.account}:inference-profile/*`,
                ],
            })
        );

        // ========================================
        // Lambda Function URL with IAM Auth
        // ========================================
        const functionUrl = bedrockTranslatorFunction.addFunctionUrl({
            authType: lambda.FunctionUrlAuthType.AWS_IAM,
            cors: {
                allowedOrigins: ["*"],
                allowedMethods: [lambda.HttpMethod.POST],
                allowedHeaders: [
                    "Content-Type",
                    "Authorization",
                    "X-Amz-Date",
                    "X-Amz-Security-Token",
                    "X-Amz-Content-Sha256",
                ],
                maxAge: cdk.Duration.hours(1),
            },
        });

        // ========================================
        // IAM User for Frontend (Optional)
        // ========================================
        const translatorUser = new iam.User(this, "TranslatorUser", {
            userName: "kiro-translator-user",
        });

        // Grant permission to invoke Lambda Function URL
        translatorUser.addToPolicy(
            new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: ["lambda:InvokeFunctionUrl"],
                resources: [bedrockTranslatorFunction.functionArn],
                conditions: {
                    StringEquals: {
                        "lambda:FunctionUrlAuthType": "AWS_IAM",
                    },
                },
            })
        );

        // Create access key for the user
        const accessKey = new iam.AccessKey(this, "TranslatorAccessKey", {
            user: translatorUser,
        });

        // ========================================
        // Outputs
        // ========================================
        new cdk.CfnOutput(this, "WebsiteURL", {
            value: `https://${distribution.distributionDomainName}`,
            description: "CloudFront Website URL",
        });

        new cdk.CfnOutput(this, "S3BucketName", {
            value: websiteBucket.bucketName,
            description: "S3 Bucket Name for static website",
        });

        new cdk.CfnOutput(this, "LambdaFunctionURL", {
            value: functionUrl.url,
            description: "Lambda Function URL for Bedrock translation (IAM auth required)",
        });

        new cdk.CfnOutput(this, "LambdaFunctionArn", {
            value: bedrockTranslatorFunction.functionArn,
            description: "Lambda Function ARN",
        });

        new cdk.CfnOutput(this, "TranslatorAccessKeyId", {
            value: accessKey.accessKeyId,
            description: "Access Key ID for invoking Lambda Function URL",
        });

        new cdk.CfnOutput(this, "TranslatorSecretAccessKey", {
            value: accessKey.secretAccessKey.unsafeUnwrap(),
            description: "Secret Access Key for invoking Lambda Function URL (KEEP SECRET!)",
        });

        new cdk.CfnOutput(this, "Region", {
            value: this.region,
            description: "AWS Region",
        });
    }
}
