import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as cr from "aws-cdk-lib/custom-resources";
import { Construct } from "constructs";
import * as path from "path";

export class KiroTranslatorStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        // Enable cross-region references for Lambda@Edge
        super(scope, id, {
            ...props,
            crossRegionReferences: true,
        });

        // ========================================
        // S3 Bucket for Static Website
        // ========================================
        const websiteBucket = new s3.Bucket(this, "WebsiteBucket", {
            bucketName: `kiro-translator-${this.account}-${this.region}`,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            encryption: s3.BucketEncryption.S3_MANAGED,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
        });

        // ========================================
        // CloudFront Origin Access Control
        // ========================================
        const oac = new cloudfront.S3OriginAccessControl(this, "OAC", {
            originAccessControlName: "KiroTranslatorOAC-v2",
            signing: cloudfront.Signing.SIGV4_ALWAYS,
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
                    `arn:aws:bedrock:${this.region}::foundation-model/*`,
                    `arn:aws:bedrock:*:${this.account}:inference-profile/*`,
                ],
            })
        );

        // ========================================
        // Lambda Function URL with IAM Auth (SECURE)
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
        // Lambda@Edge for SigV4 Signing (us-east-1)
        // ========================================
        const edgeFunction = new cloudfront.experimental.EdgeFunction(this, "EdgeSigner", {
            functionName: "kiro-edge-signer-v2",
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: "index.handler",
            code: lambda.Code.fromAsset(path.join(__dirname, "../../lambda/edge-signer")),
            timeout: cdk.Duration.seconds(30),
        });

        // Grant Lambda@Edge permission to invoke Lambda Function URL
        edgeFunction.addToRolePolicy(
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

        // Parse Lambda URL to get domain
        const lambdaUrlDomain = cdk.Fn.select(2, cdk.Fn.split("/", functionUrl.url));

        // ========================================
        // CloudFront Distribution with Lambda@Edge
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
            additionalBehaviors: {
                "/api/*": {
                    origin: new origins.HttpOrigin(lambdaUrlDomain, {
                        protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
                    }),
                    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                    allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
                    cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
                    originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
                    edgeLambdas: [
                        {
                            functionVersion: edgeFunction.currentVersion,
                            eventType: cloudfront.LambdaEdgeEventType.ORIGIN_REQUEST,
                            includeBody: true,
                        },
                    ],
                },
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
        const websiteDeployment = new s3deploy.BucketDeployment(this, "DeployWebsite", {
            sources: [s3deploy.Source.asset(path.join(__dirname, "../../frontend"))],
            destinationBucket: websiteBucket,
            distribution,
            distributionPaths: ["/*"],
        });

        // ========================================
        // Deploy config.js (API endpoint only - no credentials!)
        // ========================================
        const configContent = `// This file is auto-generated during deployment
window.APP_CONFIG = {
    apiEndpoint: '/api/'
};
`;

        const configDeployment = new cr.AwsCustomResource(this, "DeployConfig", {
            onCreate: {
                service: "S3",
                action: "putObject",
                parameters: {
                    Bucket: websiteBucket.bucketName,
                    Key: "config.js",
                    Body: configContent,
                    ContentType: "application/javascript",
                },
                physicalResourceId: cr.PhysicalResourceId.of("config-js-deployment"),
            },
            onUpdate: {
                service: "S3",
                action: "putObject",
                parameters: {
                    Bucket: websiteBucket.bucketName,
                    Key: "config.js",
                    Body: configContent,
                    ContentType: "application/javascript",
                },
                physicalResourceId: cr.PhysicalResourceId.of("config-js-deployment"),
            },
            policy: cr.AwsCustomResourcePolicy.fromStatements([
                new iam.PolicyStatement({
                    actions: ["s3:PutObject"],
                    resources: [`${websiteBucket.bucketArn}/config.js`],
                }),
            ]),
        });

        // Ensure config.js is deployed AFTER the website deployment
        configDeployment.node.addDependency(websiteBucket);
        configDeployment.node.addDependency(websiteDeployment);

        // Invalidate CloudFront cache
        new cr.AwsCustomResource(this, "InvalidateCache", {
            onCreate: {
                service: "CloudFront",
                action: "createInvalidation",
                parameters: {
                    DistributionId: distribution.distributionId,
                    InvalidationBatch: {
                        CallerReference: Date.now().toString(),
                        Paths: {
                            Quantity: 1,
                            Items: ["/*"],
                        },
                    },
                },
                physicalResourceId: cr.PhysicalResourceId.of("cloudfront-invalidation"),
            },
            onUpdate: {
                service: "CloudFront",
                action: "createInvalidation",
                parameters: {
                    DistributionId: distribution.distributionId,
                    InvalidationBatch: {
                        CallerReference: Date.now().toString(),
                        Paths: {
                            Quantity: 1,
                            Items: ["/*"],
                        },
                    },
                },
                physicalResourceId: cr.PhysicalResourceId.of("cloudfront-invalidation"),
            },
            policy: cr.AwsCustomResourcePolicy.fromStatements([
                new iam.PolicyStatement({
                    actions: ["cloudfront:CreateInvalidation"],
                    resources: [`arn:aws:cloudfront::${this.account}:distribution/${distribution.distributionId}`],
                }),
            ]),
        });

        // ========================================
        // Outputs
        // ========================================
        new cdk.CfnOutput(this, "WebsiteURL", {
            value: `https://${distribution.distributionDomainName}`,
            description: "CloudFront Website URL",
        });

        new cdk.CfnOutput(this, "APIURL", {
            value: `https://${distribution.distributionDomainName}/api/`,
            description: "API endpoint (via CloudFront + Lambda@Edge)",
        });

        new cdk.CfnOutput(this, "S3BucketName", {
            value: websiteBucket.bucketName,
            description: "S3 Bucket Name for static website",
        });

        new cdk.CfnOutput(this, "LambdaFunctionArn", {
            value: bedrockTranslatorFunction.functionArn,
            description: "Lambda Function ARN",
        });

        new cdk.CfnOutput(this, "Region", {
            value: this.region,
            description: "AWS Region",
        });
    }
}
