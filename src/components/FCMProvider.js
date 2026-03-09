"use client";

import { useEffect, useState } from "react";
import { listenForegroundMessages } from "@/lib/web_push";
import { toast } from "react-toastify";

export default function FCMProvider({ children }) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;
    
    let unsubscribe = null;

    const initializeFCM = async () => {
      try {
        // Only run FCM in browser environment
        if (typeof window === 'undefined') return;
        
        unsubscribe = listenForegroundMessages((payload) => {
          console.log("✅ Foreground FCM message:", payload);
          
          const { notification } = payload;
          if (notification) {
            toast.info(notification.title || "New Notification", {
              position: "top-right",
              autoClose: 5000,
              hideProgressBar: false,
              closeOnClick: true,
              pauseOnHover: true,
              draggable: true,
              body: notification.body || "",
            });
          }
        });
      } catch (error) {
        console.warn("⚠️ Failed to initialize FCM foreground messages:", error);
      }
    };

    initializeFCM();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [isClient]);

  return <>{children}</>;
}
