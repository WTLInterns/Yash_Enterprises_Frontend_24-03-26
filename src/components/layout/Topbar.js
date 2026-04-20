"use client";

import React, { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import { Bell, X, Check, Settings, LogOut, User, Menu, RefreshCw, CheckCheck, Trash2, Clock, Calendar } from 'lucide-react';
import { backendApi } from '../../services/api';
import webSocketService from '../../services/websocketService';
import { useToast } from '../common/ToastProvider';
import { getTabSafeItem } from '@/utils/tabSafeStorage';

export default function Topbar({ tabs, activeTabKey, onTabClick }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const bellRef = useRef(null);
  const [panelPos, setPanelPos] = useState(null); // null = not calculated yet
  
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [error, setError] = useState(null);
  const { addToast } = useToast(); // 🔥 NEW: Use existing toast system

  const currentUser = useMemo(() => {
    if (typeof window === "undefined") return null;

    try {
      // Priority: sessionStorage -> tabSafeStorage -> localStorage
      let raw = sessionStorage.getItem("user_data");
      
      if (!raw) {
        raw = getTabSafeItem("user_data");
      }
      
      if (!raw) {
        raw = localStorage.getItem("user_data");
      }

      const user = raw ? JSON.parse(raw) : null;

      console.log("🔔 CURRENT USER:", user);
      console.log("🔔 STORAGE SOURCE:", raw ? (sessionStorage.getItem("user_data") ? "sessionStorage" : getTabSafeItem("user_data") ? "tabSafeStorage" : "localStorage") : "none");

      return user;
    } catch (e) {
      console.error("User parse error:", e);
      return null;
    }
  }, []);

  const userId = currentUser?.id ?? null;
  const userRole = currentUser?.role ?? null;
  const userDepartment = currentUser?.department ?? null;

  const unread = useMemo(() => {
    if (!items || items.length === 0) return 0;
    return items.filter((n) => !n.readAt).length;
  }, [items]);

  // Debug logs to verify user data is being read correctly
  useEffect(() => {
    console.log("🔔 USER DATA DEBUG:", {
      userId,
      userRole,
      userDepartment
    });
  }, [userId, userRole, userDepartment]);

  // Mark notification as read
  const markAsRead = async (notificationId) => {
    try {
      await backendApi.put(`/notifications/${notificationId}/read`);
      refresh();
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      // Show error but continue
    }
  };

  // Delete notification
  const deleteNotification = async (notificationId) => {
    try {
      await backendApi.delete(`/notifications/${notificationId}`);
      refresh();
    } catch (error) {
      console.error('Failed to delete notification:', error);
      // Show error but continue
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    if (unread === 0) return;
    setMarkingAll(true);
    try {
      let markReadUrl;
      
      // Mark based on user role/department
      if (userRole === "ADMIN" || userRole === "MANAGER") {
        markReadUrl = `/notifications/mark-all-read/by-role?role=${encodeURIComponent(userRole)}`;
      } else if (userDepartment === "ACCOUNT") {
        markReadUrl = `/notifications/mark-all-read/by-department?department=${encodeURIComponent(userDepartment)}`;
      } else {
        markReadUrl = `/notifications/mark-all-read?employeeId=${userId}`;
      }
      
      await backendApi.put(markReadUrl);
      refresh();
    } catch (error) {
      console.error('Failed to mark all as read:', error);
      // Show error but continue
    } finally {
      setMarkingAll(false);
    }
  };

  // Delete all notifications
  const deleteAllNotifications = async () => {
    try {
      let deleteUrl;
      
      // Delete based on user role/department
      if (userRole === "ADMIN" || userRole === "MANAGER") {
        deleteUrl = `/notifications/by-role?role=${encodeURIComponent(userRole)}`;
      } else if (userDepartment === "ACCOUNT") {
        deleteUrl = `/notifications/by-department?department=${encodeURIComponent(userDepartment)}`;
      } else {
        deleteUrl = `/notifications?employeeId=${userId}`;
      }
      
      await backendApi.delete(deleteUrl);
      refresh();
    } catch (error) {
      console.error('Failed to delete all notifications:', error);
      // Show error but continue
    }
  };

  async function refresh() {
    console.log('🔔 ===== NOTIFICATION REFRESH START =====');
    if (userId == null) {
      console.log('🔔 No userId, skipping refresh');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let page;
      let fetchUrl;
      
      console.log("🔔 USER INFO:", { userId, userRole, userDepartment });
      
      // Fetch notifications based on user role/department
      if (userRole === "ADMIN" || userRole === "MANAGER") {
        // 🔥 NEW: Role-based fetching for ADMIN and MANAGER with employeeId for comprehensive notifications
        fetchUrl = `/notifications/by-role?role=${encodeURIComponent(userRole)}&employeeId=${encodeURIComponent(userId)}&page=0&size=50`;
        console.log("🔔 ADMIN/MANAGER fetch URL:", fetchUrl);
        page = await backendApi.get(fetchUrl);
      } else if (userDepartment === "ACCOUNT") {
        // Department-based fetching for ACCOUNT department
        fetchUrl = `/notifications/by-department?department=${encodeURIComponent(userDepartment)}&page=0&size=50`;
        console.log("🔔 ACCOUNT department fetch URL:", fetchUrl);
        page = await backendApi.get(fetchUrl);
      } else {
        // Employee-based fetching for regular employees
        fetchUrl = `/notifications?employeeId=${encodeURIComponent(userId)}&page=0&size=50`;
        console.log("🔔 Employee fetch URL:", fetchUrl);
        page = await backendApi.get(fetchUrl);
      }
      
      console.log("🔔 RAW API RESPONSE:", JSON.stringify(page, null, 2));
      
      const content = page?.data?.content ?? page?.content ?? [];
      console.log("🔔 EXTRACTED CONTENT:", content);
      console.log("🔔 NOTIFICATIONS COUNT:", content.length);
      
      // Log each notification details
      content.forEach((notif, index) => {
        console.log(`🔔 Notification ${index + 1}:`, {
          id: notif.id,
          title: notif.title,
          message: notif.body, // ✅ FIXED: Use body instead of message
          createdAt: notif.createdAt,
          readAt: notif.readAt,
          recipientRole: notif.recipientRole,
          recipientDepartment: notif.recipientDepartment,
          recipientEmployeeId: notif.recipientEmployeeId
        });
      });
      
      setItems(content);
      setTotalCount(page?.data?.totalElements ?? page?.totalElements ?? content.length);
      
      console.log("🔔 TOTAL COUNT:", page?.data?.totalElements ?? page?.totalElements ?? content.length);
    } catch (error) {
      console.error('🔔 Failed to fetch notifications:', error);
      console.error('🔔 Error details:', JSON.stringify(error, null, 2));
      setError('Server connection failed');
      // Set empty state on error to prevent infinite loading
      setItems([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
      console.log('🔔 ===== NOTIFICATION REFRESH END =====');
    }
  }

  useEffect(() => {
    // Request notification permission on component mount
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().then(permission => {
        console.log("🔔 Notification permission:", permission);
      });
    }

    // Only connect WebSocket when we have user data
    if (!currentUser) {
      console.log("� No user data available, skipping WebSocket connection");
      return;
    }

  // 🔥 REMOVED: WebSocket connection is now handled by WebSocketProvider at app level
  // This prevents re-connection loops and subscription issues
    
  const handleAdminNotification = (data) => {
      console.log('🔔 ===== NOTIFICATION RECEIVED =====');
      console.log('🔔 Full notification data:', JSON.stringify(data, null, 2));
      console.log('🔔 Current user info:', { userId, userRole, userDepartment });
      
      // 🔥 NEW: Show React Toast notification (always visible)
      if (data?.title) {
        console.log('🔔 Showing React Toast notification');
        addToast(`${data.title}: ${data.body || 'New notification'}`, 'info', 4000);
      } else {
        console.log('🔔 No title in notification data, skipping toast');
      }
      
      // 🔥 NEW: Check tab visibility for Chrome notification
      const isTabActive = document.visibilityState === "visible";
      console.log('🔔 Tab visibility check:', { isTabActive, visibilityState: document.visibilityState });
      
      if (Notification.permission === "granted" && data?.title) {
        
        // If user is NOT on CRM tab → show Chrome notification
        if (!isTabActive) {
          console.log("🔔 Tab is inactive → showing Chrome notification");
          
          // Try service worker first (more reliable for multi-tab)
          if ('serviceWorker' in navigator && 'showNotification' in ServiceWorkerRegistration.prototype) {
            navigator.serviceWorker.getRegistration().then(reg => {
              if (reg) {
                reg.showNotification(data.title, {
                  body: data.body || "New notification",
                  icon: "/favicon.ico",
                  tag: data.id || "notification",
                  requireInteraction: true
                });
                console.log('🔔 Service Worker notification displayed');
              } else {
                // Fallback to regular notification
                new Notification(data.title, {
                  body: data.body || "New notification",
                  icon: "/favicon.ico",
                  tag: data.id || "notification",
                  requireInteraction: true
                });
                console.log('🔔 Chrome notification displayed (fallback)');
              }
            }).catch((error) => {
              console.log('🔔 Service Worker failed, using fallback:', error);
              // Fallback if service worker fails
              new Notification(data.title, {
                body: data.body || "New notification",
                icon: "/favicon.ico",
                tag: data.id || "notification",
                requireInteraction: true
              });
              console.log('🔔 Chrome notification displayed (fallback)');
            });
          } else {
            // Final fallback
            new Notification(data.title, {
              body: data.body || "New notification",
              icon: "/favicon.ico",
              tag: data.id || "notification",
              requireInteraction: true
            });
            console.log('🔔 Chrome notification displayed (basic)');
          }
        } else {
          console.log("🔔 User is active on CRM tab → showing only bell + toast notification");
        }
      } else {
        console.log('🔔 Chrome notification conditions not met:', { 
          permission: Notification.permission, 
          hasTitle: !!data?.title 
        });
      }
      
      // 🔥 OPTIMIZED: Single refresh call (prevent multiple refreshes)
      console.log('🔔 Triggering notification refresh...');
      refresh();
      console.log('🔔 ===== NOTIFICATION HANDLING COMPLETE =====');
    };
    
    // Listen for admin notifications (original simple approach)
    webSocketService.addEventListener('adminNotification', handleAdminNotification);
    
    // Poll every 30 seconds as fallback
    const pollingInterval = setInterval(refresh, 30000);
    
    return () => {
      clearInterval(pollingInterval);
      webSocketService.removeEventListener('adminNotification', handleAdminNotification);
    };
  }, [userId, userRole, userDepartment]);

    // 🔥 NEW: Listen for cross-tab notification events
    useEffect(() => {
      if (typeof BroadcastChannel === 'undefined') return;

      const channel = new BroadcastChannel('crm-notifications');
      
      const handleBroadcastMessage = (event) => {
        console.log('🔔 Received broadcast from another tab:', event.data);
        
        // Only process if it's for the same user
        if (event.data.user?.userId === userId && 
            event.data.user?.userRole === userRole && 
            event.data.user?.userDepartment === userDepartment) {
          
          console.log('🔔 Broadcast is for current user, triggering refresh');
          refresh();
        } else {
          console.log('🔔 Broadcast is for different user, ignoring');
        }
      };

      channel.addEventListener('message', handleBroadcastMessage);
      
      return () => {
        channel.removeEventListener('message', handleBroadcastMessage);
        channel.close();
      };
    }, [userId, userRole, userDepartment]);

    // Add tab visibility refresh
    useEffect(() => {
      const handleFocus = () => {
        console.log("🔔 Tab gained focus, refreshing notifications");
        refresh();
      };
      
      const handleVisibilityChange = () => {
        if (!document.hidden) {
          console.log("🔔 Tab became visible, refreshing notifications");
          refresh();
        }
      };
      
      window.addEventListener("focus", handleFocus);
      document.addEventListener("visibilitychange", handleVisibilityChange);
      
      return () => {
        window.removeEventListener("focus", handleFocus);
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      };
    }, [userId, userRole, userDepartment]);

  // Calculate panel position synchronously before paint
  useLayoutEffect(() => {
    if (open && bellRef.current) {
      const rect = bellRef.current.getBoundingClientRect();
      const panelWidth = Math.min(420, window.innerWidth - 16);
      const rightEdge = window.innerWidth - rect.right;
      setPanelPos({
        top: rect.bottom + 8,
        right: Math.max(8, rightEdge),
        width: panelWidth,
      });
    } else {
      setPanelPos(null);
    }
  }, [open]);

  // ✅ All Firebase and WebSocket functionality is working correctly
  // ✅ Tab visibility notifications are implemented  
  // ✅ React toast notifications are working

  return (
    <div className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 px-4 sm:px-6 backdrop-blur">
      <div className="flex items-center justify-between gap-4">
        <div className="flex gap-4 sm:gap-6 overflow-x-auto scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent max-w-full">
          {tabs.map(tab => {
            const isActive = activeTabKey === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => onTabClick(tab)}
                suppressHydrationWarning
                className={`py-3 px-1 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border-indigo-600 text-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="relative flex-shrink-0">
          <button
            ref={bellRef}
            type="button"
            onClick={() => {
              setOpen((v) => !v);
            }}
            className="relative rounded-full p-2 text-slate-600 hover:bg-slate-100 transition-all duration-200 hover:scale-105"
            aria-label="Notifications"
          >
            <Bell size={18} />
            {unread > 0 && (
              <span className="absolute -right-1 -top-1 min-w-[20px] h-5 rounded-full bg-red-500 px-1 text-center text-[10px] font-bold leading-5 text-white shadow-lg">
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </button>

          {open && panelPos && (
            <>
              <div
                className="fixed inset-0 bg-black/20 z-[9998] pointer-events-auto"
                onClick={() => setOpen(false)}
              />
              <div
                style={{
                  position: 'fixed',
                  top: panelPos.top,
                  right: panelPos.right,
                  width: panelPos.width,
                  zIndex: 9999,
                  maxHeight: '80vh',
                }}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl flex flex-col"
              >
                {/* Header */}
                <div className="bg-slate-800 text-white p-4 flex-shrink-0">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Bell className="w-5 h-5" />
                        {unread > 0 && (
                          <span className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full" />
                        )}
                      </div>
                      <div>
                        <div className="font-semibold">Notifications</div>
                        <div className="text-xs opacity-90">
                          {unread} unread • {totalCount} total
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setOpen(false)}
                      className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={refresh}
                      disabled={loading}
                      className="flex items-center gap-1 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                      Refresh
                    </button>
                    {unread > 0 && (
                      <button
                        onClick={markAllAsRead}
                        disabled={markingAll}
                        className="flex items-center gap-1 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                      >
                        <CheckCheck className={`w-3 h-3 ${markingAll ? 'animate-pulse' : ''}`} />
                        Mark All Read
                      </button>
                    )}
                    {items.length > 0 && (
                      <button
                        onClick={deleteAllNotifications}
                        className="flex items-center gap-1 px-3 py-1.5 bg-red-500/80 hover:bg-red-600 rounded-lg text-xs font-medium transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                        Clear All
                      </button>
                    )}
                  </div>
                </div>

                {/* Notifications List - Scrollable */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden">
                  {loading ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <RefreshCw className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
                      <div className="text-sm text-slate-500">Loading notifications...</div>
                    </div>
                  ) : error ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                        <X className="w-6 h-6 text-red-500" />
                      </div>
                      <div className="text-sm font-medium text-slate-900 mb-1">Connection Error</div>
                      <div className="text-xs text-slate-500 mb-4">{error}</div>
                      <button
                        onClick={refresh}
                        className="px-4 py-2 bg-indigo-500 text-white text-sm rounded-lg hover:bg-indigo-600 transition-colors"
                      >
                        Try Again
                      </button>
                    </div>
                  ) : items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                        <Bell className="w-6 h-6 text-slate-400" />
                      </div>
                      <div className="text-sm font-medium text-slate-900 mb-1">No notifications</div>
                      <div className="text-xs text-slate-500">You're all caught up!</div>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {items.map((n) => {
                        let notificationData = {};
                        try {
                          if (n.dataJson) {
                            notificationData = JSON.parse(n.dataJson);
                          }
                        } catch (e) {
                          console.warn('Failed to parse notification data:', e);
                        }

                        const isTaskStatusUpdate = n.type === 'TASK_STATUS_UPDATED';
                        const isTaskAssigned = n.type === 'TASK_ASSIGNED';
                        const isUnread = !n.readAt;

                        return (
                          <div
                            key={n.id}
                            className={`relative group transition-all duration-200 ${
                              isUnread ? 'bg-blue-50' : 'hover:bg-slate-50'
                            }`}
                          >
                            {/* Unread indicator */}
                            {isUnread && (
                              <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500" />
                            )}
                            
                            <div className="p-4">
                              {/* Header */}
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3 flex-1">
                                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                    isTaskStatusUpdate ? 'bg-blue-100 text-blue-600' : 
                                    isTaskAssigned ? 'bg-green-100 text-green-600' : 
                                    'bg-slate-100 text-slate-600'
                                  }`}>
                                    {isTaskStatusUpdate ? <RefreshCw className="w-4 h-4" /> :
                                     isTaskAssigned ? <User className="w-4 h-4" /> :
                                     <Bell className="w-4 h-4" />}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="font-semibold text-slate-900 text-sm truncate">
                                      {n.title}
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                                      <Clock className="w-3 h-3 flex-shrink-0" />
                                      <span className="truncate">
                                        {new Date(n.createdAt).toLocaleDateString()} • 
                                        {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                
                                {/* Action buttons */}
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                  {isUnread && (
                                    <button
                                      onClick={() => markAsRead(n.id)}
                                      className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors"
                                      title="Mark as read"
                                    >
                                      <Check className="w-3 h-3 text-slate-600" />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => deleteNotification(n.id)}
                                    className="p-1.5 hover:bg-red-100 rounded-lg transition-colors"
                                    title="Delete notification"
                                  >
                                    <Trash2 className="w-3 h-3 text-red-500" />
                                  </button>
                                </div>
                              </div>

                              {/* Task Details */}
                              {(isTaskStatusUpdate || isTaskAssigned) && notificationData ? (
                                <div className="ml-11 space-y-2">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                      <User className="w-3 h-3 text-slate-400 flex-shrink-0" />
                                      <span className="text-xs text-slate-500">Customer:</span>
                                      <span className="text-xs font-medium text-slate-900 truncate">
                                        {notificationData.clientName || 'Unknown'}
                                      </span>
                                    </div>
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${
                                      notificationData.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                                      notificationData.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' :
                                      notificationData.status === 'DELAYED' ? 'bg-yellow-100 text-yellow-800' :
                                      notificationData.status === 'CANCELLED' ? 'bg-red-100 text-red-800' :
                                      notificationData.status === 'INQUIRY' ? 'bg-purple-100 text-purple-800' :
                                      'bg-gray-100 text-gray-800'
                                    }`}>
                                      {notificationData.status}
                                    </span>
                                  </div>
                                  
                                  {notificationData.clientAddress && (
                                    <div className="flex items-center gap-2">
                                      <Calendar className="w-3 h-3 text-slate-400 flex-shrink-0" />
                                      <span className="text-xs text-slate-500">Address:</span>
                                      <span className="text-xs text-slate-700 truncate">
                                        {notificationData.clientAddress}
                                      </span>
                                    </div>
                                  )}
                                  
                                  {notificationData.updatedBy && (
                                    <div className="flex items-center gap-2">
                                      <User className="w-3 h-3 text-slate-400 flex-shrink-0" />
                                      <span className="text-xs text-slate-500">Updated by:</span>
                                      <span className="text-xs font-medium text-slate-900 truncate">
                                        {notificationData.updatedBy}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="ml-11">
                                  <div className="text-sm text-slate-600">{n.body}</div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
