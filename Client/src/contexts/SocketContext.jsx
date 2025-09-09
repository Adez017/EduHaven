import { createContext, useContext, useEffect, useState } from "react";
import UseSocket from "../hooks/UseSocket.jsx";
import { jwtDecode } from "jwt-decode";

const SocketContext = createContext();

const UseSocketContext = () => {
  return useContext(SocketContext);
};

export const SocketProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      // For testing purposes, create a fake user
      const testUser = {
        token: "test-token",
        id: "test-user-" + Math.random().toString(36).substr(2, 9),
        name: "Test User",
        profileImage: null,
      };
      setUser(testUser);
      return;
    }
    
    try {
      const decoded = jwtDecode(token);
      const userData = {
        token: token,
        id: decoded.id,
        name: `${decoded.FirstName} ${decoded?.LastName ?? ""}`,
        profileImage: decoded.profileImage,
      };
      setUser(userData);
    } catch (error) {
      console.error("Failed to decode token:", error);
      // Fallback to test user
      const testUser = {
        token: "test-token",
        id: "test-user-" + Math.random().toString(36).substr(2, 9),
        name: "Test User",
        profileImage: null,
      };
      setUser(testUser);
    }
  }, []);

  const { socket, isConnected, onlineUsers } = UseSocket(user);

  return (
    <SocketContext.Provider value={{ socket, isConnected, onlineUsers, user }}>
      {children}
    </SocketContext.Provider>
  );
};
export default UseSocketContext;
