import { createClient } from "https://esm.sh/@supabase/supabase-js@2";


const SUPABASE_URL = "https://odgfsyagqoicqjblkdhi.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kZ2ZzeWFncW9pY3FqYmxrZGhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyMTYxNDYsImV4cCI6MjA5Njc5MjE0Nn0.BHpER7kf9J6jwaUpskROq4vRK_bH-YtcdBKXHuYfMXk";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// =======================================
// DOM ELEMENTS
// =======================================
const form = document.getElementById("report-form");
const downloadInput = document.getElementById("download");
const uploadInput = document.getElementById("upload");
const pingInput = document.getElementById("ping");
const jitterInput = document.getElementById("jitter");
const ispInput = document.getElementById("isp");
const ratingSelect = document.getElementById("rating");
const latInput = document.getElementById("lat");
const lngInput = document.getElementById("lng");
const locationStatus = document.getElementById("location-status");
const formMessage = document.getElementById("form-message");
const submitBtn = document.getElementById("submit-btn");

const statDownload = document.getElementById("stat-download");
const statUpload = document.getElementById("stat-upload");
const statPing = document.getElementById("stat-ping");
const statCount = document.getElementById("stat-count");
const refreshBtn = document.getElementById("refresh-btn");

const themeToggle = document.getElementById("theme-toggle");

// =======================================
// THEME SYSTEM
// =======================================
function applyTheme(theme) {
  if (theme === "dark") {
    document.documentElement.classList.add("dark");
    themeToggle.textContent = "☀️ Light";
  } else {
    document.documentElement.classList.remove("dark");
    themeToggle.textContent = "🌙 Dark";
  }
  localStorage.setItem("theme", theme);
}

themeToggle.addEventListener("click", () => {
  const current = localStorage.getItem("theme") || "dark";
  applyTheme(current === "dark" ? "light" : "dark");
});

// Load saved theme
applyTheme(localStorage.getItem("theme") || "dark");

// =======================================
// MAP SETUP
// =======================================
let map;
let markerLayer;
let clickMarker;

let lightTiles;
let darkTiles;

