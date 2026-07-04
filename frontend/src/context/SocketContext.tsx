import React, { createContext, useContext, useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "./AuthContext";

const SocketContext = createContext<Socket | null>(null);

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!token) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }

    // Connect to backend Socket.IO server passing the JWT in auth payload
    const newSocket = io(API_URL, {
      auth: {
        token: `Bearer ${token}`,
      },
      autoConnect: true,
      transports: ["websocket", "polling"],
    });

    newSocket.on("connect", () => {
      console.log("Socket.IO connected:", newSocket.id);
    });

    newSocket.on("connect_error", (err) => {
      console.error("Socket.IO connection error:", err);
    });

    setSocket(newSocket);

    // Disconnect socket when token changes or provider unmounts
    return () => {
      newSocket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useSocket = () => {
  return useContext(SocketContext);
};
