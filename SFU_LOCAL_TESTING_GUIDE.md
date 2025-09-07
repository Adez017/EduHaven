# SFU Local Testing Guide

This guide provides step-by-step instructions for testing the SFU (Selective Forwarding Unit) video conferencing implementation on your local machine.

## Prerequisites

- Node.js 18+ installed
- Two or more browser windows/tabs (or different browsers) for multi-user testing
- Webcam and microphone permissions enabled in your browser

## Step 1: Environment Setup

### 1.1 Create Server Environment File

Create a `.env` file in the `/Server` directory:

```bash
cd Server
cp .env.example .env
```

Edit the `.env` file with these minimal settings for testing:

```bash
# Required for SFU functionality
JWT_SECRET=test-secret-key-for-local-development
MEDIASOUP_ANNOUNCED_IP=127.0.0.1

# Optional settings (can be left empty for testing)
MONGODB_URI=
RESEND_KEY=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# CORS for local development
CORS_ORIGIN=http://localhost:5173
```

### 1.2 Install Dependencies

**Server dependencies:**
```bash
cd Server
npm install
```

**Client dependencies:**
```bash
cd Client
npm install
```

## Step 2: Start the Application

### 2.1 Start the Server

In Terminal 1:
```bash
cd Server
npm run dev
```

**Expected output:**
- Server should start on port 3000
- You should see: `"SFU MediaRouter initialized successfully"` in the console
- Socket.IO should initialize

### 2.2 Start the Client

In Terminal 2:
```bash
cd Client
npm run dev
```

**Expected output:**
- Vite dev server should start on `http://localhost:5173`
- Client should compile without errors

## Step 3: Access the SFU Test Page

### Option A: Direct Component Testing

Add the SFU test page to your routing by temporarily adding this route to `Client/src/App.jsx`:

```jsx
// Add this import at the top
import SFUTestPage from "./components/SFUTestPage.jsx";

// Add this route inside the <Routes> element
<Route path="sfu-test" element={<SFUTestPage />} />
```

Then navigate to: `http://localhost:5173/sfu-test`

### Option B: Create a Simple Test Integration

If you prefer not to modify routes, you can test SFU functionality by integrating it into an existing page. The SFU components are designed to be drop-in replacements.

## Step 4: Testing Scenarios

### 4.1 Single User Test

1. **Access the test page**: Navigate to `http://localhost:5173/sfu-test`
2. **Check connection**: Verify the connection status shows "connected" (green dot)
3. **Enable media**: Click "Start Video & Audio" 
   - Grant camera/microphone permissions when prompted
   - You should see your own video feed
4. **Test controls**: 
   - Toggle video on/off
   - Toggle audio on/off
   - Try screen sharing (if implemented)

### 4.2 Multi-User Test (Recommended)

1. **Primary user**: Keep the first browser window open
2. **Secondary user**: Open a new incognito/private window or different browser
3. **Same room**: Navigate to the same URL with the same room ID
4. **Verify connection**: Both users should see each other's video
5. **Test interactions**:
   - Both users should be able to toggle their video/audio
   - Video should remain stable
   - Participant count should show correctly

### 4.3 Scalability Test

1. **Multiple users**: Open 3-5 browser windows/tabs
2. **Join same room**: Use the same room ID for all instances
3. **Verify stability**: All users should see all other users
4. **Performance check**: Videos should remain smooth and stable

## Step 5: Verification Checklist

### Server-Side Verification

Check your server console for these messages:
- ✅ `"SFU MediaRouter initialized successfully"`
- ✅ `"mediasoup Worker created with PID: [number]"`
- ✅ `"Socket [id] joined video room: [roomId]"`
- ✅ `"Created WebRTC transport for [socketId]"`

### Client-Side Verification

In browser developer console, you should see:
- ✅ Socket connection established
- ✅ SFU transport creation successful
- ✅ Media producers/consumers created
- ✅ No WebRTC connection errors

