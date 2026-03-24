import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';

class WebSocketService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.isConnecting = false;
    this.subscriptions = new Map(); // Track subscriptions
    this.tabId = Math.random().toString(36).substring(2); // 🔥 Tab-specific ID
    this.channel = null; // 🔥 BroadcastChannel for cross-tab sync
    this.listeners = {
      attendance: [],
      task: [],
      punch: [],
      adminNotification: []
    };
    
    console.log("🔌 WebSocket Tab ID:", this.tabId);
    
    // 🔥 Initialize BroadcastChannel
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.channel = new BroadcastChannel("crm-notifications");
        this.channel.onmessage = (event) => {
          this.notifyListeners("adminNotification", event.data);
        };
        console.log("🔔 BroadcastChannel initialized for cross-tab sync");
      } catch (error) {
        console.log("🔔 BroadcastChannel not available");
      }
    }
  }

  connect(user = null) {
    // 🔥 FIX: Force re-subscribe if connected and user becomes available
    if (this.isConnected && user) {
      console.log("🔄 Updating subscriptions with new user context");
      this.subscribeToTopics(user);
      return Promise.resolve();
    }

    if (this.isConnecting || this.isConnected) {
      console.log('WebSocket already connected or connecting');
      return Promise.resolve();
    }

    this.isConnecting = true;

    return new Promise((resolve, reject) => {
      try {
        const socket = new SockJS('https://api.yashrajent.com/ws');
        this.client = new Client({
          webSocketFactory: () => socket,
          connectHeaders: {},
          debug: (str) => {
            console.log('STOMP Debug:', str);
          },
          reconnectDelay: 5000,
          heartbeatIncoming: 4000,
          heartbeatOutgoing: 4000,
        });

        this.client.onConnect = (frame) => {
          console.log('WebSocket connected successfully:', frame);
          this.isConnected = true;
          this.isConnecting = false;
          
          // Subscribe to user-specific topics
          this.subscribeToTopics(user);
          resolve();
        };

        this.client.onStompError = (frame) => {
          console.error('WebSocket STOMP error:', frame);
          this.isConnected = false;
          this.isConnecting = false;
          this.cleanupSubscriptions();
          reject(new Error('WebSocket connection failed'));
        };

        // 🔥 FIX: Add WebSocket close handler
        this.client.onWebSocketClose = () => {
          console.log("⚠️ WebSocket closed. Reconnecting...");
          this.isConnected = false;
        };

        this.client.onDisconnect = (frame) => {
          console.log('WebSocket disconnected:', frame);
          this.isConnected = false;
          this.isConnecting = false;
          this.cleanupSubscriptions();
          
          // Only try to reconnect if it wasn't a manual disconnect
          if (!frame.wasClean) {
            console.log('WebSocket disconnected unexpectedly, will retry...');
          }
        };

        this.client.activate();
      } catch (error) {
        console.error('WebSocket connection error:', error);
        this.isConnecting = false;
        // Don't reject immediately - allow app to work even if WebSocket fails
        console.warn('WebSocket failed to connect, app will continue without real-time features');
        resolve(); // Resolve anyway so app doesn't break
      }
    });
  }

  subscribeToTopics(user = null) {
    if (!this.client || !this.isConnected) return;

    // 🔥 CRITICAL FIX: Prevent re-subscription loop
    if (this.subscriptions.size > 0) {
      console.log("🔌 Already subscribed to topics, skipping re-subscription");
      return;
    }

    try {
      // Subscribe to attendance events
      const attendanceSub = this.client.subscribe('/topic/attendance-events', (message) => {
        try {
          const data = JSON.parse(message.body);
          this.notifyListeners('attendance', data);
        } catch (error) {
          console.error('Error parsing attendance event:', error);
        }
      });
      this.subscriptions.set('attendance', attendanceSub);

      // Subscribe to task events
      const taskSub = this.client.subscribe('/topic/task-events', (message) => {
        try {
          const data = JSON.parse(message.body);
          this.notifyListeners('task', data);
        } catch (error) {
          console.error('Error parsing task event:', error);
        }
      });
      this.subscriptions.set('task', taskSub);

      // Subscribe to punch events
      const punchSub = this.client.subscribe('/topic/punch-events', (message) => {
        try {
          const data = JSON.parse(message.body);
          this.notifyListeners('punch', data);
        } catch (error) {
          console.error('Error parsing punch event:', error);
        }
      });
      this.subscriptions.set('punch', punchSub);

      // USER-SPECIFIC NOTIFICATION SUBSCRIPTIONS
      if (user) {
        console.log('🔔 Subscribing to user-specific notifications for:', {
          userId: user.id,
          role: user.role,
          department: user.department
        });

        // Subscribe to role-based notifications
        if (user.role) {
          const roleTopic = `/topic/notifications/role/${user.role}`;
          const roleSub = this.client.subscribe(roleTopic, (message) => {
            try {
              const data = JSON.parse(message.body);
              console.log('🔔 Received role-based notification:', data);
              
              // 🔥 Broadcast to other tabs
              if (this.channel) {
                this.channel.postMessage(data);
              }
              
              this.notifyListeners('adminNotification', data);
            } catch (error) {
              console.error('Error parsing role notification:', error);
            }
          });
          this.subscriptions.set('role', roleSub);
          console.log("✅ Subscribed:", roleTopic);
        }

        // Subscribe to department-based notifications
        if (user.department) {
          const deptTopic = `/topic/notifications/department/${user.department}`;
          const deptSub = this.client.subscribe(deptTopic, (message) => {
            try {
              const data = JSON.parse(message.body);
              console.log('🔔 Received department-based notification:', data);
              
              // 🔥 Broadcast to other tabs
              if (this.channel) {
                this.channel.postMessage(data);
              }
              
              this.notifyListeners('adminNotification', data);
            } catch (error) {
              console.error('Error parsing department notification:', error);
            }
          });
          this.subscriptions.set('department', deptSub);
          console.log("✅ Subscribed:", deptTopic);
        }

        // Subscribe to user-specific notifications
        if (user.id) {
          const userTopic = `/topic/notifications/user/${user.id}`;
          const userSub = this.client.subscribe(userTopic, (message) => {
            try {
              const data = JSON.parse(message.body);
              console.log('🔔 Received user-specific notification:', data);
              
              // 🔥 Broadcast to other tabs
              if (this.channel) {
                this.channel.postMessage(data);
              }
              
              this.notifyListeners('adminNotification', data);
            } catch (error) {
              console.error('Error parsing user notification:', error);
            }
          });
          this.subscriptions.set('user', userSub);
          console.log("✅ Subscribed:", userTopic);
        }
      } else {
        // Fallback: Subscribe to general admin notifications (backward compatibility)
        console.log('🔔 No user context, subscribing to general admin notifications');
        const adminSub = this.client.subscribe('/topic/admin-notifications', (message) => {
          try {
            const data = JSON.parse(message.body);
            console.log('🔔 Received general admin notification:', data);
            
            // 🔥 Broadcast to other tabs
            if (this.channel) {
              this.channel.postMessage(data);
            }
            
            this.notifyListeners('adminNotification', data);
          } catch (error) {
            console.error('Error parsing admin notification:', error);
          }
        });
        this.subscriptions.set('adminNotification', adminSub);
        console.log("✅ Subscribed: /topic/admin-notifications (fallback)");
      }

    } catch (error) {
      console.error('Error subscribing to topics:', error);
    }
  }

  cleanupSubscriptions() {
    // Unsubscribe from all topics
    this.subscriptions.forEach((subscription, topic) => {
      try {
        if (subscription && subscription.unsubscribe) {
          subscription.unsubscribe();
        }
      } catch (error) {
        console.error(`Error unsubscribing from ${topic}:`, error);
      }
    });
    this.subscriptions.clear();
  }

  // Event listener management
  addEventListener(type, callback) {
    if (this.listeners[type]) {
      // Prevent duplicate callbacks
      const existingIndex = this.listeners[type].findIndex(cb => cb === callback);
      if (existingIndex === -1) {
        this.listeners[type].push(callback);
      }
    }
  }

  removeEventListener(type, callback) {
    if (this.listeners[type]) {
      this.listeners[type] = this.listeners[type].filter(cb => cb !== callback);
    }
  }

  notifyListeners(type, data) {
    if (this.listeners[type]) {
      this.listeners[type].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in event listener:', error);
        }
      });
    }
  }

  disconnect() {
    this.cleanupSubscriptions();
    
    if (this.client) {
      try {
        this.client.deactivate();
      } catch (error) {
        console.error('Error deactivating WebSocket client:', error);
      }
    }
    
    this.isConnected = false;
    this.isConnecting = false;
  }

  getConnectionStatus() {
    return this.isConnected;
  }

  // Get connection state for debugging
  getConnectionState() {
    return {
      isConnected: this.isConnected,
      isConnecting: this.isConnecting,
      subscriptionCount: this.subscriptions.size,
      listenerCounts: {
        attendance: this.listeners.attendance.length,
        task: this.listeners.task.length,
        punch: this.listeners.punch.length,
        adminNotification: this.listeners.adminNotification.length
      }
    };
  }
}

// Singleton instance
const webSocketService = new WebSocketService();

export default webSocketService;
