import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';

class WebSocketService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.isConnecting = false;
    this.subscriptions = new Map(); // Track subscriptions
    this.tabId = Math.random().toString(36).substring(2);
    this.channel = null;
    this.listeners = {
      attendance: [],
      task: [],
      punch: [],
      adminNotification: []
    };
    
    // Initialize BroadcastChannel
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.channel = new BroadcastChannel("crm-notifications");
        this.channel.onmessage = (event) => {
          this.notifyListeners("adminNotification", event.data);
        };
      } catch (error) {
        // BroadcastChannel not available
      }
    }
  }

  connect(user = null) {
    // 🔥 FIX: Force re-subscribe if connected and user becomes available
    if (this.isConnected && user) {
      this.subscribeToTopics(user);
      return Promise.resolve();
    }

    if (this.isConnecting || this.isConnected) {
      return Promise.resolve();
    }

    this.isConnecting = true;

    return new Promise((resolve, reject) => {
      try {
        const socket = new SockJS('http://localhost:8080/ws');
        this.client = new Client({
          webSocketFactory: () => socket,
          connectHeaders: {},
          debug: () => {},

          reconnectDelay: 5000,
          heartbeatIncoming: 4000,
          heartbeatOutgoing: 4000,
        });

        this.client.onConnect = () => {
          this.isConnected = true;
          this.isConnecting = false;
          
          // Subscribe to user-specific topics
          this.subscribeToTopics(user);
          resolve();
        };

        this.client.onStompError = (frame) => {
          this.isConnected = false;
          this.isConnecting = false;
          this.cleanupSubscriptions();
          reject(new Error('WebSocket connection failed'));
        };

        // 🔥 FIX: Add WebSocket close handler
        this.client.onWebSocketClose = () => {
          this.isConnected = false;
        };

        this.client.onDisconnect = () => {
          this.isConnected = false;
          this.isConnecting = false;
          this.cleanupSubscriptions();
        };

        this.client.activate();
      } catch (error) {
        this.isConnecting = false;
        resolve();
      }
    });
  }

  subscribeToTopics(user = null) {
    if (!this.client || !this.isConnected) return;

    // 🔥 CRITICAL FIX: Prevent re-subscription loop
    if (this.subscriptions.size > 0) {
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
      const taskSub = this.client.subscribe('/topic/task-status-updates', (message) => {
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
        }

        if (user.department) {
          const deptTopic = `/topic/notifications/department/${user.department}`;
          const deptSub = this.client.subscribe(deptTopic, (message) => {
            try {
              const data = JSON.parse(message.body);
              if (this.channel) {
                this.channel.postMessage(data);
              }
              
              this.notifyListeners('adminNotification', data);
            } catch (error) {
              console.error('Error parsing department notification:', error);
            }
          });
          this.subscriptions.set('department', deptSub);
        }

        if (user.id) {
          const userTopic = `/topic/notifications/user/${user.id}`;
          const userSub = this.client.subscribe(userTopic, (message) => {
            try {
              const data = JSON.parse(message.body);
              if (this.channel) this.channel.postMessage(data);
              this.notifyListeners('adminNotification', data);
            } catch (error) { /* ignore */ }
          });
          this.subscriptions.set('user', userSub);
        }
      } else {
        const adminSub = this.client.subscribe('/topic/admin-notifications', (message) => {
          try {
            const data = JSON.parse(message.body);
            if (this.channel) this.channel.postMessage(data);
            this.notifyListeners('adminNotification', data);
          } catch (error) { /* ignore */ }
        });
        this.subscriptions.set('adminNotification', adminSub);
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
