#!/bin/bash

# SFU Local Setup Script
# This script helps set up the SFU video conferencing for local testing

echo "🚀 Setting up SFU Video Conferencing for Local Testing"
echo "=============================================="

# Check if we're in the right directory
if [ ! -d "Server" ] || [ ! -d "Client" ]; then
    echo "❌ Error: Please run this script from the EduHaven root directory"
    exit 1
fi

echo "📁 Setting up Server environment..."

# Create .env file for server if it doesn't exist
if [ ! -f "Server/.env" ]; then
    echo "📝 Creating Server/.env file..."
    cat > Server/.env << EOF
# SFU Configuration for Local Testing
JWT_SECRET=test-secret-key-for-local-development
MEDIASOUP_ANNOUNCED_IP=127.0.0.1

# CORS for local development
CORS_ORIGIN=http://localhost:5173

# Optional settings (can be left empty for testing)
MONGODB_URI=
RESEND_KEY=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
Activation_Secret=test-activation-secret
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=
TOKEN_EXPIRY=1d
REFRESH_TOKEN_EXPIRY=7d
EOF
    echo "✅ Server/.env created"
else
    echo "✅ Server/.env already exists"
fi

echo "📦 Installing dependencies..."

# Install server dependencies
echo "📦 Installing server dependencies..."
cd Server
npm install
if [ $? -ne 0 ]; then
    echo "❌ Failed to install server dependencies"
    exit 1
fi
cd ..

# Install client dependencies
echo "📦 Installing client dependencies..."
cd Client
npm install
if [ $? -ne 0 ]; then
    echo "❌ Failed to install client dependencies"
    exit 1
fi
cd ..

echo ""
echo "🎉 Setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Start the server: cd Server && npm run dev"
echo "2. Start the client: cd Client && npm run dev"
echo "3. Open browser to: http://localhost:5173/sfu-test"
echo ""
echo "📖 For detailed testing instructions, see: SFU_LOCAL_TESTING_GUIDE.md"
echo ""
echo "🔧 Troubleshooting:"
echo "- Make sure ports 3000 (server) and 5173 (client) are available"
echo "- Grant camera/microphone permissions when prompted"
echo "- Use multiple browser windows to test multi-user functionality"