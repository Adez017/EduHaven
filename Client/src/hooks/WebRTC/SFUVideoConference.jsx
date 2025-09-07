/**
 * SFUVideoConference.jsx
 * 
 * Updated video conference component using SFU architecture.
 * Replaces the P2P mesh implementation with a more scalable SFU approach.
 * 
 * Features:
 * - Supports more than 2 participants reliably
 * - Better bandwidth utilization (linear scaling instead of quadratic)
 * - Improved connection stability
 * - Compatible with existing UI components
 */

import React, { useRef, useEffect, useState } from 'react';
import { useSFUConnection } from './useSFUConnection.jsx';
import VideoConferenceView from './VideoConferenceView.jsx';

const SFUVideoConference = ({ socket, roomId, onParticipantUpdate }) => {
  const localVideoRef = useRef(null);
  const [localStream, setLocalStream] = useState(null);
  const [mediaEnabled, setMediaEnabled] = useState({ video: false, audio: false });
  
  const {
    isConnected,
    isProducing,
    connectionError,
    enableMedia,
    enableScreenShare,
    stopProducing,
    toggleVideo,
    toggleAudio,
    getMediaStates,
    leave,
    getRemoteVideos,
  } = useSFUConnection(socket, roomId, localVideoRef);

  // Track media states
  useEffect(() => {
    const updateMediaStates = () => {
      if (isProducing) {
        setMediaEnabled(getMediaStates());
      }
    };

    const interval = setInterval(updateMediaStates, 1000);
    return () => clearInterval(interval);
  }, [isProducing, getMediaStates]);

  // Handle participant count updates
  useEffect(() => {
    if (onParticipantUpdate) {
      const remoteVideos = getRemoteVideos();
      onParticipantUpdate(remoteVideos.length + (isProducing ? 1 : 0));
    }
  }, [getRemoteVideos, isProducing, onParticipantUpdate]);

  const handleEnableVideo = async () => {
    try {
      const stream = await enableMedia({ video: true, audio: mediaEnabled.audio });
      setLocalStream(stream);
    } catch (error) {
      console.error('Failed to enable video:', error);
    }
  };

  const handleEnableAudio = async () => {
    try {
      const stream = await enableMedia({ video: mediaEnabled.video, audio: true });
      setLocalStream(stream);
    } catch (error) {
      console.error('Failed to enable audio:', error);
    }
  };

  const handleEnableBoth = async () => {
    try {
      const stream = await enableMedia({ video: true, audio: true });
      setLocalStream(stream);
    } catch (error) {
      console.error('Failed to enable media:', error);
    }
  };

  const handleScreenShare = async () => {
    try {
      const stream = await enableScreenShare();
      setLocalStream(stream);
    } catch (error) {
      console.error('Failed to start screen share:', error);
    }
  };

  const handleToggleVideo = async () => {
    try {
      await toggleVideo();
    } catch (error) {
      console.error('Failed to toggle video:', error);
    }
  };

  const handleToggleAudio = async () => {
    try {
      await toggleAudio();
    } catch (error) {
      console.error('Failed to toggle audio:', error);
    }
  };

  const handleStopMedia = async () => {
    try {
      await stopProducing();
      setLocalStream(null);
      setMediaEnabled({ video: false, audio: false });
    } catch (error) {
      console.error('Failed to stop media:', error);
    }
  };

  const handleLeave = async () => {
    try {
      await leave();
      setLocalStream(null);
      setMediaEnabled({ video: false, audio: false });
    } catch (error) {
      console.error('Failed to leave session:', error);
    }
  };

  if (connectionError) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-red-50 border border-red-200 rounded-lg">
        <div className="text-red-600 font-semibold mb-2">Connection Error</div>
        <div className="text-red-500 text-sm mb-4">{connectionError}</div>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Reload Page
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Connection Status */}
      <div className="bg-gray-100 p-2 text-sm">
        <span className={`inline-block w-2 h-2 rounded-full mr-2 ${
          isConnected ? 'bg-green-500' : 'bg-red-500'
        }`}></span>
        {isConnected ? 'Connected via SFU' : 'Connecting...'}
        {isProducing && (
          <span className="ml-4 text-blue-600">
            📹 {mediaEnabled.video ? 'Video' : ''} 
            {mediaEnabled.video && mediaEnabled.audio ? ' & ' : ''}
            {mediaEnabled.audio ? 'Audio' : ''} Active
          </span>
        )}
      </div>

      {/* Video Grid */}
      <div className="flex-1 flex flex-col">
        {/* Local Video */}
        <div className="bg-gray-900 p-4">
          <div className="relative">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full max-w-sm mx-auto rounded-lg bg-gray-800"
              style={{ maxHeight: '200px' }}
            />
            <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
              You {isProducing ? '(Broadcasting)' : '(Not Broadcasting)'}
            </div>
          </div>
        </div>

        {/* Remote Videos */}
        <div className="flex-1 bg-gray-800 p-4">
          <h3 className="text-white mb-4">Other Participants ({getRemoteVideos().length})</h3>
          <VideoConferenceView videos={getRemoteVideos()} />
        </div>
      </div>

      {/* Controls */}
      <div className="bg-gray-100 p-4 border-t">
        <div className="flex flex-wrap gap-2 justify-center">
          {!isProducing ? (
            <>
              <button
                onClick={handleEnableBoth}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                📹 Start Video & Audio
              </button>
              <button
                onClick={handleEnableVideo}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                📹 Video Only
              </button>
              <button
                onClick={handleEnableAudio}
                className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
              >
                🎤 Audio Only
              </button>
              <button
                onClick={handleScreenShare}
                className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700"
              >
                🖥️ Share Screen
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleToggleVideo}
                className={`px-4 py-2 rounded ${
                  mediaEnabled.video
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-gray-600 hover:bg-gray-700 text-white'
                }`}
              >
                📹 {mediaEnabled.video ? 'Video On' : 'Video Off'}
              </button>
              <button
                onClick={handleToggleAudio}
                className={`px-4 py-2 rounded ${
                  mediaEnabled.audio
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-gray-600 hover:bg-gray-700 text-white'
                }`}
              >
                🎤 {mediaEnabled.audio ? 'Audio On' : 'Audio Off'}
              </button>
              <button
                onClick={handleScreenShare}
                className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700"
              >
                🖥️ Share Screen
              </button>
              <button
                onClick={handleStopMedia}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                ⏹️ Stop Broadcasting
              </button>
            </>
          )}
          
          <button
            onClick={handleLeave}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            🚪 Leave Room
          </button>
        </div>
      </div>

      {/* Info Panel */}
      <div className="bg-blue-50 p-3 text-sm text-blue-800">
        <div className="font-semibold mb-1">🚀 SFU Architecture Benefits:</div>
        <ul className="text-xs space-y-1">
          <li>• Supports many participants reliably</li>
          <li>• Better bandwidth efficiency (no P2P mesh)</li>
          <li>• Improved connection stability</li>
          <li>• Centralized media routing through server</li>
        </ul>
      </div>
    </div>
  );
};

export default SFUVideoConference;