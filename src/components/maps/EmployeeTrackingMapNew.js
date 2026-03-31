"use client";

import React, { useEffect, useState, useRef } from "react";
import MapCanvas from "./MapCanvas";
import EmployeeListEnhanced from "./EmployeeListEnhanced";
import NotificationToast from "./NotificationToast";
import RouteLayer from "./RouteLayer";
import TimelineSlider from "./TimelineSlider";
import NotificationPanel from "./NotificationPanel";
import MarkersLayer from "./MarkersLayer";
import IdleHeatmapLayer from "./IdleHeatmapLayer";
import TaskList from "./TaskList";

export default function EmployeeTrackingMap() {
  const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  const [employees, setEmployees] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [status, setStatus] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [alert, setAlert] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [timelineHour, setTimelineHour] = useState(9);
  const [routePoints, setRoutePoints] = useState([]);
  const [dailyEvents, setDailyEvents] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [map, setMap] = useState(null);
  const [maps, setMaps] = useState(null);
  const [infoWindow, setInfoWindow] = useState(null);
  const markersRef = useRef(new Map());

  // Load STOMP.js + SockJS scripts
  useEffect(() => {
    if (window.StompJs && window.SockJS) return;
    
    const stompScript = document.createElement("script");
    stompScript.src = "https://unpkg.com/@stomp/stompjs@7.0.0/bundles/stomp.umd.min.js";
    stompScript.async = true;
    stompScript.onload = () => console.log("STOMP.js loaded");
    stompScript.onerror = () => console.error("Failed to load STOMP.js");
    document.head.appendChild(stompScript);

    const sockjsScript = document.createElement("script");
    sockjsScript.src = "https://cdn.jsdelivr.net/npm/sockjs-client@1/dist/sockjs.min.js";
    sockjsScript.async = true;
    sockjsScript.onload = () => console.log("SockJS loaded");
    sockjsScript.onerror = () => console.error("Failed to load SockJS");
    document.head.appendChild(sockjsScript);
    
    return () => {
      // Don't remove the script as it might be used elsewhere
    };
  }, []);

  // Handle focus location events from notifications
  useEffect(() => {
    function onFocusLocation(e) {
      const { lat, lng, employeeName } = e.detail;
      if (!map || !maps || !isFinite(lat) || !isFinite(lng)) return;
      
      try {
        map.panTo({ lat, lng });
        map.setZoom(15);
        console.log(`Focused on ${employeeName} at ${lat}, ${lng}`);
      } catch (err) {
        console.error("Failed to focus location:", err);
      }
    }
    
    window.addEventListener("FOCUS_LOCATION", onFocusLocation);
    return () => window.removeEventListener("FOCUS_LOCATION", onFocusLocation);
  }, [map, maps]);

  // WebSocket setup
  useEffect(() => {
    if (!baseUrl || !window.StompJs || !window.SockJS) return;
    const client = new window.StompJs.Client({
      webSocketFactory: () => new window.SockJS(`${baseUrl}/ws`),
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
    });
    client.onConnect = () => {
      console.log("WebSocket connected");
      client.subscribe("/topic/live-locations", (msg) => {
        const data = JSON.parse(msg.body);
        window.dispatchEvent(new CustomEvent("LIVE_LOCATION", { detail: data }));
      });

      client.subscribe("/topic/live-employees", (msg) => {
        const data = JSON.parse(msg.body);
        setEmployees((prev) => {
          const id = String(data.id);
          const next = prev.slice();
          const idx = next.findIndex((e) => String(e.id) === id);
          const patch = {
            id,
            name: data.name,
            role: data.role,
            lat: Number(data.lat ?? NaN),
            lng: Number(data.lng ?? NaN),
            currentAddress: data.currentAddress || "",
            status: data.status || "ONLINE",
            lastUpdate: data.timestamp ? new Date(data.timestamp) : null,
            punchType: data.punchType || null,
          };
          if (idx >= 0) {
            next[idx] = { ...next[idx], ...patch };
            return next;
          }
          return [...next, patch];
        });
      });

      client.subscribe("/topic/alerts", (msg) => {
        const alert = JSON.parse(msg.body);
        setAlert(alert);
        setAlerts(prev => [alert, ...prev.slice(0, 9)]);
        // Auto-hide toast after 5 seconds
        setTimeout(() => setAlert(null), 5000);
      });
      // 🔴 NEW: Subscribe to location-based attendance events
      client.subscribe("/topic/attendance-events", (msg) => {
        const event = JSON.parse(msg.body);
        console.log("🔴 Attendance Event:", event);
        
        // Show attendance-specific notifications
        setAlert({
          ...event,
          type: "ATTENDANCE",
          title: event.title || `${event.type} - ${event.employeeName}`,
          message: event.message || `${event.employeeName} ${event.type.toLowerCase()} at ${event.location || "customer location"}`
        });
        setAlerts(prev => [event, ...prev.slice(0, 9)]);
        setTimeout(() => setAlert(null), 5000);
      });
    };
    client.onStompError = (frame) => console.error("STOMP error:", frame);
    client.activate();
    return () => client.deactivate();
  }, [baseUrl]);

  // Fetch live employees
  async function fetchLive() {
    try {
      // Use existing live-employees endpoint for location-based attendance data
      const res = await fetch(`${baseUrl}/api/employee-locations/live-employees`);
      const json = await res.json();
      const mapped = (json.employees || []).map((e) => {
        const lat = Number(e.latitude ?? e.lat ?? e.position?.lat ?? NaN);
        const lng = Number(e.longitude ?? e.lng ?? e.position?.lng ?? NaN);
        return {
          punchType: e.punchType || null,
          id: String(e.id),
          name: e.name,
          role: e.role,
          lat,
          lng,
          currentAddress: e.currentAddress || "",
          status: e.status || "OFFLINE",
          lastUpdate: e.lastUpdate ? new Date(e.lastUpdate) : null,
          // 🔴 Location-based attendance information
          activeTask: e.activeTask,
          isPunchedIn: e.isPunchedIn,
          distanceToCustomer: e.distanceToCustomer,
          canOperate: e.canOperate,
          punchInTime: e.punchInTime,
          lateMark: e.lateMark,
          autoPunch: e.autoPunch,
          decision: e.decision,
        };
      });
      setEmployees(mapped);
    } catch (err) {
      console.error(err);
      setStatus("Failed to load employees");
    }
  }

  // Fetch tasks for selected employee
  async function fetchTasks(employeeId) {
    try {
      const res = await fetch(`${baseUrl}/api/employee-locations/${employeeId}/tasks`);
      const tasksData = await res.json();
      setTasks(tasksData || []);
    } catch (err) {
      console.error("Failed to fetch tasks:", err);
      setTasks([]);
    }
  }

  // Fetch live employees and route/events on date/employee changes
  useEffect(() => {
    fetchLive();
    if (selectedEmployeeId) {
      fetchTasks(selectedEmployeeId);
      if (selectedDate) {
        loadRouteAndEvents();
      }
    }
  }, [selectedEmployeeId, selectedDate]);

  // ✅ FIX #7: 30s polling fallback in case WebSocket disconnects
  useEffect(() => {
    const interval = setInterval(fetchLive, 30000);
    return () => clearInterval(interval);
  }, []);

  function focusEmployee(e) {
    if (!map || !maps) {
      console.warn("Map not ready yet");
      return;
    }
    if (!isFinite(e.lat) || !isFinite(e.lng)) {
      alert("Employee has no live location yet");
      return;
    }
    try {
      map.panTo({ lat: e.lat, lng: e.lng });
      map.setZoom(15);
    } catch (err) {
      console.error("Failed to focus employee", err);
    }
  }

  // Load route and daily events for selected employee/date
  async function loadRouteAndEvents() {
    if (!selectedEmployeeId) return;
    try {
      const [routeRes, eventsRes] = await Promise.all([
        fetch(`${baseUrl}/api/employee-locations/${selectedEmployeeId}/route?date=${selectedDate}`),
        fetch(`${baseUrl}/api/employee-locations/${selectedEmployeeId}/events?date=${selectedDate}`)
      ]);
      
      const points = await routeRes.json();
      const events = await eventsRes.json();
      
      setRoutePoints(points || []);
      setDailyEvents(events || []);
      
      if (!points || points.length === 0) {
        setStatus("No route data available for this date");
        setTimeout(() => setStatus(""), 3000);
      } else {
        setStatus("");
      }
      
      if (!events || events.length === 0) {
        console.log("No events data available for this date");
      }
    } catch (err) {
      console.error("Failed to load route and events", err);
      setStatus("Failed to load data");
      setTimeout(() => setStatus(""), 3000);
    }
  }

  // Play route animation
  function playRoute() {
    if (!routePoints.length || !map || !maps) return;
    const marker = new maps.Marker({
      map,
      position: routePoints[0],
      icon: {
        path: maps.SymbolPath.FORWARD_CLOSED_ARROW,
        scale: 4,
        strokeColor: "#2563eb"
      }
    });
    let i = 0;
    const interval = setInterval(() => {
      if (i >= routePoints.length) {
        clearInterval(interval);
        return;
      }
      marker.setPosition(routePoints[i]);
      map.panTo(routePoints[i]);
      i++;
    }, 800);
  }

  // Timeline control
  function handleTimelineChange(hour) {
    setTimelineHour(hour);
    if (routePoints.length > 0) {
      // Find point closest to selected hour
      const targetTime = new Date(selectedDate);
      targetTime.setHours(hour, 0, 0, 0);
      
      let closestIndex = 0;
      let minDiff = Math.abs(new Date(routePoints[0].timestamp) - targetTime);
      
      for (let i = 1; i < routePoints.length; i++) {
        const diff = Math.abs(new Date(routePoints[i].timestamp) - targetTime);
        if (diff < minDiff) {
          minDiff = diff;
          closestIndex = i;
        }
      }

      if (map && maps) {
        const point = routePoints[closestIndex];
        map.panTo({ lat: point.lat, lng: point.lng });
      }
    }
  }

  return (
    <div className="grid grid-cols-[360px_1fr] h-[calc(100vh-20px)] gap-3 p-3">
      {/* Sidebar */}
      <div className="space-y-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <h2 className="font-bold text-base mb-1">Employee Tracking</h2>
          <p className="text-xs text-gray-500 mb-3">Live from database. Search and click any employee to focus on their latest location.</p>

          <div className="flex gap-2 mb-3">
            <input
              placeholder="Search by name or role..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="flex-1 px-3 py-2 rounded-full border border-gray-300 text-sm"
            />
          </div>

          <EmployeeListEnhanced
            employees={employees}
            searchText={searchText}
            selectedId={selectedEmployeeId}
            onSelectEmployee={(e) => {
              setSelectedEmployeeId(e.id);
              focusEmployee(e);
            }}
          />
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm space-y-3">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
          />
          <button
            onClick={loadRouteAndEvents}
            className="w-full px-3 py-2 rounded-lg bg-blue-600 text-white text-sm"
          >
            Load Route + Stops
          </button>
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={playRoute}
              className="px-3 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
            >
              ▶ Play Route
            </button>
            <TimelineSlider
              value={timelineHour}
              onChange={handleTimelineChange}
            />
          </div>
        </div>

        <TaskList tasks={tasks} />

        <NotificationPanel baseUrl={baseUrl} alerts={alerts} />

        {status && <div className="text-xs text-red-600">{status}</div>}
      </div>

      {/* Map */}
      <div className="relative">
        <MapCanvas
          apiKey={apiKey}
          onMapReady={(mapInstance, mapsInstance, infoInstance) => {
            setMap(mapInstance);
            setMaps(mapsInstance);
            setInfoWindow(infoInstance);
          }}
        />
        {map && maps && (
          <>
            <MarkersLayer map={map} maps={maps} employees={employees} dailyEvents={dailyEvents} infoWindow={infoWindow} />
            <RouteLayer map={map} maps={maps} points={routePoints} />
            <IdleHeatmapLayer map={map} maps={maps} dailyEvents={dailyEvents} />
          </>
        )}
        <NotificationToast alert={alert} />
      </div>
    </div>
  );
}
