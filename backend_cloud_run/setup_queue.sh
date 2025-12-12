#!/bin/bash
PROJECT_ID="processai-468612"
LOCATION="us-central1"
QUEUE="process-queue"

echo "Creating Cloud Tasks Queue: $QUEUE..."
gcloud tasks queues create $QUEUE --location=$LOCATION

echo "Updating Queue Limits..."
gcloud tasks queues update $QUEUE --location=$LOCATION --max-dispatches-per-second=10 --max-concurrent-dispatches=50

echo "Queue setup complete."
