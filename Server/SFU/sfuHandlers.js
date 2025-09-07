/**
 * sfuHandlers.js
 * 
 * Socket.IO event handlers for SFU-based video conferencing.
 * Replaces the P2P WebRTC signaling with mediasoup SFU signaling.
 * 
 * This module handles:
 * - Room joining/leaving for video sessions
 * - Transport creation and connection
 * - Producer and consumer management
 * - Media routing coordination
 */

const handleSFUOperations = (socket, io, mediaRouter) => {
  console.log(`Setting up SFU handlers for socket ${socket.id}`);

  // Join a video room
  socket.on('join-video-room', async (data) => {
    try {
      const { roomId } = data;
      const peerId = socket.id;

      console.log(`Peer ${peerId} joining video room ${roomId}`);

      // Join socket room for signaling
      socket.join(`video-${roomId}`);

      // Get router capabilities for this room
      const routerCapabilities = await mediaRouter.getRouterCapabilities(roomId);

      // Get existing producers in the room
      const existingProducers = await mediaRouter.getRoomProducers(roomId, peerId);

      socket.emit('video-room-joined', {
        routerCapabilities,
        existingProducers,
      });

      // Notify other peers about new participant
      socket.to(`video-${roomId}`).emit('new-peer-joined', {
        peerId,
      });

      console.log(`Peer ${peerId} successfully joined video room ${roomId}`);
    } catch (error) {
      console.error('Error joining video room:', error);
      socket.emit('video-room-error', {
        error: 'Failed to join video room',
        details: error.message,
      });
    }
  });

  // Leave a video room
  socket.on('leave-video-room', async (data) => {
    try {
      const { roomId } = data;
      const peerId = socket.id;

      console.log(`Peer ${peerId} leaving video room ${roomId}`);

      // Leave socket room
      socket.leave(`video-${roomId}`);

      // Clean up peer resources in mediaRouter
      await mediaRouter.leavePeer(peerId, roomId);

      // Notify other peers about peer leaving
      socket.to(`video-${roomId}`).emit('peer-left', {
        peerId,
      });

      socket.emit('video-room-left', { roomId });

      console.log(`Peer ${peerId} successfully left video room ${roomId}`);
    } catch (error) {
      console.error('Error leaving video room:', error);
      socket.emit('video-room-error', {
        error: 'Failed to leave video room',
        details: error.message,
      });
    }
  });

  // Create WebRTC transport
  socket.on('create-transport', async (data) => {
    try {
      const { roomId, direction } = data; // direction: 'send' or 'recv'
      const peerId = socket.id;

      console.log(`Creating ${direction} transport for peer ${peerId} in room ${roomId}`);

      const transportParams = await mediaRouter.createWebRtcTransport(
        roomId,
        peerId,
        direction
      );

      socket.emit('transport-created', {
        direction,
        transportParams,
      });

      console.log(`Transport created for peer ${peerId}, direction: ${direction}`);
    } catch (error) {
      console.error('Error creating transport:', error);
      socket.emit('transport-error', {
        error: 'Failed to create transport',
        details: error.message,
      });
    }
  });

  // Connect transport
  socket.on('connect-transport', async (data) => {
    try {
      const { transportId, dtlsParameters } = data;

      console.log(`Connecting transport ${transportId}`);

      await mediaRouter.connectTransport(transportId, dtlsParameters);

      socket.emit('transport-connected', { transportId });

      console.log(`Transport ${transportId} connected successfully`);
    } catch (error) {
      console.error('Error connecting transport:', error);
      socket.emit('transport-error', {
        error: 'Failed to connect transport',
        details: error.message,
      });
    }
  });

  // Create producer (send media)
  socket.on('create-producer', async (data) => {
    try {
      const { transportId, kind, rtpParameters, roomId } = data;
      const peerId = socket.id;

      console.log(`Creating ${kind} producer for peer ${peerId}`);

      const producerInfo = await mediaRouter.createProducer(
        transportId,
        rtpParameters,
        kind
      );

      socket.emit('producer-created', {
        id: producerInfo.id,
        kind,
      });

      // Notify other peers in the room about the new producer
      socket.to(`video-${roomId}`).emit('new-producer-available', {
        peerId,
        producerId: producerInfo.id,
        kind,
      });

      console.log(`Producer ${producerInfo.id} created for peer ${peerId}`);
    } catch (error) {
      console.error('Error creating producer:', error);
      socket.emit('producer-error', {
        error: 'Failed to create producer',
        details: error.message,
      });
    }
  });

  // Create consumer (receive media)
  socket.on('create-consumer', async (data) => {
    try {
      const { transportId, producerId, rtpCapabilities } = data;
      const peerId = socket.id;

      console.log(`Creating consumer for peer ${peerId}, producer ${producerId}`);

      const consumerInfo = await mediaRouter.createConsumer(
        transportId,
        producerId,
        rtpCapabilities
      );

      socket.emit('consumer-created', consumerInfo);

      console.log(`Consumer ${consumerInfo.id} created for peer ${peerId}`);
    } catch (error) {
      console.error('Error creating consumer:', error);
      socket.emit('consumer-error', {
        error: 'Failed to create consumer',
        details: error.message,
      });
    }
  });

  // Resume consumer
  socket.on('resume-consumer', async (data) => {
    try {
      const { consumerId } = data;

      console.log(`Resuming consumer ${consumerId}`);

      await mediaRouter.resumeConsumer(consumerId);

      socket.emit('consumer-resumed', { consumerId });

      console.log(`Consumer ${consumerId} resumed successfully`);
    } catch (error) {
      console.error('Error resuming consumer:', error);
      socket.emit('consumer-error', {
        error: 'Failed to resume consumer',
        details: error.message,
      });
    }
  });

  // Pause consumer
  socket.on('pause-consumer', async (data) => {
    try {
      const { consumerId } = data;

      console.log(`Pausing consumer ${consumerId}`);

      await mediaRouter.pauseConsumer(consumerId);

      socket.emit('consumer-paused', { consumerId });

      console.log(`Consumer ${consumerId} paused successfully`);
    } catch (error) {
      console.error('Error pausing consumer:', error);
      socket.emit('consumer-error', {
        error: 'Failed to pause consumer',
        details: error.message,
      });
    }
  });

  // Close producer
  socket.on('close-producer', async (data) => {
    try {
      const { producerId, roomId } = data;
      const peerId = socket.id;

      console.log(`Closing producer ${producerId} for peer ${peerId}`);

      await mediaRouter.closeProducer(producerId);

      // Notify other peers about producer closing
      socket.to(`video-${roomId}`).emit('producer-closed', {
        peerId,
        producerId,
      });

      socket.emit('producer-closed', { producerId });

      console.log(`Producer ${producerId} closed successfully`);
    } catch (error) {
      console.error('Error closing producer:', error);
      socket.emit('producer-error', {
        error: 'Failed to close producer',
        details: error.message,
      });
    }
  });

  // Handle disconnect - cleanup resources
  socket.on('disconnect', async () => {
    try {
      const peerId = socket.id;
      console.log(`Peer ${peerId} disconnected, cleaning up resources`);

      // Get all rooms this peer was in
      const socketRooms = Array.from(socket.rooms).filter(room => 
        room.startsWith('video-') && room !== socket.id
      );

      // Clean up peer from all video rooms
      for (const socketRoom of socketRooms) {
        const roomId = socketRoom.replace('video-', '');
        await mediaRouter.leavePeer(peerId, roomId);
        
        // Notify other peers
        socket.to(socketRoom).emit('peer-left', { peerId });
      }

      console.log(`Cleanup completed for peer ${peerId}`);
    } catch (error) {
      console.error('Error during disconnect cleanup:', error);
    }
  });

  // Listen for new producer events from mediaRouter
  mediaRouter.on('newProducer', (data) => {
    const { roomId, peerId, producerId, kind } = data;
    
    // Don't notify the producer peer themselves
    socket.to(`video-${roomId}`).emit('new-producer-available', {
      peerId,
      producerId,
      kind,
    });
  });
};

export { handleSFUOperations };