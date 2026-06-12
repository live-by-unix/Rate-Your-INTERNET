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

const ispFilter = document.getElementById("isp-filter");
const ratingFilter = document.getElementById("rating-filter");
const heatmapToggle = document.getElementById("heatmap-toggle");
const searchInput = document.getElementById("search-input");
const searchBtn = document.getElementById("search-btn");
const exportBtn = document.getElementById("export-btn");

// =======================================
// GLOBAL STATE
// =======================================
let map;
let markerLayer;
let clickMarker;

let lightTiles;
let darkTiles;

let allReports = [];
let heatLayer = null;

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
    .limit(2000);

  if (error) {
    console.error("Fetch error:", error);
    return [];
  }

  return data.filter((r) => r.lat !== null && r.lng !== null);
}

// =======================================
// FILTERING
// =======================================
function filteredReports() {
  const isp = ispFilter.value;
  const rating = ratingFilter.value;

  return allReports.filter((r) => {
    if (isp && r.isp !== isp) return false;
    if (rating && r.rating !== rating) return false;
    return true;
  });
}

// =======================================
// MAP MARKERS
// =======================================
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

// =======================================
// HEATMAP
// =======================================
function updateHeatmap(reports) {
  if (heatLayer) {
    map.removeLayer(heatLayer);
    heatLayer = null;
  }

  const points = reports.map((r) => [
    r.lat,
    r.lng,
    r.rating === "unusable"
      ? 1.0
      : r.rating === "bad"
      ? 0.8
      : r.rating === "ok"
      ? 0.4
      : 0.2
  ]);

  if (!points.length) return;

  heatLayer = L.heatLayer(points, {
    radius: 25,
    blur: 15,
    maxZoom: 17
  });

  if (heatmapToggle.dataset.active === "true") {
    heatLayer.addTo(map);
  }
}

// =======================================
// STATS
// =======================================
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

// =======================================
// ISP FILTER POPULATION
// =======================================
function populateIspFilter() {
  const current = ispFilter.value;
  const isps = Array.from(
    new Set(allReports.map((r) => r.isp).filter(Boolean))
  ).sort();

  ispFilter.innerHTML = `<option value="">All ISPs</option>` +
    isps.map((isp) => `<option value="${isp}">${isp}</option>`).join("");

  if (current) ispFilter.value = current;
}

// =======================================
// CENTRAL RENDER FUNCTION
// =======================================
function applyFiltersAndRender() {
  const reports = filteredReports();
  addReportsToMap(reports);
  updateStats(reports);
  updateHeatmap(reports);
  populateIspFilter();
}

// =======================================
// REFRESH DATA
// =======================================
async function refreshData() {
  refreshBtn.disabled = true;
  refreshBtn.textContent = "Refreshing…";

  allReports = await fetchReports();

  // Offline caching
  if (allReports.length) {
    localStorage.setItem("nim_reports_cache", JSON.stringify(allReports));
  }

  applyFiltersAndRender();

  refreshBtn.disabled = false;
  refreshBtn.textContent = "Refresh";
}

// =======================================
// SEARCH (Nominatim)
// =======================================
async function searchLocation() {
  const q = searchInput.value.trim();
  if (!q) return;

  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
    q
  )}`;

  try {
    const res = await fetch(url, {
      headers: {
        "Accept-Language": "en"
      }
    });
    const data = await res.json();
    if (!data.length) return;

    const { lat, lon } = data[0];
    map.setView([parseFloat(lat), parseFloat(lon)], 14);
  } catch (e) {
    console.error("Search error", e);
  }
}

searchBtn.addEventListener("click", searchLocation);
searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    searchLocation();
  }
});

// =======================================
// EXPORT CSV
// =======================================
function exportCsv() {
  if (!allReports.length) return;

  const headers = [
    "id",
    "download_mbps",
    "upload_mbps",
    "ping_ms",
    "jitter_ms",
    "isp",
    "rating",
    "lat",
    "lng",
    "created_at"
  ];

  const rows = allReports.map((r) =>
    headers
      .map((h) => {
        const v = r[h];
        if (v == null) return "";
        const s = String(v);
        return s.includes(",") ? `"${s.replace(/"/g, '""')}"` : s;
      })
      .join(",")
  );

  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `internet-map-${new Date().toISOString().slice(0, 19)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

exportBtn.addEventListener("click", exportCsv);

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

  // Load cached data first (offline mode)
  const cached = localStorage.getItem("nim_reports_cache");
  if (cached) {
    try {
      allReports = JSON.parse(cached);
      applyFiltersAndRender();
    } catch {}
  }

  await refreshData();
});

refreshBtn.addEventListener("click", refreshData);
ispFilter.addEventListener("change", applyFiltersAndRender);
ratingFilter.addEventListener("change", applyFiltersAndRender);

heatmapToggle.addEventListener("click", () => {
  const active = heatmapToggle.dataset.active === "true";
  const next = !active;
  heatmapToggle.dataset.active = next ? "true" : "false";
  heatmapToggle.textContent = next ? "Heatmap: On" : "Heatmap: Off";

  const reports = filteredReports();
  updateHeatmap(reports);
});
