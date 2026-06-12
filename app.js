import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://odgfsyagqoicqjblkdhi.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kZ2ZzeWFncW9pY3FqYmxrZGhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyMTYxNDYsImV4cCI6MjA5Njc5MjE0Nn0.BHpER7kf9J6jwaUpskROq4vRK_bH-YtcdBKXHuYfMXk";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// =========================
// DOM ELEMENTS
// =========================
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

// =========================
// MAP SETUP
// =========================
let map;
let markerLayer;
let clickMarker;

function initMap() {
  map = L.map("map", {
    zoomControl: true,
    minZoom: 2,
  }).setView([37.4, -122.0], 11); // Bay Area-ish default

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);

  markerLayer = L.markerClusterGroup({
    showCoverageOnHover: false,
    maxClusterRadius: 50,
  });
  map.addLayer(markerLayer);

  map.on("click", (e) => {
    const { lat, lng } = e.latlng;
    latInput.value = lat.toFixed(6);
    lngInput.value = lng.toFixed(6);
    locationStatus.textContent = `Location set: ${lat.toFixed(
      4
    )}, ${lng.toFixed(4)}`;

    if (clickMarker) {
      map.removeLayer(clickMarker);
    }
    clickMarker = L.circleMarker([lat, lng], {
      radius: 7,
      color: "#4f46e5",
      weight: 2,
      fillColor: "#a5b4fc",
      fillOpacity: 0.8,
    }).addTo(map);
  });
}

// =========================
// DATA FETCHING
// =========================

async function fetchReports() {
  // Use PostgREST function aliasing to extract lat/lng from PostGIS geography
  const { data, error } = await supabase
    .from("reports")
    .select(
      `
      id,
      download_mbps,
      upload_mbps,
      ping_ms,
      jitter_ms,
      isp,
      rating,
      created_at,
      lng:ST_X(location::geometry),
      lat:ST_Y(location::geometry)
    `
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("Error fetching reports:", error);
    return [];
  }

  return data.filter((r) => r.lat !== null && r.lng !== null);
}

function ratingColor(rating) {
  switch (rating) {
    case "smooth":
      return "#22c55e";
    case "ok":
      return "#eab308";
    case "bad":
      return "#f97316";
    case "unusable":
      return "#ef4444";
    default:
      return "#6b7280";
  }
}

function addReportsToMap(reports) {
  markerLayer.clearLayers();

  reports.forEach((r) => {
    const lat = r.lat;
    const lng = r.lng;
    if (lat == null || lng == null) return;

    const color = ratingColor(r.rating);

    const marker = L.circleMarker([lat, lng], {
      radius: 6,
      color,
      weight: 2,
      fillColor: color,
      fillOpacity: 0.7,
    });

    const popupHtml = `
      <div class="popup">
        <div><strong>${r.isp || "Unknown ISP"}</strong></div>
        <div style="margin-top:4px;font-size:12px;">
          <div>Download: <strong>${r.download_mbps ?? "?"}</strong> Mbps</div>
          <div>Upload: <strong>${r.upload_mbps ?? "?"}</strong> Mbps</div>
          <div>Ping: <strong>${r.ping_ms ?? "?"}</strong> ms</div>
          <div>Jitter: <strong>${r.jitter_ms ?? "?"}</strong> ms</div>
          <div>Experience: <strong>${r.rating || "?"}</strong></div>
          <div style="margin-top:4px;color:#9ca3af;">
            ${new Date(r.created_at).toLocaleString()}
          </div>
        </div>
      </div>
    `;

    marker.bindPopup(popupHtml);
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

  statDownload.textContent = `${avg(
    reports.map((r) => r.download_mbps)
  ).toFixed(1)} Mbps`;
  statUpload.textContent = `${avg(
    reports.map((r) => r.upload_mbps)
  ).toFixed(1)} Mbps`;
  statPing.textContent = `${avg(
    reports.map((r) => r.ping_ms)
  ).toFixed(1)} ms`;
  statCount.textContent = `${reports.length}`;
}

async function refreshData() {
  refreshBtn.disabled = true;
  refreshBtn.textContent = "Refreshing…";
  const reports = await fetchReports();
  addReportsToMap(reports);
  updateStats(reports);
  refreshBtn.disabled = false;
  refreshBtn.textContent = "Refresh data";
}

// =========================
// FORM SUBMISSION
// =========================

function setFormMessage(text, type = "info") {
  formMessage.textContent = text;
  formMessage.style.color =
    type === "error"
      ? "#f97373"
      : type === "success"
      ? "#4ade80"
      : "#9ca3af";
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const lat = parseFloat(latInput.value);
  const lng = parseFloat(lngInput.value);

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    setFormMessage("Click on the map to set your location first.", "error");
    return;
  }

  const download = parseFloat(downloadInput.value);
  const upload = parseFloat(uploadInput.value);
  const ping = parseFloat(pingInput.value);
  const jitter = parseFloat(jitterInput.value);
  const isp = ispInput.value.trim();
  const rating = ratingSelect.value;

  if (!rating || !isp) {
    setFormMessage("ISP and experience are required.", "error");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Submitting…";
  setFormMessage("");

  const locationWkt = `SRID=4326;POINT(${lng} ${lat})`;

  const { error } = await supabase.from("reports").insert({
    download_mbps: Number.isNaN(download) ? null : download,
    upload_mbps: Number.isNaN(upload) ? null : upload,
    ping_ms: Number.isNaN(ping) ? null : ping,
    jitter_ms: Number.isNaN(jitter) ? null : jitter,
    isp,
    rating,
    location: locationWkt,
  });

  if (error) {
    console.error("Insert error:", error);
    setFormMessage("Failed to submit report. Check console.", "error");
  } else {
    setFormMessage("Report submitted. Thank you!", "success");
    form.reset();
    locationStatus.textContent = "Click on the map to set location";
    latInput.value = "";
    lngInput.value = "";
    if (clickMarker) {
      map.removeLayer(clickMarker);
      clickMarker = null;
    }
    await refreshData();
  }

  submitBtn.disabled = false;
  submitBtn.textContent = "Submit report";
});

// =========================
// INIT
// =========================

window.addEventListener("DOMContentLoaded", async () => {
  initMap();
  await refreshData();
});

refreshBtn.addEventListener("click", () => {
  refreshData();
});
