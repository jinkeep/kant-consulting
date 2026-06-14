#!/usr/bin/env node

const https = require('https');
const http = require('http');

const proxy = process.env.HTTP_PROXY || process.env.http_proxy;

function request(url) {
  return new Promise((resolve) => {
    const urlObj = new URL(url);
    
    if (proxy) {
      const proxyUrl = new URL(proxy);
      const options = {
        host: proxyUrl.hostname,
        port: proxyUrl.port,
        path: url,
        method: 'GET',
        headers: { Host: urlObj.hostname },
      };
      
      http.get(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
      }).on('error', () => resolve(null));
    } else {
      https.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
      }).on('error', () => resolve(null));
    }
  });
}

(async () => {
  console.log('🔍 Advanced deployment check...\n');
  
  const apiRes = await request('https://kant-consulting.onrender.com/api/report');
  if (apiRes) {
    try {
      const json = JSON.parse(apiRes.body);
      console.log('📊 API Response structure:');
      console.log('   - Keys:', Object.keys(json).join(', '));
      console.log('   - Has pdfStatus:', 'pdfStatus' in json);
      console.log('   - Has pdfUrl:', 'pdfUrl' in json);
      
      if ('pdfStatus' in json) {
        console.log('\n✅ NEW DEPLOYMENT IS LIVE!');
        process.exit(0);
      } else {
        console.log('\n⏳ Old deployment (missing pdfStatus field)');
        process.exit(1);
      }
    } catch (e) {
      console.log('⚠️  API response not JSON');
      process.exit(1);
    }
  } else {
    console.log('❌ Could not reach API');
    process.exit(1);
  }
})();
