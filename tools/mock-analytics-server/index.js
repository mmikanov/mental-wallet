const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);
const ERROR_RATE = parseInt(process.env.ERROR_RATE || '0', 10);
const EVENTS_FILE = path.join(__dirname, 'received_events.json');

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Ensure events file exists
function readEvents() {
  try {
    if (fs.existsSync(EVENTS_FILE)) {
      const data = fs.readFileSync(EVENTS_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch {
    // If file is corrupted, start fresh
  }
  return [];
}

function writeEvents(events) {
  fs.writeFileSync(EVENTS_FILE, JSON.stringify(events, null, 2), 'utf-8');
}

/**
 * Validates a single event has required base fields.
 */
function validateEvent(event) {
  const requiredFields = ['anonymous_user_id', 'session_id', 'event_type', 'timestamp'];
  for (const field of requiredFields) {
    if (!event[field] || typeof event[field] !== 'string') {
      return false;
    }
  }
  return true;
}

/**
 * Simulates random server errors based on ERROR_RATE env var.
 */
function shouldSimulateError() {
  if (ERROR_RATE <= 0) return false;
  if (ERROR_RATE >= 100) return true;
  return Math.random() * 100 < ERROR_RATE;
}

// POST /events — Receives Batch_Payload, validates, persists
app.post('/events', (req, res) => {
  // Simulate random 500 errors for retry testing
  if (shouldSimulateError()) {
    return res.status(500).json({ error: 'Simulated server error (ERROR_RATE)' });
  }

  const body = req.body;

  // Validate top-level structure
  if (!body || !Array.isArray(body.events)) {
    return res.status(400).json({
      error: 'Invalid payload: "events" must be an array',
    });
  }

  // Validate each event
  for (let i = 0; i < body.events.length; i++) {
    const event = body.events[i];
    if (!validateEvent(event)) {
      return res.status(400).json({
        error: `Invalid event at index ${i}: missing or invalid required fields (anonymous_user_id, session_id, event_type, timestamp)`,
      });
    }
  }

  // Persist events
  const existing = readEvents();
  const newEvents = body.events.map((event) => ({
    ...event,
    _received_at: new Date().toISOString(),
  }));
  const updated = existing.concat(newEvents);
  writeEvents(updated);

  console.log(`[${new Date().toISOString()}] Received ${body.events.length} events (total: ${updated.length})`);

  return res.status(200).json({
    accepted: body.events.length,
    total: updated.length,
  });
});

// GET /events — Returns all received events as JSON array
app.get('/events', (req, res) => {
  const events = readEvents();
  return res.status(200).json(events);
});

// DELETE /events — Clears all stored events
app.delete('/events', (req, res) => {
  writeEvents([]);
  console.log(`[${new Date().toISOString()}] All events cleared`);
  return res.status(200).json({ message: 'All events cleared' });
});

// GET /dashboard — Serves the HTML dashboard
app.get('/dashboard', (req, res) => {
  const dashboardPath = path.join(__dirname, 'dashboard.html');
  res.sendFile(dashboardPath);
});

app.listen(PORT, () => {
  console.log(`\n🔬 Mock Analytics Server running on http://localhost:${PORT}`);
  console.log(`   POST /events    — Receive batch payloads`);
  console.log(`   GET  /events    — View all received events`);
  console.log(`   DELETE /events  — Clear all events`);
  console.log(`   GET  /dashboard — View KPI dashboard`);
  console.log(`\n   ERROR_RATE: ${ERROR_RATE}% (set via env var)`);
  console.log(`   Events file: ${EVENTS_FILE}\n`);
});
