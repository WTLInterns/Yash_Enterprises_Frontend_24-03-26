"use client";

import { useEffect, useRef } from "react";

const DEFAULT_CENTER = { lat: 20.5937, lng: 78.9629 }; // India center
const DEFAULT_ZOOM = 5;

export default function MapCanvas({ apiKey, onMapReady }) {
  const mapDivRef = useRef(null);
  const mapRef    = useRef(null);
  const readyRef  = useRef(false); // per-instance flag — resets on unmount

  useEffect(() => {
    if (!apiKey) return;

    function initializeMap() {
      if (readyRef.current || !mapDivRef.current) return;
      if (!window.google?.maps) return;

      try {
        // ✅ FIX #2: Use window.google.maps.Map directly — avoids collision with JS built-in Map
        const mapInstance = new window.google.maps.Map(mapDivRef.current, {
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
          mapId: "employee_tracking_map",
        });

        const infoInstance = new window.google.maps.InfoWindow();
        readyRef.current = true;
        console.log("MapCanvas: Map initialized successfully");

        if (onMapReady) {
          onMapReady(mapInstance, window.google.maps, infoInstance);
        }
      } catch (error) {
        console.error("MapCanvas: Failed to initialize map", error);
      }
    }

    // Already loaded
    if (window.google?.maps) {
      initializeMap();
      return;
    }

    // Script already in DOM — wait for it
    const existingScript = document.getElementById("google-maps-script");
    if (existingScript) {
      console.log("MapCanvas: Script exists, waiting for load");
      // If google maps already loaded but initMap was deleted, just init directly
      if (window.google?.maps) {
        initializeMap();
      } else {
        existingScript.addEventListener("load", initializeMap, { once: true });
      }
      return;
    }

    // Set window.initMap BEFORE appending the script
    window.initMap = () => {
      console.log("MapCanvas: Google Maps callback triggered");
      initializeMap();
    };

    const script = document.createElement("script");
    script.id  = "google-maps-script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&v=weekly&libraries=marker,visualization&callback=initMap&loading=async`;
    script.async = true;
    script.defer = true;
    script.onerror = () => console.error("MapCanvas: Failed to load Google Maps script");
    document.head.appendChild(script);

    return () => {
      readyRef.current = false;
      // Don't delete window.initMap — script may still be loading
    };
  }, [apiKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={mapDivRef}
      className="w-full h-full rounded-xl border border-gray-200"
      style={{ minHeight: "600px", backgroundColor: "#f3f4f6" }}
    />
  );
}
