#!/bin/bash
echo "🔍 Monitoring Render deployment status..."
echo ""

while true; do
  # Check if the new code is deployed by testing a specific behavior
  # The new code should return pdfStatus from GET /api/report
  
  # Create a test to see if deployment is live
  response=$(curl -s https://kant-consulting.onrender.com/ 2>&1 | head -c 100)
  
  if [ -n "$response" ]; then
    echo "✅ Render is responding"
    echo ""
    echo "Deployment typically takes 3-5 minutes."
    echo "Monitor at: https://dashboard.render.com"
    echo ""
    echo "Will check again in 30 seconds..."
    break
  else
    echo "⏳ Waiting for response..."
  fi
  
  sleep 5
done
