'use client';

import { useEffect } from 'react';
import webSocketService from '../services/websocketService';
import { getTabSafeItem } from '@/utils/tabSafeStorage';

export default function WebSocketProvider({ children }) {
  useEffect(() => {
    // Initialize WebSocket connection when app starts
    let connectionTimeout;
    
    const initializeWebSocket = async () => {
      try {
        connectionTimeout = setTimeout(() => {
          console.warn('WebSocket connection timeout - continuing without real-time features');
        }, 5000); // 5 second timeout
        
        // 🔥 FIX: Get user context and pass to WebSocket connection
        let user = null;
        if (typeof window !== 'undefined') {
          try {
            let rawUserData = getTabSafeItem("user_data");
            if (!rawUserData) {
              rawUserData = localStorage.getItem("user_data");
            }
            const userData = rawUserData ? JSON.parse(rawUserData) : null;
            if (userData) {
              user = {
                id: userData.id || userData.employeeId,
                role: userData.role,
                department: userData.department,
                name: userData.fullName || userData.name
              };
            }
          } catch (error) {
            console.warn('Failed to parse user data for WebSocket:', error);
          }
        }
        
        await webSocketService.connect(user)
          .then(() => {
            clearTimeout(connectionTimeout);
            console.log('WebSocket initialized successfully with user context:', user);
          })
          .catch((error) => {
            clearTimeout(connectionTimeout);
            console.warn('WebSocket initialization failed, app continuing without real-time features:', error.message);
          });
      } catch (error) {
        clearTimeout(connectionTimeout);
        console.error('WebSocket initialization error:', error);
      }
    };

    // Only initialize WebSocket if not on login page (to avoid connection errors during login)
    if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
      initializeWebSocket();
    }

    // Cleanup on unmount
    return () => {
      if (connectionTimeout) {
        clearTimeout(connectionTimeout);
      }
      webSocketService.disconnect();
    };
  }, []); // 🔥 CRITICAL: Empty dependency array - runs only ONCE

  return <>{children}</>;
}
