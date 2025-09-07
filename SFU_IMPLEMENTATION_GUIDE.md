# SFU Video Conferencing Implementation

This document explains the implementation of the Selective Forwarding Unit (SFU) architecture that replaces the previous P2P mesh setup for video conferencing in EduHaven.

## Overview

### What is an SFU?

A Selective Forwarding Unit (SFU) is a media server that acts as a central relay for video/audio streams. Instead of each participant connecting directly to every other participant (mesh topology), all participants connect to the SFU server, which forwards the streams efficiently.

### Why SFU over P2P Mesh?

| Aspect | P2P Mesh | SFU |
|--------|----------|-----|
| **Scalability** | Poor (O(N²) connections) | Good (O(N) connections) |
| **Bandwidth** | High (each peer uploads N-1 streams) | Low (each peer uploads 1 stream) |
| **CPU Usage** | High (multiple encoding/decoding) | Low (single encoding per participant) |
| **Stability** | Decreases with participants | Remains stable |
| **Max Participants** | ~4-6 users | 50+ users |

## Architecture Components

### Server-Side Components

#### 1. MediaRouter (`/Server/SFU/mediaRouter.js`)
- **Purpose**: Core SFU functionality using mediasoup
- **Features**:
  - Worker and router management
  - Transport creation (WebRTC connections)
  - Producer/consumer lifecycle management
  - Room management and cleanup

#### 2. SFU Handlers (`/Server/SFU/sfuHandlers.js`)
- **Purpose**: Socket.IO event handlers for SFU operations
- **Events Handled**:
  - `join-video-room`: Join a video session
  - `leave-video-room`: Leave a video session
  - `create-transport`: Create WebRTC transport
  - `connect-transport`: Connect WebRTC transport
  - `create-producer`: Start sending media
  - `create-consumer`: Start receiving media

#### 3. Updated Socket Configuration (`/Server/Socket/socket.js`)
- **Changes**: Integrated SFU handlers alongside existing room operations
- **Maintains**: Backward compatibility with existing features

### Client-Side Components

#### 1. SFUConnection (`/Client/src/hooks/WebRTC/sfuConnection.js`)
- **Purpose**: Core SFU client implementation
- **Features**:
  - mediasoup-client Device management
  - Transport management (send/receive)
  - Producer/consumer lifecycle
  - Stream management and callbacks

#### 2. useSFUConnection Hook (`/Client/src/hooks/WebRTC/useSFUConnection.jsx`)
- **Purpose**: React hook for SFU connection management
- **Features**:
  - State management for connection status
  - Media control functions
  - Stream updates and callbacks
  - Error handling

#### 3. SFUVideoConference Component (`/Client/src/hooks/WebRTC/SFUVideoConference.jsx`)
- **Purpose**: UI component for SFU video conferencing
- **Features**:
  - Video/audio controls
  - Screen sharing
  - Participant management
  - Connection status display

## Implementation Details

### Media Flow

1. **Joining a Room**:
   ```
   Client → Socket.IO → join-video-room
   Server → MediaRouter → Create router for room
   Server → Client → router capabilities
   Client → Create mediasoup Device
   ```

2. **Starting Media Production**:
   ```
   Client → getUserMedia() → Local stream
   Client → Socket.IO → create-transport (send)
   Server → MediaRouter → Create WebRTC transport
   Client → Create producer → Send media to SFU
   ```

3. **Consuming Remote Media**:
   ```
   Server → Notify new producer available
   Client → Socket.IO → create-consumer
   Server → MediaRouter → Create consumer
   Client → Receive remote stream
   ```

### Key Classes and Methods

#### MediaRouter (Server)
```javascript
// Core methods
await mediaRouter.initialize()
await mediaRouter.createWebRtcTransport(roomId, peerId, direction)
await mediaRouter.createProducer(transportId, rtpParameters, kind)
await mediaRouter.createConsumer(transportId, producerId, rtpCapabilities)
```

#### SFUConnection (Client)
```javascript
// Usage
const sfu = new SFUConnection(socket, roomId)
await sfu.join()
await sfu.produceMedia(mediaStream)
sfu.onStreamUpdate = (streams) => { /* handle remote streams */ }
```

#### useSFUConnection Hook (React)
```javascript
// Hook usage
const {
  isConnected,
  enableMedia,
  toggleVideo,
  toggleAudio,
  getRemoteVideos,
  leave
} = useSFUConnection(socket, roomId, localVideoRef)
```

## Setup and Configuration

### Prerequisites

