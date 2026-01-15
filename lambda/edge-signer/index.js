const { createHash, createHmac } = require("crypto");

const SERVICE = "lambda";

// Lambda@Edge gets credentials from its execution role automatically
// We use the AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_SESSION_TOKEN
// environment variables that AWS Lambda runtime provides

exports.handler = async (event) => {
    const request = event.Records[0].cf.request;

    try {
        // Get origin info
        if (!request.origin || !request.origin.custom) {
            return request;
        }

        const host = request.origin.custom.domainName;

        // Extract region from Lambda URL domain
        // Format: xxxxx.lambda-url.REGION.on.aws
        const regionMatch = host.match(/lambda-url\.([^.]+)\.on\.aws/);
        const region = regionMatch ? regionMatch[1] : "us-west-2";

        // Get request body
        let body = "";
        if (request.body && request.body.data) {
            body = request.body.encoding === "base64"
                ? Buffer.from(request.body.data, "base64").toString("utf-8")
                : request.body.data;
        }

        // Get credentials from Lambda runtime environment
        const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
        const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
        const sessionToken = process.env.AWS_SESSION_TOKEN;

        if (!accessKeyId || !secretAccessKey) {
            console.error("Missing AWS credentials from runtime");
            return {
                status: "500",
                statusDescription: "Internal Server Error",
                body: JSON.stringify({ error: "Missing credentials" }),
            };
        }

        // Create timestamp
        const now = new Date();
        const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
        const dateStamp = amzDate.slice(0, 8);

        // Calculate payload hash
        const payloadHash = createHash("sha256").update(body).digest("hex");

        // Create canonical request
        const method = request.method;
        const canonicalUri = request.uri || "/";
        const canonicalQuerystring = request.querystring || "";

        // Prepare headers for signing
        const headersToSign = {
            host: host,
            "x-amz-date": amzDate,
            "x-amz-content-sha256": payloadHash,
        };

        // Add session token if present
        if (sessionToken) {
            headersToSign["x-amz-security-token"] = sessionToken;
        }

        // Add content-type if present
        if (request.headers["content-type"] && request.headers["content-type"][0]) {
            headersToSign["content-type"] = request.headers["content-type"][0].value;
        }

        const signedHeaders = Object.keys(headersToSign).sort().join(";");
        const canonicalHeaders = Object.keys(headersToSign)
            .sort()
            .map((key) => `${key}:${headersToSign[key]}\n`)
            .join("");

        const canonicalRequest = [
            method,
            canonicalUri,
            canonicalQuerystring,
            canonicalHeaders,
            signedHeaders,
            payloadHash,
        ].join("\n");

        // Create string to sign
        const algorithm = "AWS4-HMAC-SHA256";
        const credentialScope = `${dateStamp}/${region}/${SERVICE}/aws4_request`;
        const stringToSign = [
            algorithm,
            amzDate,
            credentialScope,
            createHash("sha256").update(canonicalRequest).digest("hex"),
        ].join("\n");

        // Calculate signature
        const getSignatureKey = (key, dateStamp, regionName, serviceName) => {
            const kDate = createHmac("sha256", `AWS4${key}`).update(dateStamp).digest();
            const kRegion = createHmac("sha256", kDate).update(regionName).digest();
            const kService = createHmac("sha256", kRegion).update(serviceName).digest();
            const kSigning = createHmac("sha256", kService).update("aws4_request").digest();
            return kSigning;
        };

        const signingKey = getSignatureKey(secretAccessKey, dateStamp, region, SERVICE);
        const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");

        // Create authorization header
        const authorizationHeader = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

        // Update request with signed headers
        request.headers["host"] = [{ key: "Host", value: host }];
        request.headers["x-amz-date"] = [{ key: "X-Amz-Date", value: amzDate }];
        request.headers["x-amz-content-sha256"] = [{ key: "X-Amz-Content-Sha256", value: payloadHash }];
        request.headers["authorization"] = [{ key: "Authorization", value: authorizationHeader }];

        // Add session token header if present
        if (sessionToken) {
            request.headers["x-amz-security-token"] = [{ key: "X-Amz-Security-Token", value: sessionToken }];
        }

        return request;
    } catch (error) {
        console.error("Error signing request:", error);
        return {
            status: "500",
            statusDescription: "Internal Server Error",
            body: JSON.stringify({ error: error.message }),
        };
    }
};
