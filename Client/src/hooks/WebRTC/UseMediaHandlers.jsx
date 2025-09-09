/**
 * UseMediaHandlers.js
 *
 * Custom hook that manages media stream handling and user media controls.
 * Handles getUserMedia and getDisplayMedia operations, manages video/audio/screen sharing states,
 * and provides toggle functions for media controls. Coordinates with WebRTC connections
 * to update media streams across all peer connections when media settings change.
 *
 * - Manages media stream acquisition (camera, microphone, screen)
 * - Handles media stream updates and replacements
 * - Provides toggle functions for media controls
 */

import { useState, useEffect, useRef } from "react";
import { connections, createOfferForConnection } from "./WebRTCConnection.jsx";
import { createBlackSilence, black, silence } from "@/utils/mediaUtils.jsx";

export const UseMediaHandlers = (
  localVideoref,
  socketIdRef,
  socket,
  setScreenAvailable
) => {
  const [videoToggle, setVideo] = useState(false);
  const [audioToggle, setAudio] = useState(false);
  const [screen, setScreen] = useState();

  const socketRef = useRef();
  useEffect(() => {
    if (!socket) return;
    socketRef.current = socket;
  }, [socket]);

  const getUserMediaSuccess = (stream) => {
    try {
      window.localStream.getTracks().forEach((track) => track.stop());
    } catch (e) {
      console.log(e);
    }

    window.localStream = stream;
    localVideoref.current.srcObject = stream;

    // Update existing peer connections with new tracks
    for (let id in connections) {
      if (id === socketIdRef.current) continue;

      // Remove old tracks
      const senders = connections[id].getSenders();
      senders.forEach((sender) => {
        if (sender.track) {
          connections[id].removeTrack(sender);
        }
      });

      // Add new tracks
      stream.getTracks().forEach((track) => {
        connections[id].addTrack(track, stream);
      });

      createOfferForConnection(id, socketRef);
    }

    stream.getTracks().forEach(
      (track) =>
        (track.onended = () => {
          if (track.kind === 'video') {
            setVideo(false);
          } else if (track.kind === 'audio') {
            setAudio(false);
          }

          try {
            let tracks = localVideoref.current.srcObject.getTracks();
            tracks.forEach((track) => track.stop());
          } catch (e) {
            console.log(e);
          }

          window.localStream = createBlackSilence();
          localVideoref.current.srcObject = window.localStream;

          // Update peer connections with black silence
          for (let id in connections) {
            const senders = connections[id].getSenders();
            senders.forEach((sender) => {
              if (sender.track) {
                connections[id].removeTrack(sender);
              }
            });

            window.localStream.getTracks().forEach((track) => {
              connections[id].addTrack(track, window.localStream);
            });
            createOfferForConnection(id, socketRef);
          }
        })
    );
  };

  const getUserMedia = async () => {
    try {
      // Set screen share availability
      setScreenAvailable(
        typeof navigator.mediaDevices.getDisplayMedia === "function"
      );

      if (videoToggle || audioToggle) {
        // Request media based on actual toggle states
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: videoToggle, 
          audio: audioToggle 
        });
        
        // If we got a partial stream (e.g., only audio), we need to add the missing tracks
        const hasVideo = stream.getVideoTracks().length > 0;
        const hasAudio = stream.getAudioTracks().length > 0;
        
        // Create a complete stream with black video or silent audio if needed
        const completeStream = new MediaStream();
        
        if (videoToggle && hasVideo) {
          completeStream.addTrack(stream.getVideoTracks()[0]);
        } else if (!videoToggle) {
          // Add black video track
          completeStream.addTrack(black());
        }
        
        if (audioToggle && hasAudio) {
          completeStream.addTrack(stream.getAudioTracks()[0]);
        } else if (!audioToggle) {
          // Add silent audio track
          completeStream.addTrack(silence());
        }
        
        getUserMediaSuccess(completeStream);
      } else {
        // Both video and audio are off, use black silence
        try {
          if (localVideoref.current && localVideoref.current.srcObject) {
            let tracks = localVideoref.current.srcObject.getTracks();
            tracks.forEach((track) => track.stop());
          }
        } catch (e) {
          console.log(e);
        }

        window.localStream = createBlackSilence();
        localVideoref.current.srcObject = window.localStream;

        // Update peer connections
        for (let id in connections) {
          if (id === socketIdRef.current) continue;

          const senders = connections[id].getSenders();
          senders.forEach((sender) => {
            if (sender.track) {
              connections[id].removeTrack(sender);
            }
          });

          window.localStream.getTracks().forEach((track) => {
            connections[id].addTrack(track, window.localStream);
          });
          createOfferForConnection(id, socketRef);
        }
      }
    } catch (error) {
      console.error("Error accessing media devices:", error);
      
      // Fallback to black silence
      window.localStream = createBlackSilence();
      if (localVideoref.current) {
        localVideoref.current.srcObject = window.localStream;
      }
    }
  };

  const getDisplayMediaSuccess = (stream) => {
    try {
      window.localStream.getTracks().forEach((track) => track.stop());
    } catch (e) {
      console.log(e);
    }

    window.localStream = stream;
    localVideoref.current.srcObject = stream;

    // Update existing peer connections with new tracks
    for (let id in connections) {
      if (id === socketIdRef.current) continue;

      // Remove old tracks
      const senders = connections[id].getSenders();
      senders.forEach((sender) => {
        if (sender.track) {
          connections[id].removeTrack(sender);
        }
      });

      // Add new tracks
      stream.getTracks().forEach((track) => {
        connections[id].addTrack(track, stream);
      });

      createOfferForConnection(id, socketRef);
    }

    stream.getTracks().forEach(
      (track) =>
        (track.onended = () => {
          setScreen(false);

          try {
            let tracks = localVideoref.current.srcObject.getTracks();
            tracks.forEach((track) => track.stop());
          } catch (e) {
            console.log(e);
          }

          window.localStream = createBlackSilence();
          localVideoref.current.srcObject = window.localStream;

          getUserMedia();
        })
    );
  };

  const getDisplayMedia = () => {
    if (screen) {
      if (navigator.mediaDevices.getDisplayMedia) {
        navigator.mediaDevices
          .getDisplayMedia({ video: true, audio: true })
          .then(getDisplayMediaSuccess)
          .catch((e) => console.log(e));
      }
    }
  };

  useEffect(() => {
    if (videoToggle !== undefined && audioToggle !== undefined) {
      getUserMedia();
      console.log("SET STATE HAS ", videoToggle, audioToggle);
    }
  }, [videoToggle, audioToggle]);

  useEffect(() => {
    if (screen !== undefined) {
      getDisplayMedia();
    }
  }, [screen]);

  const handleVideo = () => setVideo(!videoToggle);
  const handleAudio = () => setAudio(!audioToggle);
  const handleScreen = () => setScreen(!screen);

  return {
    videoToggle,
    audioToggle,
    screen,
    setVideo,
    setAudio,
    handleVideo,
    handleAudio,
    handleScreen,
    getUserMedia,
  };
};
