#!/bin/bash

echo "🔍 Checking deployment status..."
echo ""

# Check if we can reach the site
echo "1️⃣ Site reachability:"
curl -s -o /dev/null -w "   Status: %{http_code}\n" https://kant-consulting.onrender.com/

# Check API response
echo ""
echo "2️⃣ API Response:"
response=$(curl -s https://kant-consulting.onrender.com/api/report)
echo "$response" | jq -r 'if .pdfStatus then "   ✅ Has pdfStatus field - NEW DEPLOYMENT" elif .error then "   ⏳ Returns error (unauthenticated) - OLD DEPLOYMENT" else "   ⏳ No pdfStatus field - OLD DEPLOYMENT" end'

# Show the actual keys returned
echo ""
echo "3️⃣ Response keys:"
echo "$response" | jq -r 'keys | "   " + (. | join(", "))'

echo ""
echo "📋 Summary:"
if echo "$response" | jq -e '.pdfStatus' > /dev/null 2>&1; then
  echo "   Status: ✅ NEW DEPLOYMENT IS LIVE"
  echo "   Next: Run 'node test-background-pdf.mjs' to verify end-to-end flow"
else
  echo "   Status: ⏳ OLD DEPLOYMENT STILL ACTIVE"
  echo "   Reason: Response missing pdfStatus field"
  echo "   Action: Check Render dashboard for deployment status/logs"
fi
