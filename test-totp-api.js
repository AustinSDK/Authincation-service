/**
 * Simple test script to verify the TOTP generation API endpoint works
 * This simulates the request that would come from the frontend
 */

const http = require('http');

// This would normally be sent from the browser with a valid auth cookie
// For testing, we'll just verify the endpoint responds correctly
function testTotpEndpoint() {
    const postData = JSON.stringify({});
    
    const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/user/generate-totp',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    };
    
    const req = http.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
            data += chunk;
        });
        
        res.on('end', () => {
            console.log('Status Code:', res.statusCode);
            console.log('Response Headers:', res.headers);
            
            try {
                const result = JSON.parse(data);
                
                if (res.statusCode === 401) {
                    console.log('✓ Endpoint exists and requires authentication (expected)');
                    console.log('Response:', result);
                } else if (res.statusCode === 200) {
                    console.log('✓ Endpoint returned success');
                    console.log('QR Code length:', result.qrCode ? result.qrCode.length : 'N/A');
                    console.log('Has otpauth URL:', !!result.otpauthUrl);
                    console.log('Has secret:', !!result.secret);
                } else {
                    console.log('Response:', result);
                }
            } catch (e) {
                console.log('Raw response:', data);
            }
        });
    });
    
    req.on('error', (e) => {
        console.error('Request error:', e.message);
    });
    
    req.write(postData);
    req.end();
}

console.log('Testing TOTP generation endpoint...');
testTotpEndpoint();
