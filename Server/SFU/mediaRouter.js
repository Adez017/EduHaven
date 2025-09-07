/**
 * mediaRouter.js
 * 
 * Mediasoup-based SFU implementation for video conferencing.
 * Replaces the P2P mesh architecture with a centralized forwarding unit.
 * 
 * This module:
 * - Creates and manages mediasoup workers, routers, and transports
 * - Handles producer and consumer creation for media streams
 * - Provides APIs for joining/leaving video sessions
 * - Manages media routing between participants
 */

import mediasoup from 'mediasoup';
import { EventEmitter } from 'events';

class MediaRouter extends EventEmitter {
  constructor() {
    super();
    this.workers = [];
    this.routers = new Map(); // roomId -> router
    this.transports = new Map(); // transportId -> transport
    this.producers = new Map(); // producerId -> producer
    this.consumers = new Map(); // consumerId -> consumer
    this.peers = new Map(); // peerId -> peer info
    this.rooms = new Map(); // roomId -> room info
    
    this.workerSettings = {
      logLevel: 'warn',
      logTags: [
        'info',
        'ice',
        'dtls',
        'rtp',
        'srtp',
        'rtcp',
      ],
      rtcMinPort: 10000,
      rtcMaxPort: 10100,
    };

    this.routerOptions = {
      mediaCodecs: [
        {
          kind: 'audio',
          mimeType: 'audio/opus',
          clockRate: 48000,
          channels: 2,
        },
        {
          kind: 'video',
          mimeType: 'video/VP8',
          clockRate: 90000,
          parameters: {
            'x-google-start-bitrate': 1000,
          },
        },
        {
          kind: 'video',
          mimeType: 'video/VP9',
          clockRate: 90000,
          parameters: {
            'profile-id': 2,
            'x-google-start-bitrate': 1000,
          },
        },
        {
          kind: 'video',
          mimeType: 'video/h264',
          clockRate: 90000,
          parameters: {
            'packetization-mode': 1,
            'profile-level-id': '4d0032',
            'level-asymmetry-allowed': 1,
            'x-google-start-bitrate': 1000,
          },
        },
      ],
    };

    this.webRtcTransportOptions = {
      listenIps: [
        {
          ip: '0.0.0.0',
          announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP || '127.0.0.1',
        },
      ],
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
    };
  }

  async initialize() {
    try {
      console.log('Initializing MediaSoup SFU...');
      
      // Create a worker
      const worker = await mediasoup.createWorker(this.workerSettings);
      
      worker.on('died', (error) => {
        console.error('MediaSoup worker died:', error);
        setTimeout(() => process.exit(1), 2000);
      });

      this.workers.push(worker);
      console.log('MediaSoup worker created successfully');
      
      return true;
    } catch (error) {
      console.error('Failed to initialize MediaSoup:', error);
      throw error;
    }
  }

  async getOrCreateRouter(roomId) {
    if (this.routers.has(roomId)) {
      return this.routers.get(roomId);
    }

    try {
      const worker = this.workers[0]; // Use first worker for simplicity
      const router = await worker.createRouter(this.routerOptions);
      
      this.routers.set(roomId, router);
      
      // Initialize room info
      this.rooms.set(roomId, {
        id: roomId,
        router,
        peers: new Set(),
        createdAt: new Date(),
      });

      console.log(`Created router for room: ${roomId}`);
      return router;
    } catch (error) {
      console.error(`Failed to create router for room ${roomId}:`, error);
      throw error;
    }
  }

  async createWebRtcTransport(roomId, peerId, direction = 'send') {
    try {
      const router = await this.getOrCreateRouter(roomId);
      
      const transport = await router.createWebRtcTransport({
        ...this.webRtcTransportOptions,
      });

      transport.on('dtlsstatechange', (dtlsState) => {
        if (dtlsState === 'closed') {
          transport.close();
        }
      });

      transport.on('close', () => {
        console.log(`Transport closed for peer ${peerId}`);
      });

      this.transports.set(transport.id, {
        transport,
        peerId,
        roomId,
        direction,
      });

      console.log(`Created ${direction} transport for peer ${peerId} in room ${roomId}`);

      return {
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
      };
    } catch (error) {
      console.error(`Failed to create transport:`, error);
      throw error;
    }
  }

  async connectTransport(transportId, dtlsParameters) {
    try {
      const transportInfo = this.transports.get(transportId);
      if (!transportInfo) {
        throw new Error(`Transport ${transportId} not found`);
      }

      await transportInfo.transport.connect({ dtlsParameters });
      console.log(`Connected transport ${transportId}`);
    } catch (error) {
      console.error(`Failed to connect transport ${transportId}:`, error);
      throw error;
    }
  }

  async createProducer(transportId, rtpParameters, kind) {
    try {
      const transportInfo = this.transports.get(transportId);
      if (!transportInfo) {
        throw new Error(`Transport ${transportId} not found`);
      }

      const producer = await transportInfo.transport.produce({
        kind,
        rtpParameters,
      });

      this.producers.set(producer.id, {
        producer,
        peerId: transportInfo.peerId,
        roomId: transportInfo.roomId,
        kind,
      });

      // Add peer to room if not already there
      const room = this.rooms.get(transportInfo.roomId);
      if (room) {
        room.peers.add(transportInfo.peerId);
      }

      // Notify other peers in the room about the new producer
      this.emit('newProducer', {
        roomId: transportInfo.roomId,
        peerId: transportInfo.peerId,
        producerId: producer.id,
        kind,
      });

      console.log(`Created ${kind} producer ${producer.id} for peer ${transportInfo.peerId}`);

      return {
        id: producer.id,
      };
    } catch (error) {
      console.error(`Failed to create producer:`, error);
      throw error;
    }
  }

