# SFU Video Conferencing Setup Guide

Quick setup guide for the SFU (Selective Forwarding Unit) video conferencing implementation.

## Quick Start

### 1. Install Dependencies

**Server:**
```bash
cd Server
npm install mediasoup
```

**Client:**
```bash
cd Client
npm install mediasoup-client
```

### 2. Environment Configuration

Create `/Server/.env` file:
```bash
# Basic configuration for SFU
JWT_SECRET=your_jwt_secret_here
MEDIASOUP_ANNOUNCED_IP=127.0.0.1

# Optional: Leave empty for local development
MONGODB_URI=
RESEND_KEY=
CLOUDINARY_CLOUD_NAME=
```

### 3. Start the Application

**Terminal 1 - Server:**
```bash
cd Server
npm run dev
```

**Terminal 2 - Client:**
```bash
cd Client
npm run dev
```

### 4. Test Video Conference

1. Open browser to `http://localhost:5173`
2. Navigate to a room or session with video functionality
3. Use the new SFU video conference component

## Usage in Components

### Replace P2P Implementation

**Old (P2P Mesh):**
```jsx
import UseConnectToSocketServer from './hooks/WebRTC/UseSocketService.jsx'
import { UseMediaHandlers } from './hooks/WebRTC/UseMediaHandlers.jsx'
import WebRTCConnection from './hooks/WebRTC/WebRTCConnection.jsx'
```

**New (SFU):**
```jsx
import SFUVideoConference from './hooks/WebRTC/SFUVideoConference.jsx'

function VideoRoom({ socket, roomId }) {
  return (
    <SFUVideoConference 
      socket={socket}
      roomId={roomId}
      onParticipantUpdate={(count) => console.log(`${count} participants`)}
    />
  )
}
```

### Custom Hook Usage

```jsx
import { useSFUConnection } from './hooks/WebRTC/useSFUConnection.jsx'

function MyVideoComponent({ socket, roomId }) {
  const localVideoRef = useRef(null)
  const {
    isConnected,
    enableMedia,
    toggleVideo,
    toggleAudio,
    getRemoteVideos,
    leave
  } = useSFUConnection(socket, roomId, localVideoRef)

  return (
    <div>
      <video ref={localVideoRef} autoPlay muted />
      <button onClick={() => enableMedia()}>Start Video</button>
      <button onClick={toggleVideo}>Toggle Video</button>
      <button onClick={leave}>Leave</button>
      
      {getRemoteVideos().map(video => (
        <video 
          key={video.socketId} 
          srcObject={video.stream} 
          autoPlay 
        />
      ))}
    </div>
  )
}
```

## Key Benefits vs P2P

| Feature | P2P Mesh | SFU |
|---------|----------|-----|
| Max Users | 2-4 stable | 20+ stable |
| Bandwidth | O(N²) | O(N) |
| CPU Usage | High | Low |
| Connection Stability | Poor with >2 users | Stable |

## Production Deployment

### Server Configuration

1. **Set announced IP** (your server's public IP):
   ```bash
   MEDIASOUP_ANNOUNCED_IP=your-server-public-ip
   ```

2. **Open firewall ports**:
   - HTTP/HTTPS: 80, 443
   - WebRTC UDP: 10000-10100

3. **Use HTTPS** (required for WebRTC in production)

### Docker Deployment (Optional)

```dockerfile
# Server Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
EXPOSE 10000-10100/udp
CMD ["npm", "start"]
```

## Troubleshooting

### Common Issues

1. **"Transport connection timeout"**
   - Check MEDIASOUP_ANNOUNCED_IP
   - Verify firewall UDP ports 10000-10100

2. **"Failed to enable media"**
   - Check browser permissions for camera/mic
   - Ensure HTTPS in production

3. **Server startup errors**
   - Verify Node.js version 18+
   - Check `.env` file configuration

### Debug Mode

Enable detailed logging:
```javascript
// In /Server/SFU/mediaRouter.js
this.workerSettings = {
  logLevel: 'debug', // Change from 'warn'
  // ...
}
```

## Migration from P2P

### Gradual Migration

Both P2P and SFU can coexist:
- P2P events: `join-call`, `signal`, `user-joined`
- SFU events: `join-video-room`, `create-transport`, etc.

### Component Updates

1. Keep existing components working
2. Add new SFU components alongside
3. Gradually migrate users to SFU
4. Remove P2P once migration complete

---

For detailed documentation, see [SFU_IMPLEMENTATION_GUIDE.md](./SFU_IMPLEMENTATION_GUIDE.md)