#!/usr/bin/env bash
# USMAN AI 2.0 - One-Click Cloud Run Deployment Script
# Run this inside Google Cloud Shell or any terminal with gcloud logged in.

set -e

SERVICE_NAME="usman-ai-backend"
REGION="${REGION:-asia-southeast1}"

echo "============================================="
echo " Deploying USMAN AI 2.0 Backend to Cloud Run"
echo "============================================="

# 1. Ensure ELEVENLABS_API_KEY is supplied
if [ -z "$ELEVENLABS_API_KEY" ]; then
  read -sp "Enter your ElevenLabs API Key: " ELEVENLABS_API_KEY
  echo ""
fi

if [ -z "$ELEVENLABS_API_KEY" ]; then
  echo "Error: ELEVENLABS_API_KEY cannot be empty."
  exit 1
fi

echo "Deploying service '$SERVICE_NAME' to region '$REGION'..."

gcloud run deploy "$SERVICE_NAME" \
  --source . \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars ELEVENLABS_API_KEY="$ELEVENLABS_API_KEY",ELEVENLABS_VOICE_ID="EXAVITQu4vr4xnSDxMaL",ELEVENLABS_MODEL_ID="eleven_multilingual_v2"

SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" --region "$REGION" --format 'value(status.url)')

echo ""
echo "============================================================"
echo " Deployment Complete!"
echo " Service URL: $SERVICE_URL"
echo " Health Check: $SERVICE_URL/health"
echo "============================================================"
echo "Now copy this Service URL and paste it into USMAN AI 2.0"
echo "Settings -> Secure Backend Proxy URL"
echo "============================================================"
