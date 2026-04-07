/*
  ============================================================
  BOOKING SYSTEM — FULL WORKFLOW TEST
  ============================================================
  Run:  node test-booking-workflow.js

  Prerequisites:
    - Server running on http://localhost:5000
    - MongoDB seeded with clients + PSW workers
    - Postal-code cache built on startup

  This script walks through every step of the unified booking
  pipeline (same flow for API / frontend and voice agent):

    Step 0  -  Verify postal-code cache is warm
    Step 1  -  Create a booking request (Toronto downtown)
    Step 2  -  Check availability (PSW matching + real availability)
    Step 3  -  Save contact info
    Step 4  -  Select a PSW from the matched list
    Step 5  -  Confirm the booking request
    Step 6  -  Finalize → creates Booking + BookingSlots
    Step 7  -  Verify Booking was created
    Step 8  -  Verify duplicate finalize is blocked
    Step 9  -  Create a second request (Scarborough, evening)
    Step 10 -  Full pipeline for second request
    Step 11 -  Create a recurring booking block (legacy flow)
    Step 12 -  Cancel a booking
    Step 13 -  Verify cancelled booking can't be updated

Method	Endpoint	Purpose
GET	/psws	List all PSW workers
GET	/psws/cache/stats	Postal code cache stats
GET	/psws/cache/lookup/:postalCode	Lookup PSWs by postal code
POST	/booking-requests	Create booking request
GET	/booking-requests/:id/availability	Check PSW availability/matching
PATCH	/booking-requests/:id/contact	Save contact info
PATCH	/booking-requests/:id/select-psw	Select a PSW
PATCH	/booking-requests/:id/confirm	Confirm request (validates all fields)
POST	/booking-requests/:id/finalize	Finalize → Booking + slots
POST	/booking-blocks	Create recurring block (legacy)
GET	/bookings	List all bookings
GET	/bookings/:id	Get single booking
PUT	/bookings/:id	Update booking
DELETE	/bookings/:id	Cancel booking
*/

const BASE = "http://localhost:5000";

// Auth token — set after registration
let AUTH_TOKEN = "";

// helpers

async function request(method, path, body) {
  const url = `${BASE}${path}`;
  const opts = {
    method,
    headers: { "Content-Type": "application/json" }
  };
  if (AUTH_TOKEN) {
    opts.headers["Authorization"] = `Bearer ${AUTH_TOKEN}`;
  }
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(url, opts);
  const text = await res.text();

  let data;
  try { data = JSON.parse(text); } catch { data = text; }

  return { status: res.status, data };
}

function print(label, obj) {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  ${label}`);
  console.log("═".repeat(60));
  console.log(JSON.stringify(obj, null, 2));
}

function assert(condition, msg) {
  if (!condition) {
    console.error(`\n  ✗ FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`  ✓ ${msg}`);
}

// workflow

