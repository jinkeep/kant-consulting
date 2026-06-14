#!/usr/bin/env node

// Try multiple detection methods

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
  
  // Check 1: Test API response structure
  const apiRes = await request('https://kant-consulting.onrender.com/api/report');
  if (apiRes) {
    try {
      const json = JSON.parse(apiRes.body);
      console.log('📊 API Response structure:');
      console.log('   - Keys:', Object.keys(json).join(', '));
      console.log('   - Has pdfStatus:', 'pdfStatus' in json);
      console.log('   - Has pdfUrl:', 'pdfUrl' in json);
    } catch (e) {
      console.log('⚠️  API response not JSON:', apiRes.body.substring(0, 100));
    }
  }
  
  // Check 2: Look for deployment headers
  console.log('\n📋 Response headers:');
  if (apiRes?.headers) {
    Object.entries(apiRes.headers)
      .filter(([k]) => k.toLowerCase().includes('render') || k.toLowerCase().includes('deploy') || k === 'x-powered-by')
      .forEach(([k, v]) => console.log(`   ${k}: ${v}`));
  }
  
  // Check 3: Test homepage for any build info
  const homeRes = await request('https://kant-consulting.onrender.com/');
  if (homeRes) {
    const hasBuildId = homeRes.body.includes('buildId') || homeRes.body.includes('BUILD_ID');
    console.log('\n🏠 Homepage check:');
    console.log('   - Has build ID:', hasBuildId);
    console.log('   - Status:', homeRes.status);
  }
  
  console.log('\n' + (apiRes && 'pdfStatus' in JSON.parse(apiRes.body) ? '✅ NEW DEPLOYMENT DETECTED' : '⏳ OLD DEPLOYMENT STILL ACTIVE'));
})();
