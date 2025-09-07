/**
 * sfuConnection.js
 * 
 * SFU-based WebRTC connection manager for video conferencing.
 * Replaces the P2P mesh approach with a Selective Forwarding Unit architecture.
 * 
 * This module handles:
 * - Single producer connection to SFU server
 * - Multiple consumer connections for receiving other participants' streams
 * - Transport management for sending and receiving media
 * - Producer/consumer lifecycle management
 */

export class SFUConnection {
  constructor(socket, roomId) {
    this.socket = socket;
    this.roomId = roomId;
    this.device = null;
    this.sendTransport = null;
    this.recvTransport = null;
    this.producers = new Map(); // kind -> producer
    this.consumers = new Map(); // consumerId -> consumer
    this.remoteStreams = new Map(); // peerId -> { video?: stream, audio?: stream }
    
    this.onStreamUpdate = null; // Callback for stream updates
    
    this.setupSocketListeners();
  }

  setupSocketListeners() {
    // Room joined successfully
    this.socket.on('video-room-joined', async (data) => {
      try {
        const { routerCapabilities, existingProducers } = data;
        console.log('Joined video room, router capabilities:', routerCapabilities);
        
        await this.initializeDevice(routerCapabilities);
        await this.createTransports();
        
        // Consume existing producers
        for (const producer of existingProducers) {
          await this.consumeProducer(producer);
        }
        
        console.log('SFU connection initialized successfully');
      } catch (error) {
        console.error('Error initializing SFU connection:', error);
      }
    });

    // New producer available from another peer
    this.socket.on('new-producer-available', async (data) => {
      try {
        const { peerId, producerId, kind } = data;
        console.log(`New ${kind} producer available from peer ${peerId}`);
        
        await this.consumeProducer({ id: producerId, peerId, kind });
      } catch (error) {
        console.error('Error consuming new producer:', error);
      }
    });

    // Producer closed by another peer
    this.socket.on('producer-closed', (data) => {
      const { peerId, producerId } = data;
      console.log(`Producer ${producerId} closed by peer ${peerId}`);
      
      // Find and close the corresponding consumer
      for (const [consumerId, consumerInfo] of this.consumers) {
        if (consumerInfo.producerId === producerId) {
          this.closeConsumer(consumerId);
          break;
        }
      }
    });

    // Peer left the room
    this.socket.on('peer-left', (data) => {
      const { peerId } = data;
      console.log(`Peer ${peerId} left the room`);
      
      // Remove all streams from this peer
      this.remoteStreams.delete(peerId);
      this.notifyStreamUpdate();
      
      // Close consumers from this peer
      for (const [consumerId, consumerInfo] of this.consumers) {
        if (consumerInfo.peerId === peerId) {
          this.closeConsumer(consumerId);
        }
      }
    });

    // Transport creation responses
    this.socket.on('transport-created', async (data) => {
      try {
        const { direction, transportParams } = data;
        console.log(`Transport created for direction: ${direction}`);
        
        if (direction === 'send') {
          await this.connectSendTransport(transportParams);
        } else if (direction === 'recv') {
          await this.connectRecvTransport(transportParams);
        }
      } catch (error) {
        console.error('Error handling transport creation:', error);
      }
    });

    // Producer creation responses
    this.socket.on('producer-created', (data) => {
      const { id, kind } = data;
      console.log(`Producer created: ${kind} producer ${id}`);
    });

    // Consumer creation responses
    this.socket.on('consumer-created', async (data) => {
      try {
        const { id, producerId, kind, rtpParameters } = data;
        console.log(`Consumer created: ${kind} consumer ${id}`);
        
        const consumer = await this.recvTransport.consume({
          id,
          producerId,
          kind,
          rtpParameters,
        });

        this.consumers.set(id, {
          consumer,
          producerId,
          kind,
          peerId: this.getPeerIdByProducerId(producerId),
        });

        // Resume the consumer
        this.socket.emit('resume-consumer', { consumerId: id });

        // Handle the consumer's track
        this.handleConsumerTrack(consumer, this.getPeerIdByProducerId(producerId));
        
      } catch (error) {
        console.error('Error handling consumer creation:', error);
      }
    });

    // Error handlers
    this.socket.on('video-room-error', (data) => {
      console.error('Video room error:', data);
    });

    this.socket.on('transport-error', (data) => {
      console.error('Transport error:', data);
    });

    this.socket.on('producer-error', (data) => {
      console.error('Producer error:', data);
    });

    this.socket.on('consumer-error', (data) => {
      console.error('Consumer error:', data);
    });
  }

