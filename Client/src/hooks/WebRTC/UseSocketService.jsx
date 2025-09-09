import { useEffect } from "react";
import {
  gotMessageFromServer,
  createPeerConnection,
  connections,
  createOfferForConnection,
} from "./WebRTCConnection.jsx";

const UseConnectToSocketServer = (
  socket,
  socketIdRef,
  roomId,
  videoRef,
  setVideos
) => {
  useEffect(() => {
    if (!socket) return;

    // incoming WebRTC signals
    socket.on("signal", (fromId, message) => {
      console.log("sending signal");
      gotMessageFromServer(fromId, message, socketIdRef, { current: socket });
    });

    // when socket connects or reconnects
    socket.emit("join-call", roomId);
    console.log("trying to join the call");
    socketIdRef.current = socket.id;

    socket.on("user-left", (id) => {
      console.log("User left the call:", id);

      // Close and clean up the peer connection
      if (connections[id]) {
        connections[id].close();
        delete connections[id];
      }

      // Remove the user's video from the UI
      setVideos((vs) => {
        const updatedVideos = vs.filter((v) => v.socketId !== id);
        videoRef.current = updatedVideos;
        return updatedVideos;
      });
    });

    socket.on("user-joined", (newId, clientList) => {
      console.log("New user joined call:", newId, "Client list:", clientList);
      
      clientList.forEach((peerId) => {
        if (peerId !== socketIdRef.current) {
          createPeerConnection(peerId, { current: socket }, videoRef, setVideos);
        }
      });
      
      if (newId === socketIdRef.current) {
        // This is us joining, establish connections with existing peers
        Object.keys(connections).forEach((peerId) => {
          if (peerId === socketIdRef.current) return;
          
          // Add our local stream tracks to the connection
          if (window.localStream) {
            window.localStream.getTracks().forEach((track) => {
              connections[peerId].addTrack(track, window.localStream);
            });
          }
          createOfferForConnection(peerId, { current: socket });
        });
      }
    });
    return () => {
      socket.off("signal");
      // socket.off("connect");
      socket.off("user-left");
      socket.off("user-joined");
    };
  }, [socket]);
};
export default UseConnectToSocketServer;