### Browser Network Tab

- ✅ WebSocket connection to `ws://localhost:3000/socket.io/`
- ✅ STUN/TURN server connections (if configured)
- ✅ UDP WebRTC media flows

## Step 6: Performance Comparison

### Test P2P vs SFU Performance

1. **With 2 users**: Both should work similarly
2. **With 3+ users**: SFU should be much more stable
3. **CPU usage**: Check browser task manager - SFU should use less CPU
4. **Network usage**: Monitor network tab - SFU should use less bandwidth per user

### Expected Results

| Participants | P2P Mesh | SFU |
|-------------|----------|-----|
| 2 users | Stable | Stable |
| 3 users | May struggle | Stable |
| 4+ users | Often fails | Stable |
| CPU usage | High | Low |
| Bandwidth | Exponential growth | Linear growth |

## Troubleshooting

### Common Issues

**1. "Connection Failed" Error**
```bash
# Solutions:
- Check if server is running on port 3000
- Verify .env file has JWT_SECRET
- Check CORS_ORIGIN setting
- Restart both server and client
```

**2. "Transport Creation Failed"**
```bash
# Solutions:
- Check MEDIASOUP_ANNOUNCED_IP in .env
- Verify UDP ports 10000-10100 are available
- Check firewall settings
```

**3. "Media Access Denied"**
```bash
# Solutions:
- Enable camera/microphone permissions in browser
- Use HTTPS in production (HTTP is OK for localhost)
- Try different browser
```

**4. "No Video/Audio"**
```bash
# Solutions:
- Check browser developer console for errors
- Verify media devices are not in use by other applications
- Test with different media devices
```

### Debug Mode

Enable debug logging by setting in server console:
```javascript
// In Server/SFU/mediaRouter.js
console.log('Debug: SFU operations');
```

Or add to client:
```javascript
// In browser console
localStorage.setItem('debug', 'mediasoup-client:*');
```

## Advanced Testing

### Testing with Real Network Conditions

1. **Different networks**: Test users on different WiFi networks
2. **Mobile devices**: Test with mobile browsers
3. **Bandwidth limits**: Use browser developer tools to simulate slow connections

### Load Testing

1. **Automated testing**: Use tools like Puppeteer to simulate multiple users
2. **Stress testing**: Gradually increase participants until performance degrades
3. **Long-duration testing**: Keep connections open for extended periods

## Integration with Existing Components

### Replacing P2P Components

To integrate SFU into existing session rooms:

```jsx
// In your existing session/room component
import SFUVideoConference from './hooks/WebRTC/SFUVideoConference.jsx';

// Replace existing WebRTC components with:
<SFUVideoConference 
  socket={socket}
  roomId={sessionId}
  onParticipantUpdate={handleParticipantCount}
/>
```

### Custom Hook Usage

For more control, use the hook directly:

```jsx
import { useSFUConnection } from './hooks/WebRTC/useSFUConnection.jsx';

const { isConnected, enableMedia, toggleVideo, getRemoteVideos } = useSFUConnection(
  socket, 
  roomId, 
  localVideoRef
);
```

## Production Deployment Notes

When ready for production:

1. **Set announced IP**: Update `MEDIASOUP_ANNOUNCED_IP` to your server's public IP
2. **Enable HTTPS**: Required for WebRTC in production
3. **Firewall configuration**: Open UDP ports 10000-10100
4. **STUN/TURN servers**: Configure for NAT traversal
5. **Load balancing**: Consider multiple SFU instances for scale

## Support

If you encounter issues:
1. Check the browser developer console for errors
2. Review server logs for SFU-related messages
3. Verify all dependencies are installed correctly
4. Test with a simple room first before complex scenarios

---

This SFU implementation provides a robust foundation for scalable video conferencing that can handle 20+ participants reliably compared to the previous P2P mesh topology that was limited to 2-4 users.