async function run() {

  console.log("\n🚀  BOOKING SYSTEM — FULL WORKFLOW TEST\n");


  // ──────────────────────────────────────────────────────────
  //  AUTH: Register a test user and get JWT token
  // ──────────────────────────────────────────────────────────

  {
    // Register (or login if already exists)
    let { status, data } = await request("POST", "/auth/register", {
      email: "testuser@example.com",
      password: "Test123456",
      firstName: "Test",
      lastName: "User"
    });

    if (status === 409) {
      // Already registered — login instead
      ({ status, data } = await request("POST", "/auth/login", {
        email: "testuser@example.com",
        password: "Test123456"
      }));
    }

    print("AUTH — Register / Login", { status, email: data.user?.email, role: data.user?.role });
    assert(status === 201 || status === 200, `Auth successful (${status})`);
    assert(data.token, "Got JWT token");
    AUTH_TOKEN = data.token;
  }

  // Verify token works
  {
    const { status, data } = await request("GET", "/auth/me");
    assert(status === 200, "Token verified via /auth/me");
    assert(data.email === "testuser@example.com", `Authenticated as ${data.email}`);
  }


  // ──────────────────────────────────────────────────────────
  //  STEP 0: Verify postal-code cache
  // ──────────────────────────────────────────────────────────

  {
    const { status, data } = await request("GET", "/psws/cache/stats");
    print("STEP 0 — Cache stats", data);
    assert(status === 200, "Cache stats endpoint responds 200");
    assert(data.totalFSAs > 0, `Cache has ${data.totalFSAs} FSAs loaded`);
  }

  {
    const { status, data } = await request("GET", "/psws/cache/lookup/M5J 2N1");
    print("STEP 0b — Cache lookup for M5J 2N1", data);
    assert(status === 200, "Lookup responds 200");
    assert(data.count > 0, `Found ${data.count} worker(s) for postal code M5J 2N1`);
  }


  // ──────────────────────────────────────────────────────────
  //  STEP 1: Create booking request — Toronto downtown
  // ──────────────────────────────────────────────────────────

  let requestId1;
  {
    const { status, data } = await request("POST", "/booking-requests", {
      city: "Toronto",
      postalCode: "M5H 2N2",
      coordinates: [-79.3832, 43.6532],
      daysPerWeek: 3,
      timeOfDay: "daytime",
      visitDuration: "2-3 hours",
      lengthOfCareWeeks: 4
    });
    print("STEP 1 — Create booking request (Toronto)", data);
    assert(status === 201, "Booking request created (201)");
    assert(data._id, "Got request _id");
    assert(data.status === "pending", "Initial status is pending");
    assert(data.source === "api", "Source is api");
    assert(data.location.postalCode === "M5H 2N2", "Postal code stored correctly");
    requestId1 = data._id;
  }


  // ──────────────────────────────────────────────────────────
  //  STEP 2: Check availability (enhanced matching engine)
  // ──────────────────────────────────────────────────────────

  let matchedPSWs1 = [];
  {
    const { status, data } = await request("GET", `/booking-requests/${requestId1}/availability`);
    print("STEP 2 — Check availability (Toronto)", data);
    assert(status === 200, "Availability check responds 200");
    assert(data.availabilityCount > 0, `Found ${data.availabilityCount} available PSW(s)`);
    assert(data.topMatches && data.topMatches.length > 0, `Top matches returned: ${data.topMatches.length}`);
    matchedPSWs1 = data.topMatches;

    console.log("\n  Matched PSWs (Toronto):");
    data.topMatches.forEach((m, i) => {
      const name = `${m.psw.firstName} ${m.psw.lastName}`;
      const postal = m.psw.homeAddress?.postalCode || "N/A";
      const avail = m.availabilityStatus || "n/a";
      console.log(`    ${i + 1}. ${name} (${postal}) — score: ${(m.score ?? 0).toFixed(3)} [${avail}]`);
    });
  }


  // ──────────────────────────────────────────────────────────
  //  STEP 3: Save contact info
  // ──────────────────────────────────────────────────────────

  {
    const { status, data } = await request("PATCH", `/booking-requests/${requestId1}/contact`, {
      email: "alice@example.com",
      phone: "+14165551234"
    });
    print("STEP 3 — Save contact info", data);
    assert(status === 200, "Contact saved (200)");
    assert(data.message === "Contact saved", "Got confirmation message");
    assert(data.matchedPSWs && data.matchedPSWs.length > 0, `${data.matchedPSWs.length} matched PSWs preserved`);
  }


  // ──────────────────────────────────────────────────────────
  //  STEP 4: Select a PSW from the matched list
  // ──────────────────────────────────────────────────────────

  const selectedPSWId = matchedPSWs1[0].psw._id;
  const selectedPSWName = `${matchedPSWs1[0].psw.firstName} ${matchedPSWs1[0].psw.lastName}`;
  {
    const { status, data } = await request("PATCH", `/booking-requests/${requestId1}/select-psw`, {
      pswId: selectedPSWId
    });
    print("STEP 4 — Select PSW", data);
    assert(status === 200, "PSW selected (200)");
    assert(data.selectedPSW.pswId === selectedPSWId, `Selected PSW ID matches: ${selectedPSWId}`);
    assert(data.selectedPSW.name === selectedPSWName, `Selected PSW name: ${selectedPSWName}`);
  }

  // Test: selecting an invalid PSW should fail
  {
    const { status, data } = await request("PATCH", `/booking-requests/${requestId1}/select-psw`, {
      pswId: "000000000000000000000000"
    });
    assert(status === 404, "Selecting non-existent PSW correctly rejected (404)");
  }


  // ──────────────────────────────────────────────────────────
  //  STEP 5: Confirm the booking request
  // ──────────────────────────────────────────────────────────

  {
    const { status, data } = await request("PATCH", `/booking-requests/${requestId1}/confirm`);
    print("STEP 5 — Confirm booking request", data);
    assert(status === 200, "Request confirmed (200)");
    assert(data.status === "confirmed", "Status changed to confirmed");
  }


  // ──────────────────────────────────────────────────────────
  //  STEP 6: Finalize → creates Booking + BookingSlots
  // ──────────────────────────────────────────────────────────

  let bookingId;
  {
    const { status, data } = await request("POST", `/booking-requests/${requestId1}/finalize`);
    print("STEP 6 — Finalize booking", data);
    assert(status === 201, "Booking finalized (201)");
    assert(data.bookingId, "Got booking _id");
    assert(data.summary.pswName === selectedPSWName, `Booking assigned to ${selectedPSWName}`);
    assert(data.summary.totalSlots > 0, `Created ${data.summary.totalSlots} booking slots`);
    assert(data.summary.recurring === true, "Booking is recurring (4 weeks)");
    assert(data.summary.status === "confirmed", "Booking status is confirmed");
    bookingId = data.bookingId;

    console.log(`\n  Booking summary:`);
    console.log(`    PSW:     ${data.summary.pswName}`);
    console.log(`    Slots:   ${data.summary.totalSlots}`);
    console.log(`    Start:   ${data.summary.startDate}`);
    console.log(`    End:     ${data.summary.endDate}`);
  }


  // ──────────────────────────────────────────────────────────
  //  STEP 7: Verify the booking exists
  // ──────────────────────────────────────────────────────────

  {
    const { status, data } = await request("GET", `/bookings/${bookingId}`);
    print("STEP 7 — Verify booking created", data);
    assert(status === 200, "Booking found (200)");
    assert(data.status === "confirmed", "Booking is confirmed");
    assert(data.recurring === true, "Booking is recurring");
  }


  // ──────────────────────────────────────────────────────────
  //  STEP 8: Verify duplicate finalize is blocked
  // ──────────────────────────────────────────────────────────

  {
    const { status, data } = await request("POST", `/booking-requests/${requestId1}/finalize`);
    print("STEP 8 — Duplicate finalize attempt", data);
    assert(status === 400, "Duplicate finalize correctly rejected (400)");
    assert(data.message.includes("booked"), "Error says request is already booked");
  }


  // ──────────────────────────────────────────────────────────
  //  STEP 9: Create second request (Scarborough, evening)
  // ──────────────────────────────────────────────────────────

  let requestId2;
  {
    const { status, data } = await request("POST", "/booking-requests", {
      city: "Scarborough",
      postalCode: "M1P 4P5",
      coordinates: [-79.2577, 43.7731],
      daysPerWeek: 2,
      timeOfDay: "evening",
      visitDuration: "1 hour",
      lengthOfCareWeeks: 8
    });
    print("STEP 9 — Create booking request (Scarborough)", data);
    assert(status === 201, "Scarborough request created (201)");
    assert(data.status === "pending", "Status is pending");
    requestId2 = data._id;
  }


  // ──────────────────────────────────────────────────────────
  //  STEP 10: Full pipeline for Scarborough request
  // ──────────────────────────────────────────────────────────

  let bookingId2;
  {
    // Availability
    const avail = await request("GET", `/booking-requests/${requestId2}/availability`);
    assert(avail.status === 200, "Scarborough availability responds 200");
    assert(avail.data.availabilityCount > 0, `Found ${avail.data.availabilityCount} PSW(s) in Scarborough`);

    console.log("\n  Matched PSWs (Scarborough):");
    avail.data.topMatches.forEach((m, i) => {
      const name = `${m.psw.firstName} ${m.psw.lastName}`;
      const avStatus = m.availabilityStatus || "n/a";
      console.log(`    ${i + 1}. ${name} — score: ${(m.score ?? 0).toFixed(3)} [${avStatus}]`);
    });

    const pswId2 = avail.data.topMatches[0].psw._id;
    const pswName2 = `${avail.data.topMatches[0].psw.firstName} ${avail.data.topMatches[0].psw.lastName}`;

    // Contact
    const contact = await request("PATCH", `/booking-requests/${requestId2}/contact`, {
      email: "bob@example.com",
      phone: "+14165559876"
    });
    assert(contact.status === 200, "Scarborough contact saved");

    // Select PSW
    const sel = await request("PATCH", `/booking-requests/${requestId2}/select-psw`, { pswId: pswId2 });
    assert(sel.status === 200, `Selected PSW: ${pswName2}`);

    // Confirm
    const conf = await request("PATCH", `/booking-requests/${requestId2}/confirm`);
    assert(conf.status === 200, "Scarborough request confirmed");

    // Finalize
    const fin = await request("POST", `/booking-requests/${requestId2}/finalize`);
    print("STEP 10 — Finalize Scarborough booking", fin.data);
    assert(fin.status === 201, "Scarborough booking finalized (201)");
    assert(fin.data.summary.totalSlots > 0, `Created ${fin.data.summary.totalSlots} slots (2 days/wk × 8 wks)`);
    bookingId2 = fin.data.bookingId;
  }


  // ──────────────────────────────────────────────────────────
  //  STEP 11: Create recurring booking block (legacy flow)
  // ──────────────────────────────────────────────────────────

  let blockId;
  {
    const { status, data } = await request("POST", "/booking-blocks", {
      clientId: "client1",
      createdBy: "client",
      contact: {
        email: "alice@example.com",
        phone: "+14165551234"
      },
      pswWorker: selectedPSWId,
      postalCode: "M5H 2N2",
      coordinates: [-79.3832, 43.6532],
      startDate: "2026-04-27",
      daysOfWeek: [1, 3, 5],
      startTime: "09:00",
      durationHours: 3,
      weeks: 4
    });
    print("STEP 11 — Create recurring booking block", data);
    assert(status === 201, "Booking block created (201)");
    assert(data.totalSlots > 0, `Created ${data.totalSlots} of ${data.totalRequested} requested slots`);
    blockId = data.bookingBlock?._id;

    if (data.conflicts > 0) {
      console.log(`\n  ⚠ ${data.conflicts} slot(s) had conflicts — alternatives suggested:`);
      (data.alternativeSuggestions || []).forEach((s, i) => {
        const start = new Date(s.startTime).toLocaleDateString();
        const alts = s.availableAlternatives.map(a => a.name).join(", ") || "none available";
        console.log(`    ${i + 1}. ${start} — Alternatives: ${alts}`);
      });
    } else {
      console.log("\n  All slots assigned to primary PSW — no conflicts!");
    }
  }


  // ──────────────────────────────────────────────────────────
  //  STEP 12: Cancel a booking
  // ──────────────────────────────────────────────────────────

  {
    const { status, data } = await request("DELETE", `/bookings/${bookingId}`);
    print("STEP 12 — Cancel booking", data);
    assert(status === 200, "Booking cancelled (200)");
    assert(data.booking.status === "cancelled", "Status changed to cancelled");
  }


  // ──────────────────────────────────────────────────────────
  //  STEP 13: Verify cancelled booking can't be updated
  // ──────────────────────────────────────────────────────────

  {
    const { status, data } = await request("PUT", `/bookings/${bookingId}`, {
      status: "confirmed"
    });
    print("STEP 13 — Try updating cancelled booking", data);
    assert(status === 400, "Correctly rejected update to cancelled booking (400)");
  }


  // ──────────────────────────────────────────────────────────
  //  STEP 14: Fetch all bookings — verify everything
  // ──────────────────────────────────────────────────────────

  {
    const { status, data } = await request("GET", "/bookings");
    print("STEP 14 — All bookings", { count: data.length });
    assert(status === 200, "Bookings list responds 200");
    assert(data.length > 0, `Found ${data.length} booking(s) in system`);

    console.log("\n  Bookings in system:");
    data.forEach((b, i) => {
      const psw = b.pswWorker ? `${b.pswWorker.firstName} ${b.pswWorker.lastName}` : b.client;
      console.log(`    ${i + 1}. ${psw} — ${b.status} — ${b.recurring ? "recurring" : "one-time"}`);
    });
  }


  // ══════════════════════════════════════════════════════════
  //  DONE
  // ══════════════════════════════════════════════════════════

  console.log(`\n${"═".repeat(60)}`);
  console.log("  ALL STEPS PASSED — Full booking workflow complete!");
  console.log("═".repeat(60));
  console.log(`
  Pipeline tested (matches voice agent + API flow):
    1. Create booking request        → status: pending
    2. Check availability            → enhanced matching (schedule + capacity + conflicts)
    3. Save contact info             → email + phone
    4. Select PSW                    → from matched list
    5. Confirm                       → validates all fields, status: confirmed
    6. Finalize                      → creates Booking + BookingBlock + BookingSlots, status: booked
    7. Verify booking                → confirmed in DB
    8. Duplicate finalize blocked    → can't finalize twice
    9. Second request (Scarborough)  → full pipeline end-to-end
   10. Legacy booking block          → recurring slots with conflict detection
   11. Cancel booking                → status: cancelled
   12. Guard: reject update on cancelled

  Request IDs:  ${requestId1}, ${requestId2}
  Booking IDs:  ${bookingId}, ${bookingId2}
  Block ID:     ${blockId || "N/A"}
  `);
}

run().catch(err => {
  console.error("\n  ✗ WORKFLOW FAILED:", err.message);
  process.exit(1);
});
