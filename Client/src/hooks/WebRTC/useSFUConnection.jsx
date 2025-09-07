/**
 * useSFUConnection.jsx
 * 
 * React hook for managing SFU-based video conferencing connections.
 * Replaces the P2P mesh approach with a Selective Forwarding Unit architecture.
 * 
 * This hook provides:
 * - SFU connection management
 * - Media stream handling for SFU architecture
 * - Remote participant stream management
 * - Integration with existing UI components
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import SFUConnection from './sfuConnection.js';

export const useSFUConnection = (socket, roomId, localVideoRef) => {
  const [sfuConnection, setSfuConnection] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isProducing, setIsProducing] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  
  const localStreamRef = useRef(null);
  const sfuRef = useRef(null);

  // Initialize SFU connection
  useEffect(() => {
    if (!socket || !roomId) return;

    const initSFU = async () => {
      try {
        setConnectionError(null);
        console.log('Initializing SFU connection for room:', roomId);
        
        const sfu = new SFUConnection(socket, roomId);
        sfuRef.current = sfu;
        setSfuConnection(sfu);

        // Set up stream update callback
        sfu.onStreamUpdate = (streams) => {
          console.log('Remote streams updated:', streams);
          setRemoteStreams(streams);
        };

        // Join the room
        await sfu.join();
        setIsConnected(true);
        
        console.log('SFU connection initialized successfully');
      } catch (error) {
        console.error('Failed to initialize SFU connection:', error);
        setConnectionError(error.message);
      }
    };

    initSFU();

    // Cleanup on unmount or socket change
    return () => {
      if (sfuRef.current) {
        sfuRef.current.leave();
        sfuRef.current = null;
      }
      setSfuConnection(null);
      setIsConnected(false);
      setIsProducing(false);
      setRemoteStreams([]);
    };
  }, [socket, roomId]);

  // Start producing media (camera/microphone)
  const startProducing = useCallback(async (mediaStream) => {
    try {
      if (!sfuConnection || !mediaStream) {
        throw new Error('SFU connection or media stream not available');
      }

      console.log('Starting to produce media');
      
      // Store local stream reference
      localStreamRef.current = mediaStream;
      
      // Set local video
      if (localVideoRef?.current) {
        localVideoRef.current.srcObject = mediaStream;
      }

      // Produce media through SFU
      await sfuConnection.produceMedia(mediaStream);
      setIsProducing(true);
      
      console.log('Media production started successfully');
    } catch (error) {
      console.error('Failed to start producing media:', error);
      setConnectionError(error.message);
      throw error;
    }
  }, [sfuConnection, localVideoRef]);

  // Stop producing media
  const stopProducing = useCallback(async (kind = null) => {
    try {
      if (!sfuConnection) return;

      console.log('Stopping media production:', kind || 'all');
      
      await sfuConnection.stopProducing(kind);
      
      if (!kind) {
        setIsProducing(false);
        
        // Clear local video
        if (localVideoRef?.current) {
          localVideoRef.current.srcObject = null;
        }
        
        // Stop local stream tracks
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach(track => track.stop());
          localStreamRef.current = null;
        }
      }
      
      console.log('Media production stopped');
    } catch (error) {
      console.error('Failed to stop producing media:', error);
      setConnectionError(error.message);
    }
  }, [sfuConnection, localVideoRef]);

  // Get user media and start producing
  const enableMedia = useCallback(async (constraints = { video: true, audio: true }) => {
    try {
      console.log('Requesting user media with constraints:', constraints);
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      await startProducing(stream);
      
      return stream;
    } catch (error) {
      console.error('Failed to enable media:', error);
      setConnectionError(error.message);
      throw error;
    }
  }, [startProducing]);

  // Enable screen sharing
  const enableScreenShare = useCallback(async () => {
    try {
      console.log('Requesting screen share');
      
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });
      
      // Add screen share end handler
      stream.getVideoTracks()[0].addEventListener('ended', () => {
        console.log('Screen share ended');
        // Could automatically switch back to camera here
      });
      
      await startProducing(stream);
      
      return stream;
    } catch (error) {
      console.error('Failed to enable screen share:', error);
      setConnectionError(error.message);
      throw error;
    }
  }, [startProducing]);

  // Leave the SFU session
  const leave = useCallback(async () => {
    try {
      console.log('Leaving SFU session');
      
      if (sfuConnection) {
        await sfuConnection.leave();
      }
      
      // Stop local stream
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }
      
      // Clear local video
      if (localVideoRef?.current) {
        localVideoRef.current.srcObject = null;
      }
      
      setIsConnected(false);
      setIsProducing(false);
      setRemoteStreams([]);
      setConnectionError(null);
      
      console.log('Left SFU session successfully');
    } catch (error) {
      console.error('Failed to leave SFU session:', error);
      setConnectionError(error.message);
    }
  }, [sfuConnection, localVideoRef]);

  // Toggle video production
  const toggleVideo = useCallback(async () => {
    try {
      if (!localStreamRef.current) return;

      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        console.log('Video toggled:', videoTrack.enabled ? 'enabled' : 'disabled');
      }
    } catch (error) {
      console.error('Failed to toggle video:', error);
    }
  }, []);

  // Toggle audio production
  const toggleAudio = useCallback(async () => {
    try {
      if (!localStreamRef.current) return;

      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        console.log('Audio toggled:', audioTrack.enabled ? 'enabled' : 'disabled');
      }
    } catch (error) {
      console.error('Failed to toggle audio:', error);
    }
  }, []);

  // Get current media states
  const getMediaStates = useCallback(() => {
    if (!localStreamRef.current) {
      return { video: false, audio: false };
    }

    const videoTrack = localStreamRef.current.getVideoTracks()[0];
    const audioTrack = localStreamRef.current.getAudioTracks()[0];

    return {
      video: videoTrack ? videoTrack.enabled : false,
      audio: audioTrack ? audioTrack.enabled : false,
    };
  }, []);

  // Convert remote streams for compatibility with existing components
  const getRemoteVideos = useCallback(() => {
    return remoteStreams
      .filter(streamInfo => streamInfo.type === 'video')
      .map(streamInfo => ({
        socketId: streamInfo.peerId,
        stream: streamInfo.stream,
        autoplay: true,
        playsinline: true,
      }));
  }, [remoteStreams]);

  return {
    // Connection state
    isConnected,
    isProducing,
    connectionError,
    
    // Media controls
    enableMedia,
    enableScreenShare,
    stopProducing,
    toggleVideo,
    toggleAudio,
    getMediaStates,
    
    // Session management
    leave,
    
    // Stream data
    remoteStreams,
    getRemoteVideos,
    
    // Low-level access (for advanced usage)
    sfuConnection,
  };
};