- Node.js 18+ (for mediasoup compatibility)
- Modern browser with WebRTC support
- Network configuration for WebRTC (STUN/TURN servers)

### Installation

1. **Server Dependencies**:
   ```bash
   cd Server
   npm install mediasoup
   ```

2. **Client Dependencies**:
   ```bash
   cd Client
   npm install mediasoup-client
   ```

### Environment Configuration

Add to `/Server/.env`:
```bash
# MediaSoup SFU Configuration
MEDIASOUP_ANNOUNCED_IP=127.0.0.1  # Use your server's public IP in production
```

### Development Setup

1. **Start the Server**:
   ```bash
   cd Server
   npm run dev
   ```

2. **Start the Client**:
   ```bash
   cd Client
   npm run dev
   ```

3. **Access the Application**:
   - Open browser to `http://localhost:5173`
   - Join a video room to test SFU functionality

## Usage Examples

### Basic Video Conference

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

### Custom Implementation

```jsx
import { useSFUConnection } from './hooks/WebRTC/useSFUConnection.jsx'

function CustomVideoComponent({ socket, roomId }) {
  const localVideoRef = useRef(null)
  const {
    isConnected,
    enableMedia,
    getRemoteVideos
  } = useSFUConnection(socket, roomId, localVideoRef)

  const startVideo = async () => {
    try {
      await enableMedia({ video: true, audio: true })
    } catch (error) {
      console.error('Failed to start video:', error)
    }
  }

  return (
    <div>
      <video ref={localVideoRef} autoPlay muted />
      <button onClick={startVideo}>Start Video</button>
      {getRemoteVideos().map(video => (
        <video key={video.socketId} srcObject={video.stream} autoPlay />
      ))}
    </div>
  )
}
```

## Production Deployment

### Server Configuration

1. **Configure Announced IP**:
   ```bash
   MEDIASOUP_ANNOUNCED_IP=your-server-public-ip
   ```

2. **Firewall Rules**:
   - Open TCP ports for HTTP/HTTPS
   - Open UDP port range 10000-10100 for WebRTC media

3. **TURN Server** (optional but recommended):
   ```javascript
   // In mediaRouter.js webRtcTransportOptions
   listenIps: [
     {
       ip: '0.0.0.0',
       announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP,
     },
   ],
   ```

### Client Considerations

- **HTTPS Required**: WebRTC requires HTTPS in production
- **Browser Support**: Modern browsers support mediasoup-client
- **Network Requirements**: Good internet connection for all participants

### Performance Optimization

1. **Video Quality Settings**:
   ```javascript
   // Adjust in mediaRouter.js mediaCodecs
   parameters: {
     'x-google-start-bitrate': 1000, // Start with lower bitrate
   }
   ```

2. **Participant Limits**:
   - Monitor server CPU/memory usage
   - Consider horizontal scaling for large deployments

## Troubleshooting

### Common Issues

1. **Connection Failures**:
   - Check MEDIASOUP_ANNOUNCED_IP configuration
   - Verify firewall settings
   - Ensure HTTPS in production

2. **Audio/Video Not Working**:
   - Check browser permissions
   - Verify getUserMedia() works
   - Check network connectivity

3. **High CPU Usage**:
   - Monitor mediasoup worker processes
   - Consider reducing video quality
   - Scale horizontally if needed

### Debug Mode

Enable debug logging:
```javascript
// In mediaRouter.js
this.workerSettings = {
  logLevel: 'debug', // Change from 'warn'
  // ...
}
```

### Health Monitoring

Monitor SFU health:
```javascript
// Example health check
app.get('/health/sfu', (req, res) => {
  res.json({
    workers: mediaRouter.workers.length,
    rooms: mediaRouter.rooms.size,
    producers: mediaRouter.producers.size,
    consumers: mediaRouter.consumers.size
  })
})
```

## Migration from P2P

### For Existing Components

The new SFU implementation maintains compatibility with existing video components:

1. **VideoConferenceView**: No changes needed
2. **Media Controls**: Same interface, different backend
3. **Socket Events**: Existing room events still work

### Backward Compatibility

The old P2P implementation (`join-call`, `signal` events) remains available for gradual migration.

## Future Enhancements

- **Simulcast**: Multiple video qualities per participant
- **SVC**: Scalable Video Coding for better quality adaptation
- **Recording**: Server-side recording capabilities
- **Broadcasting**: RTMP streaming for live broadcasts
- **Analytics**: Detailed connection and quality metrics

---

This SFU implementation provides a robust, scalable foundation for video conferencing that can handle many participants while maintaining good performance and stability.