  async createConsumer(transportId, producerId, rtpCapabilities) {
    try {
      const transportInfo = this.transports.get(transportId);
      if (!transportInfo) {
        throw new Error(`Transport ${transportId} not found`);
      }

      const producerInfo = this.producers.get(producerId);
      if (!producerInfo) {
        throw new Error(`Producer ${producerId} not found`);
      }

      const router = await this.getOrCreateRouter(transportInfo.roomId);

      if (!router.canConsume({
        producerId,
        rtpCapabilities,
      })) {
        throw new Error('Cannot consume producer');
      }

      const consumer = await transportInfo.transport.consume({
        producerId,
        rtpCapabilities,
        paused: true,
      });

      this.consumers.set(consumer.id, {
        consumer,
        peerId: transportInfo.peerId,
        roomId: transportInfo.roomId,
        producerId,
      });

      console.log(`Created consumer ${consumer.id} for peer ${transportInfo.peerId}`);

      return {
        id: consumer.id,
        producerId,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
      };
    } catch (error) {
      console.error(`Failed to create consumer:`, error);
      throw error;
    }
  }

  async resumeConsumer(consumerId) {
    try {
      const consumerInfo = this.consumers.get(consumerId);
      if (!consumerInfo) {
        throw new Error(`Consumer ${consumerId} not found`);
      }

      await consumerInfo.consumer.resume();
      console.log(`Resumed consumer ${consumerId}`);
    } catch (error) {
      console.error(`Failed to resume consumer ${consumerId}:`, error);
      throw error;
    }
  }

  async pauseConsumer(consumerId) {
    try {
      const consumerInfo = this.consumers.get(consumerId);
      if (!consumerInfo) {
        throw new Error(`Consumer ${consumerId} not found`);
      }

      await consumerInfo.consumer.pause();
      console.log(`Paused consumer ${consumerId}`);
    } catch (error) {
      console.error(`Failed to pause consumer ${consumerId}:`, error);
      throw error;
    }
  }

  async closeProducer(producerId) {
    try {
      const producerInfo = this.producers.get(producerId);
      if (!producerInfo) {
        return;
      }

      producerInfo.producer.close();
      this.producers.delete(producerId);

      // Close all consumers of this producer
      for (const [consumerId, consumerInfo] of this.consumers) {
        if (consumerInfo.producerId === producerId) {
          consumerInfo.consumer.close();
          this.consumers.delete(consumerId);
        }
      }

      console.log(`Closed producer ${producerId}`);
    } catch (error) {
      console.error(`Failed to close producer ${producerId}:`, error);
    }
  }

  async getRouterCapabilities(roomId) {
    try {
      const router = await this.getOrCreateRouter(roomId);
      return router.rtpCapabilities;
    } catch (error) {
      console.error(`Failed to get router capabilities:`, error);
      throw error;
    }
  }

  async getRoomProducers(roomId, excludePeerId = null) {
    const producers = [];
    
    for (const [producerId, producerInfo] of this.producers) {
      if (producerInfo.roomId === roomId && producerInfo.peerId !== excludePeerId) {
        producers.push({
          id: producerId,
          peerId: producerInfo.peerId,
          kind: producerInfo.kind,
        });
      }
    }

    return producers;
  }

  async leavePeer(peerId, roomId) {
    try {
      // Close all transports for this peer
      for (const [transportId, transportInfo] of this.transports) {
        if (transportInfo.peerId === peerId && transportInfo.roomId === roomId) {
          transportInfo.transport.close();
          this.transports.delete(transportId);
        }
      }

      // Close all producers for this peer
      for (const [producerId, producerInfo] of this.producers) {
        if (producerInfo.peerId === peerId && producerInfo.roomId === roomId) {
          await this.closeProducer(producerId);
        }
      }

      // Close all consumers for this peer
      for (const [consumerId, consumerInfo] of this.consumers) {
        if (consumerInfo.peerId === peerId && consumerInfo.roomId === roomId) {
          consumerInfo.consumer.close();
          this.consumers.delete(consumerId);
        }
      }

      // Remove peer from room
      const room = this.rooms.get(roomId);
      if (room) {
        room.peers.delete(peerId);
        
        // Clean up room if empty
        if (room.peers.size === 0) {
          room.router.close();
          this.routers.delete(roomId);
          this.rooms.delete(roomId);
          console.log(`Closed empty room ${roomId}`);
        }
      }

      console.log(`Peer ${peerId} left room ${roomId}`);
    } catch (error) {
      console.error(`Failed to handle peer leave:`, error);
    }
  }

  async close() {
    console.log('Closing MediaSoup...');
    
    // Close all workers
    for (const worker of this.workers) {
      worker.close();
    }
    
    this.workers = [];
    this.routers.clear();
    this.transports.clear();
    this.producers.clear();
    this.consumers.clear();
    this.peers.clear();
    this.rooms.clear();
  }
}

export default MediaRouter;