  async initializeDevice(routerCapabilities) {
    try {
      // Import mediasoup-client Device
      const mediasoupClient = await import('mediasoup-client');
      this.device = new mediasoupClient.Device();
      
      await this.device.load({ routerRtpCapabilities: routerCapabilities });
      console.log('Device loaded with router capabilities');
    } catch (error) {
      console.error('Error loading device:', error);
      throw error;
    }
  }

  async createTransports() {
    try {
      // Create send transport
      this.socket.emit('create-transport', {
        roomId: this.roomId,
        direction: 'send',
      });

      // Create receive transport
      this.socket.emit('create-transport', {
        roomId: this.roomId,
        direction: 'recv',
      });
    } catch (error) {
      console.error('Error creating transports:', error);
      throw error;
    }
  }

  async connectSendTransport(transportParams) {
    try {
      this.sendTransport = this.device.createSendTransport(transportParams);

      this.sendTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
        try {
          this.socket.emit('connect-transport', {
            transportId: transportParams.id,
            dtlsParameters,
          });
          
          // Wait for connection confirmation
          const connectionPromise = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Transport connection timeout')), 10000);
            
            this.socket.once('transport-connected', (data) => {
              clearTimeout(timeout);
              if (data.transportId === transportParams.id) {
                resolve();
              }
            });
            
            this.socket.once('transport-error', (error) => {
              clearTimeout(timeout);
              reject(error);
            });
          });
          
          await connectionPromise;
          callback();
        } catch (error) {
          errback(error);
        }
      });

      this.sendTransport.on('produce', async ({ kind, rtpParameters }, callback, errback) => {
        try {
          this.socket.emit('create-producer', {
            transportId: transportParams.id,
            kind,
            rtpParameters,
            roomId: this.roomId,
          });

          // Wait for producer creation confirmation
          const producerPromise = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Producer creation timeout')), 10000);
            
            this.socket.once('producer-created', (data) => {
              clearTimeout(timeout);
              if (data.kind === kind) {
                resolve(data);
              }
            });
            
            this.socket.once('producer-error', (error) => {
              clearTimeout(timeout);
              reject(error);
            });
          });

          const producerData = await producerPromise;
          callback({ id: producerData.id });
        } catch (error) {
          errback(error);
        }
      });

      console.log('Send transport connected');
    } catch (error) {
      console.error('Error connecting send transport:', error);
      throw error;
    }
  }

  async connectRecvTransport(transportParams) {
    try {
      this.recvTransport = this.device.createRecvTransport(transportParams);

      this.recvTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
        try {
          this.socket.emit('connect-transport', {
            transportId: transportParams.id,
            dtlsParameters,
          });
          
          // Wait for connection confirmation
          const connectionPromise = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Transport connection timeout')), 10000);
            
            this.socket.once('transport-connected', (data) => {
              clearTimeout(timeout);
              if (data.transportId === transportParams.id) {
                resolve();
              }
            });
            
            this.socket.once('transport-error', (error) => {
              clearTimeout(timeout);
              reject(error);
            });
          });
          
          await connectionPromise;
          callback();
        } catch (error) {
          errback(error);
        }
      });

      console.log('Receive transport connected');
    } catch (error) {
      console.error('Error connecting receive transport:', error);
      throw error;
    }
  }

  async produceMedia(stream) {
    try {
      if (!this.sendTransport) {
        throw new Error('Send transport not available');
      }

      const videoTrack = stream.getVideoTracks()[0];
      const audioTrack = stream.getAudioTracks()[0];

      if (videoTrack) {
        const videoProducer = await this.sendTransport.produce({
          track: videoTrack,
        });
        this.producers.set('video', videoProducer);
        console.log('Video producer created');
      }

      if (audioTrack) {
        const audioProducer = await this.sendTransport.produce({
          track: audioTrack,
        });
        this.producers.set('audio', audioProducer);
        console.log('Audio producer created');
      }
    } catch (error) {
      console.error('Error producing media:', error);
      throw error;
    }
  }

  async consumeProducer(producerInfo) {
    try {
      if (!this.recvTransport) {
        console.warn('Receive transport not ready, skipping consumer creation');
        return;
      }

      const { id: producerId, peerId, kind } = producerInfo;

      this.socket.emit('create-consumer', {
        transportId: this.recvTransport.id,
        producerId,
        rtpCapabilities: this.device.rtpCapabilities,
      });

      console.log(`Requested consumer for ${kind} producer ${producerId} from peer ${peerId}`);
    } catch (error) {
      console.error('Error consuming producer:', error);
    }
  }

  handleConsumerTrack(consumer, peerId) {
    try {
      const track = consumer.track;
      const kind = consumer.kind;

      // Get or create MediaStream for this peer
      let streams = this.remoteStreams.get(peerId);
      if (!streams) {
        streams = { video: null, audio: null };
        this.remoteStreams.set(peerId, streams);
      }

      // Create or update the stream for this media type
      if (kind === 'video') {
        if (streams.video) {
          streams.video.removeTrack(streams.video.getVideoTracks()[0]);
        } else {
          streams.video = new MediaStream();
        }
        streams.video.addTrack(track);
      } else if (kind === 'audio') {
        if (streams.audio) {
          streams.audio.removeTrack(streams.audio.getAudioTracks()[0]);
        } else {
          streams.audio = new MediaStream();
        }
        streams.audio.addTrack(track);
      }

      console.log(`Added ${kind} track for peer ${peerId}`);
      this.notifyStreamUpdate();
    } catch (error) {
      console.error('Error handling consumer track:', error);
    }
  }

  closeConsumer(consumerId) {
    try {
      const consumerInfo = this.consumers.get(consumerId);
      if (consumerInfo) {
        consumerInfo.consumer.close();
        this.consumers.delete(consumerId);
        console.log(`Closed consumer ${consumerId}`);
      }
    } catch (error) {
      console.error('Error closing consumer:', error);
    }
  }

  async stopProducing(kind = null) {
    try {
      if (kind) {
        const producer = this.producers.get(kind);
        if (producer) {
          this.socket.emit('close-producer', {
            producerId: producer.id,
            roomId: this.roomId,
          });
          producer.close();
          this.producers.delete(kind);
          console.log(`Stopped ${kind} producer`);
        }
      } else {
        // Stop all producers
        for (const [kind, producer] of this.producers) {
          this.socket.emit('close-producer', {
            producerId: producer.id,
            roomId: this.roomId,
          });
          producer.close();
        }
        this.producers.clear();
        console.log('Stopped all producers');
      }
    } catch (error) {
      console.error('Error stopping producer:', error);
    }
  }

  getRemoteStreams() {
    const streams = [];
    for (const [peerId, peerStreams] of this.remoteStreams) {
      if (peerStreams.video) {
        streams.push({
          peerId,
          stream: peerStreams.video,
          type: 'video',
        });
      }
      if (peerStreams.audio) {
        streams.push({
          peerId,
          stream: peerStreams.audio,
          type: 'audio',
        });
      }
    }
    return streams;
  }

  notifyStreamUpdate() {
    if (this.onStreamUpdate) {
      this.onStreamUpdate(this.getRemoteStreams());
    }
  }

  getPeerIdByProducerId(producerId) {
    // This would need to be tracked when consumers are created
    // For now, we'll extract it from the consumer info when available
    for (const [consumerId, consumerInfo] of this.consumers) {
      if (consumerInfo.producerId === producerId) {
        return consumerInfo.peerId;
      }
    }
    return 'unknown';
  }

  async leave() {
    try {
      // Stop all producers
      await this.stopProducing();

      // Close all consumers
      for (const [consumerId] of this.consumers) {
        this.closeConsumer(consumerId);
      }

      // Close transports
      if (this.sendTransport) {
        this.sendTransport.close();
        this.sendTransport = null;
      }

      if (this.recvTransport) {
        this.recvTransport.close();
        this.recvTransport = null;
      }

      // Leave the room
      this.socket.emit('leave-video-room', { roomId: this.roomId });

      // Clear remote streams
      this.remoteStreams.clear();
      this.notifyStreamUpdate();

      console.log('Left SFU connection');
    } catch (error) {
      console.error('Error leaving SFU connection:', error);
    }
  }

  async join() {
    try {
      this.socket.emit('join-video-room', { roomId: this.roomId });
      console.log(`Joining SFU room: ${this.roomId}`);
    } catch (error) {
      console.error('Error joining SFU room:', error);
      throw error;
    }
  }
}

export default SFUConnection;