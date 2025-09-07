/**
 * SFUTestPage.jsx
 * 
 * Test page to demonstrate SFU video conferencing functionality.
 * This component can be used to verify the SFU implementation works correctly.
 */

import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import SFUVideoConference from '../hooks/WebRTC/SFUVideoConference.jsx';

const SFUTestPage = () => {
  const [socket, setSocket] = useState(null);
  const [roomId, setRoomId] = useState('test-room-' + Math.random().toString(36).substr(2, 9));
  const [participantCount, setParticipantCount] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');

  useEffect(() => {
    // Initialize socket connection
    const newSocket = io('http://localhost:3000', {
      auth: {
        token: 'test-token' // For testing, you might need a valid JWT
      }
    });

    newSocket.on('connect', () => {
      console.log('Connected to server');
      setConnectionStatus('connected');
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from server');
      setConnectionStatus('disconnected');
    });

    newSocket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      setConnectionStatus('error');
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  const handleParticipantUpdate = (count) => {
    setParticipantCount(count);
  };

  if (!socket) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Initializing socket connection...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">SFU Video Conference Test</h1>
              <p className="text-sm text-gray-600">Room: {roomId}</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center">
                <div className={`w-3 h-3 rounded-full mr-2 ${
                  connectionStatus === 'connected' ? 'bg-green-500' :
                  connectionStatus === 'error' ? 'bg-red-500' : 'bg-yellow-500'
                }`}></div>
                <span className="text-sm text-gray-600 capitalize">{connectionStatus}</span>
              </div>
              <div className="bg-blue-100 px-3 py-1 rounded-full">
                <span className="text-sm font-medium text-blue-800">
                  {participantCount} participant{participantCount !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {connectionStatus === 'connected' ? (
          <div className="bg-white rounded-lg shadow-lg overflow-hidden" style={{ height: '80vh' }}>
            <SFUVideoConference 
              socket={socket}
              roomId={roomId}
              onParticipantUpdate={handleParticipantUpdate}
            />
          </div>
        ) : connectionStatus === 'error' ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
            <div className="text-red-600 text-lg font-semibold mb-2">Connection Failed</div>
            <p className="text-red-500 mb-4">
              Unable to connect to the SFU server. Please check:
            </p>
            <ul className="text-red-500 text-sm space-y-1 mb-4">
              <li>• Server is running on http://localhost:3000</li>
              <li>• JWT authentication is properly configured</li>
              <li>• Network connectivity</li>
            </ul>
            <button 
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Retry Connection
            </button>
          </div>
        ) : (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8 text-center">
            <div className="text-yellow-600 text-lg font-semibold mb-2">Connecting...</div>
            <p className="text-yellow-500">Establishing connection to SFU server...</p>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">Testing Instructions</h3>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-blue-800 mb-2">Single User Test:</h4>
              <ul className="text-blue-700 text-sm space-y-1">
                <li>• Click "Start Video & Audio" to begin broadcasting</li>
                <li>• You should see your own video feed</li>
                <li>• Try toggling video/audio on and off</li>
                <li>• Test screen sharing functionality</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-blue-800 mb-2">Multi-User Test:</h4>
              <ul className="text-blue-700 text-sm space-y-1">
                <li>• Open this page in another browser/incognito window</li>
                <li>• Use the same room ID: <code className="bg-blue-100 px-1 rounded">{roomId}</code></li>
                <li>• Both users should see each other's video</li>
                <li>• Test with 3+ users to verify SFU scaling</li>
              </ul>
            </div>
          </div>
          <div className="mt-4 p-3 bg-blue-100 rounded">
            <p className="text-blue-800 text-sm">
              <strong>Note:</strong> Make sure the server is running with the SFU implementation. 
              The server should show "SFU MediaRouter initialized successfully" in the console.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SFUTestPage;