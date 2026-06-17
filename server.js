// ARV Route Planner — backend
// Holds the Google Distance Matrix API key (from env) and serves the planner UI.
// The browser never sees the key; it calls /api/* on this server, which calls Google.

const express = require("express");
const path = require("path");

const app = express();
app.use(express.json({ limit: "256kb" }));
app.use(express.static(path.join(__dirname, "public")));

const API_KEY = process.env.GOOGLE_MAPS_API_KEY || "";          // server key (Distance Matrix)
const BROWSER_KEY = process.env.GOOGLE_MAPS_BROWSER_KEY || "";  // referrer-restricted key (Maps JS + Places + Directions)
const PORT = process.env.PORT || 3000;

// Node 18+ has global fetch. Guard for older runtimes.
if (typeof fetch !== "function") {
  console.error("This server needs Node 18+ (global fetch). Current:", process.version);
}

// --- health / key presence (does NOT reveal the key) ---
app.get("/api/health", (req, res) => {
  res.json({ ok: true, keyConfigured: Boolean(API_KEY), browserKeyConfigured: Boolean(BROWSER_KEY) });
});

// --- browser config: hands the front-end the maps/places key ---
// This key is meant to be public but MUST be referrer-restricted in Google Cloud
// (locked to your Render domain) so it can't be used elsewhere.
app.get("/api/config", (req, res) => {
  res.json({ browserKey: BROWSER_KEY });
});

// --- travel time matrix ---
// body: { points: ["addr or area", ...] }  (in route order)
// returns: { legs: [{ from, to, minutes, meters, status }], totalMinutes }
app.post("/api/matrix", async (req, res) => {
  try {
    if (!API_KEY) {
      return res.status(500).json({ error: "Server has no GOOGLE_MAPS_API_KEY set. Add it in your host's environment settings." });
    }
    const points = Array.isArray(req.body.points) ? req.body.points.map(s => String(s || "").trim()).filter(Boolean) : [];
    if (points.length < 2) {
      return res.json({ legs: [], totalMinutes: 0 });
    }

    // Build consecutive legs: point[i] -> point[i+1]
    const legs = [];
    let totalSeconds = 0;

    // One Distance Matrix call per consecutive pair keeps it simple and cheap.
    // (Could batch as a full matrix, but pairwise is clearer for a route in order.)
    for (let i = 0; i < points.length - 1; i++) {
      const origin = points[i];
      const dest = points[i + 1];
      const url =
        "https://maps.googleapis.com/maps/api/distancematrix/json" +
        `?origins=${encodeURIComponent(origin)}` +
        `&destinations=${encodeURIComponent(dest)}` +
        `&mode=driving&units=metric&key=${API_KEY}`;

      let minutes = null, meters = null, status = "UNKNOWN";
      try {
        const r = await fetch(url);
        const text = await r.text();
        let data;
        try { data = JSON.parse(text); }
        catch { throw new Error("Non-JSON response from maps service (status " + r.status + ")"); }

        if (data.status === "OK") {
          const el = data.rows?.[0]?.elements?.[0];
          status = el?.status || "UNKNOWN";
          if (status === "OK") {
            meters = el.distance?.value ?? null;
            const secs = el.duration?.value ?? null;
            if (secs != null) { minutes = Math.round(secs / 60); totalSeconds += secs; }
          }
        } else {
          status = data.status + (data.error_message ? ": " + data.error_message : "");
        }
      } catch (legErr) {
        // One bad leg shouldn't sink the whole route — record it and continue.
        status = "ERROR: " + legErr.message;
      }
      legs.push({ from: origin, to: dest, minutes, meters, status });
    }

    res.json({ legs, totalMinutes: Math.round(totalSeconds / 60) });
  } catch (err) {
    console.error("matrix error", err);
    res.status(500).json({ error: "Failed to reach the travel-time service." });
  }
});

app.listen(PORT, () => {
  console.log(`ARV Route Planner running on http://localhost:${PORT}`);
  console.log(`Distance Matrix key configured: ${Boolean(API_KEY)}`);
});
