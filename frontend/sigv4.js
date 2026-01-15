/**
 * AWS Signature Version 4 signing utility for browser
 * Used to sign requests to Lambda Function URLs with IAM authentication
 */

class AWSSignatureV4 {
    constructor(accessKeyId, secretAccessKey, sessionToken = null) {
        this.accessKeyId = accessKeyId;
        this.secretAccessKey = secretAccessKey;
        this.sessionToken = sessionToken;
    }

    /**
     * Sign a request for AWS services
     * @param {Object} options - Request options
     * @param {string} options.method - HTTP method
     * @param {string} options.url - Full URL to sign
     * @param {string} options.region - AWS region
     * @param {string} options.service - AWS service name (e.g., 'lambda')
     * @param {Object} options.headers - Request headers
     * @param {string} options.body - Request body
     * @returns {Object} Signed headers
     */
    async sign(options) {
        const { method, url, region, service, body = '' } = options;
        const urlObj = new URL(url);

        // Current timestamp
        const now = new Date();
        const amzDate = this.toAmzDate(now);
        const dateStamp = amzDate.slice(0, 8);

        // Create canonical request components
        const host = urlObj.host;
        const canonicalUri = urlObj.pathname || '/';
        const canonicalQueryString = this.sortQueryString(urlObj.searchParams);

        // Hash the payload
        const payloadHash = await this.sha256Hex(body);

        // Build headers to sign
        const headers = {
            'host': host,
            'x-amz-date': amzDate,
            'x-amz-content-sha256': payloadHash
        };

        // Add session token if present (for temporary credentials)
        if (this.sessionToken) {
            headers['x-amz-security-token'] = this.sessionToken;
        }

        // Signed headers list
        const signedHeaders = Object.keys(headers).sort().join(';');

        // Create canonical headers string
        const canonicalHeaders = Object.keys(headers)
            .sort()
            .map(key => `${key}:${headers[key]}\n`)
            .join('');

        // Create canonical request
        const canonicalRequest = [
            method.toUpperCase(),
            canonicalUri,
            canonicalQueryString,
            canonicalHeaders,
            signedHeaders,
            payloadHash
        ].join('\n');

        // Create string to sign
        const algorithm = 'AWS4-HMAC-SHA256';
        const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
        const canonicalRequestHash = await this.sha256Hex(canonicalRequest);

        const stringToSign = [
            algorithm,
            amzDate,
            credentialScope,
            canonicalRequestHash
        ].join('\n');

        // Calculate signature
        const signingKey = await this.getSignatureKey(dateStamp, region, service);
        const signature = await this.hmacHex(signingKey, stringToSign);

        // Build authorization header
        const authorizationHeader = [
            `${algorithm} Credential=${this.accessKeyId}/${credentialScope}`,
            `SignedHeaders=${signedHeaders}`,
            `Signature=${signature}`
        ].join(', ');

        // Return headers to include in request
        const signedHeadersObj = {
            'Authorization': authorizationHeader,
            'x-amz-date': amzDate,
            'x-amz-content-sha256': payloadHash
        };

        if (this.sessionToken) {
            signedHeadersObj['x-amz-security-token'] = this.sessionToken;
        }

        return signedHeadersObj;
    }

    /**
     * Format date to AWS amz-date format
     */
    toAmzDate(date) {
        return date.toISOString().replace(/[:-]|\.\d{3}/g, '');
    }

    /**
     * Sort query string parameters
     */
    sortQueryString(searchParams) {
        const params = Array.from(searchParams.entries());
        params.sort((a, b) => a[0].localeCompare(b[0]));
        return params.map(([key, value]) =>
            `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
        ).join('&');
    }

    /**
     * Calculate SHA256 hash and return hex string
     */
    async sha256Hex(message) {
        const encoder = new TextEncoder();
        const data = encoder.encode(message);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        return this.bufferToHex(hashBuffer);
    }

    /**
     * Calculate HMAC-SHA256 and return hex string
     */
    async hmacHex(key, message) {
        const encoder = new TextEncoder();
        const messageData = encoder.encode(message);

        const cryptoKey = await crypto.subtle.importKey(
            'raw',
            key,
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );

        const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
        return this.bufferToHex(signature);
    }

    /**
     * Calculate HMAC-SHA256 and return ArrayBuffer
     */
    async hmac(key, message) {
        const encoder = new TextEncoder();
        const keyData = typeof key === 'string' ? encoder.encode(key) : key;
        const messageData = encoder.encode(message);

        const cryptoKey = await crypto.subtle.importKey(
            'raw',
            keyData,
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );

        return await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    }

    /**
     * Generate signing key
     */
    async getSignatureKey(dateStamp, region, service) {
        const kDate = await this.hmac(`AWS4${this.secretAccessKey}`, dateStamp);
        const kRegion = await this.hmac(kDate, region);
        const kService = await this.hmac(kRegion, service);
        const kSigning = await this.hmac(kService, 'aws4_request');
        return kSigning;
    }

    /**
     * Convert ArrayBuffer to hex string
     */
    bufferToHex(buffer) {
        return Array.from(new Uint8Array(buffer))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }
}

/**
 * Bedrock Lambda Client
 * Calls a Lambda Function URL with IAM authentication
 */
class BedrockLambdaClient {
    constructor(config) {
        this.functionUrl = config.functionUrl;
        this.region = config.region || 'us-east-1';
        this.accessKeyId = config.accessKeyId;
        this.secretAccessKey = config.secretAccessKey;
        this.sessionToken = config.sessionToken || null;

        this.signer = new AWSSignatureV4(
            this.accessKeyId,
            this.secretAccessKey,
            this.sessionToken
        );
    }

    /**
     * Invoke the Lambda function
     * @param {Object} payload - Request payload
     * @returns {Promise<Object>} Response data
     */
    async invoke(payload) {
        const body = JSON.stringify(payload);

        // Sign the request
        const signedHeaders = await this.signer.sign({
            method: 'POST',
            url: this.functionUrl,
            region: this.region,
            service: 'lambda',
            body: body
        });

        // Make the request
        const response = await fetch(this.functionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...signedHeaders
            },
            body: body
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Lambda invocation failed: ${response.status} - ${errorText}`);
        }

        return await response.json();
    }
}

// Export for use in app.js
window.AWSSignatureV4 = AWSSignatureV4;
window.BedrockLambdaClient = BedrockLambdaClient;
