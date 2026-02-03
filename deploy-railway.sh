#!/bin/bash
# Railway deployment script for MediSeen HMS Backend

echo "Building TypeScript..."
npm run build

echo "Generating Prisma client..."
npx prisma generate

echo "Pushing database schema..."
npx prisma db push --accept-data-loss

echo "Starting server..."
npm run start