function initMap() {
  map = L.map("map", {
    zoomControl: true,
    minZoom: 2,
    maxBounds: [
      [-85, -180],
      [85, 180]
    ],
    maxBoundsViscosity: 1.0,
    worldCopyJump: false,
    noWrap: true
  }).setView([37.4, -122.0], 11);

  // Light + Dark tile layers
  lightTiles = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    noWrap: true
  });

  darkTiles = L.tileLayer(
    "https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png",
    {
      maxZoom: 19,
      noWrap: true
    }
  );

  // Default theme
  if (document.documentElement.classList.contains("dark")) {
    darkTiles.addTo(map);
  } else {
    lightTiles.addTo(map);
  }

  // Switch tiles on theme toggle
  function updateMapTheme() {
    if (document.documentElement.classList.contains("dark")) {
      map.removeLayer(lightTiles);
      map.addLayer(darkTiles);
    } else {
      map.removeLayer(darkTiles);
      map.addLayer(lightTiles);
    }
  }

  themeToggle.addEventListener("click", updateMapTheme);

  // Marker clustering
  markerLayer = L.markerClusterGroup({
    showCoverageOnHover: false,
    maxClusterRadius: 50
  });
  map.addLayer(markerLayer);

  // Click to set location
  map.on("click", (e) => {
    const { lat, lng } = e.latlng;
    latInput.value = lat.toFixed(6);
    lngInput.value = lng.toFixed(6);
    locationStatus.textContent = `Location set: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;

    if (clickMarker) map.removeLayer(clickMarker);

    clickMarker = L.circleMarker([lat, lng], {
      radius: 7,
      color: "#4f46e5",
      weight: 2,
      fillColor: "#a5b4fc",
      fillOpacity: 0.8
    }).addTo(map);
  });
}

// =======================================
// FETCH REPORTS (FROM VIEW)
// =======================================
async function fetchReports() {
  const { data, error } = await supabase
    .from("reports_with_coords")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("Fetch error:", error);
    return [];
  }

  return data.filter((r) => r.lat !== null && r.lng !== null);
}

function ratingColor(rating) {
  return {
    smooth: "#22c55e",
    ok: "#eab308",
    bad: "#f97316",
    unusable: "#ef4444"
  }[rating] || "#6b7280";
}

function addReportsToMap(reports) {
  markerLayer.clearLayers();

  reports.forEach((r) => {
    const marker = L.circleMarker([r.lat, r.lng], {
      radius: 6,
      color: ratingColor(r.rating),
      weight: 2,
      fillColor: ratingColor(r.rating),
      fillOpacity: 0.7
    });

    marker.bindPopup(`
      <div>
        <strong>${r.isp}</strong><br>
        <small>${new Date(r.created_at).toLocaleString()}</small>
        <hr>
        <div>Download: <b>${r.download_mbps}</b> Mbps</div>
        <div>Upload: <b>${r.upload_mbps}</b> Mbps</div>
        <div>Ping: <b>${r.ping_ms}</b> ms</div>
        <div>Jitter: <b>${r.jitter_ms}</b> ms</div>
        <div>Experience: <b>${r.rating}</b></div>
      </div>
    `);

    markerLayer.addLayer(marker);
  });
}

function updateStats(reports) {
  if (!reports.length) {
    statDownload.textContent = "–";
    statUpload.textContent = "–";
    statPing.textContent = "–";
    statCount.textContent = "0";
    return;
  }

  const avg = (arr) =>
    arr.reduce((sum, v) => sum + (Number(v) || 0), 0) / arr.length;

  statDownload.textContent = `${avg(reports.map((r) => r.download_mbps)).toFixed(1)} Mbps`;
  statUpload.textContent = `${avg(reports.map((r) => r.upload_mbps)).toFixed(1)} Mbps`;
  statPing.textContent = `${avg(reports.map((r) => r.ping_ms)).toFixed(1)} ms`;
  statCount.textContent = reports.length;
}

async function refreshData() {
  refreshBtn.disabled = true;
  refreshBtn.textContent = "Refreshing…";

  const reports = await fetchReports();
  addReportsToMap(reports);
  updateStats(reports);

  refreshBtn.disabled = false;
  refreshBtn.textContent = "Refresh";
}

// =======================================
// FORM SUBMISSION
// =======================================
function setFormMessage(text, type = "info") {
  formMessage.textContent = text;
  formMessage.style.color =
    type === "error"
      ? "#ef4444"
      : type === "success"
      ? "#22c55e"
      : "#6b7280";
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const lat = parseFloat(latInput.value);
  const lng = parseFloat(lngInput.value);

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    setFormMessage("Click on the map to set your location.", "error");
    return;
  }

  const payload = {
    download_mbps: parseFloat(downloadInput.value),
    upload_mbps: parseFloat(uploadInput.value),
    ping_ms: parseFloat(pingInput.value),
    jitter_ms: parseFloat(jitterInput.value),
    isp: ispInput.value.trim(),
    rating: ratingSelect.value,
    location: `POINT(${lng} ${lat})`
  };

  submitBtn.disabled = true;
  submitBtn.textContent = "Submitting…";

  const { error } = await supabase.from("reports").insert(payload);

  if (error) {
    console.error(error);
    setFormMessage("Failed to submit report.", "error");
  } else {
    setFormMessage("Report submitted!", "success");
    form.reset();
    latInput.value = "";
    lngInput.value = "";
    locationStatus.textContent = "Click map to set location";

    if (clickMarker) {
      map.removeLayer(clickMarker);
      clickMarker = null;
    }

    await refreshData();
  }

  submitBtn.disabled = false;
  submitBtn.textContent = "Submit";
});

// =======================================
// INIT
// =======================================
window.addEventListener("DOMContentLoaded", async () => {
  initMap();
  await refreshData();
});

refreshBtn.addEventListener("click", refreshData);
