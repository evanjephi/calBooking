/*
  ============================================================
  TEST — Retell Webhook → BookingRequest → PSW Matching
  ============================================================
  Run:  node test-webhook.js

  Prerequisites:
    - Server running on http://localhost:5000
    - MongoDB seeded with clients + PSW workers

  Tests both webhook formats:
    1) Structured (conversation flow) — data in call_analysis.custom_analysis_data
    2) Transcript fallback (single prompt) — data parsed from raw transcript
*/

const BASE = "http://localhost:5000";

async function request(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined
  });
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
  if (!condition) { console.error(`\n  ✗ FAILED: ${msg}`); process.exit(1); }
  console.log(`  ✓ ${msg}`);
}

async function run() {
  console.log("\n🔔  WEBHOOK TEST — Retell → BookingRequest pipeline\n");

  // ── TEST 1: Structured data (conversation flow agent) ──────
  {
    console.log("\n── TEST 1: Conversation Flow (structured analysis data) ──");

    const { status, data } = await request("POST", "/booking-calls/webhook", {
      event: "call_ended",
      call: {
        call_id: "test_structured_001",
        transcript: "Hello, I need care in Toronto. My postal code is M5H 2N2. 3 days a week. Daytime visits. 2 to 3 hours each. For 4 weeks. My email is alice@example.com and phone is 416-555-1234. Yes that's all correct. BOOKING_CONFIRMED",
        metadata: {
          client_id: "client1",
          client_name: "Alice Johnson"
        },
        call_analysis: {
          call_summary: "Client booked PSW care in Toronto",
          call_successful: true,
          custom_analysis_data: {
            city: "Toronto",
            postal_code: "M5H 2N2",
            days_per_week: "3",
            time_of_day: "daytime",
            visit_duration: "2-3 hours",
            length_of_care_weeks: "4",
            email: "alice@example.com",
            phone: "4165551234",
            booking_confirmed: "true"
          }
        }
      }
    });

    print("TEST 1 — Structured webhook response", data);
    assert(status === 200, `Status is 200 (got ${status})`);
    assert(data.status === "success", "Booking request created successfully");
    assert(data.bookingRequestId, `BookingRequest saved: ${data.bookingRequestId}`);
    assert(data.availabilityCount > 0, `Matched ${data.availabilityCount} PSW(s)`);

    if (data.topMatches) {
      console.log("\n  Matched PSWs:");
      data.topMatches.forEach((m, i) => {
        console.log(`    ${i + 1}. ${m.name} — score: ${(m.score ?? 0).toFixed(3)}`);
      });
    }
  }

  // ── TEST 2: Transcript fallback (single prompt agent) ──────
  {
    console.log("\n── TEST 2: Single Prompt (transcript parsing fallback) ──");

    const { status, data } = await request("POST", "/booking-calls/webhook", {
      call_id: "test_transcript_002",
      transcript: "Hi there. I need a PSW in Scarborough. My postal code is M1P 4P5. I need care 2 days a week. Evening visits. About 1 hour each time. For 8 weeks. My email is bob@test.com and call me at 647-555-9876. Yes everything is correct. BOOKING_CONFIRMED",
      metadata: {
        client_id: "client1",
        client_name: "Bob Smith"
      }
    });

    print("TEST 2 — Transcript fallback response", data);
    assert(status === 200, `Status is 200 (got ${status})`);
    assert(data.status === "success", "Booking request created via transcript parsing");
    assert(data.bookingRequestId, `BookingRequest saved: ${data.bookingRequestId}`);
    assert(data.availabilityCount > 0, `Matched ${data.availabilityCount} PSW(s)`);
  }

  // ── TEST 3: Not confirmed — should be rejected ────────────
  {
    console.log("\n── TEST 3: Booking NOT confirmed ──");

    const { status, data } = await request("POST", "/booking-calls/webhook", {
      event: "call_ended",
      call: {
        call_id: "test_not_confirmed_003",
        transcript: "I need care in Toronto but actually never mind.",
        metadata: { client_id: "client1" },
        call_analysis: {
          custom_analysis_data: {
            city: "Toronto",
            booking_confirmed: false
          }
        }
      }
    });

    print("TEST 3 — Not confirmed response", data);
    assert(status === 200, `Status is 200 (got ${status})`);
    assert(data.status === "not_confirmed", "Correctly rejected — booking not confirmed");
  }

  // ── TEST 4: Incomplete data — should report incomplete ─────
  {
    console.log("\n── TEST 4: Incomplete data ──");

    const { status, data } = await request("POST", "/booking-calls/webhook", {
      event: "call_ended",
      call: {
        call_id: "test_incomplete_004",
        transcript: "I need care in Toronto. BOOKING_CONFIRMED",
        metadata: { client_id: "client1" },
        call_analysis: {
          custom_analysis_data: {
            city: "Toronto",
            booking_confirmed: "true"
            // missing: postal_code, days_per_week, etc.
          }
        }
      }
    });

    print("TEST 4 — Incomplete data response", data);
    assert(status === 200, `Status is 200 (got ${status})`);
    assert(data.status === "incomplete", "Correctly flagged as incomplete");
  }

  // ── TEST 5: Ignored event ──────────────────────────────────
  {
    console.log("\n── TEST 5: Non-call_ended event ──");

    const { status, data } = await request("POST", "/booking-calls/webhook", {
      event: "call_started",
      call: { call_id: "test_ignore_005" }
    });

    print("TEST 5 — Ignored event response", data);
    assert(status === 200, `Status is 200 (got ${status})`);
    assert(data.status === "ignored", "Correctly ignored non-call_ended event");
  }

  // ── DONE ───────────────────────────────────────────────────
  console.log(`\n${"═".repeat(60)}`);
  console.log("  ALL 5 WEBHOOK TESTS PASSED");
  console.log("═".repeat(60));
  console.log(`
  Summary:
    • TEST 1: Structured data (conversation flow) → saved + matched ✓
    • TEST 2: Transcript fallback (single prompt) → saved + matched ✓
    • TEST 3: Not confirmed → correctly rejected ✓
    • TEST 4: Incomplete data → correctly flagged ✓
    • TEST 5: Wrong event type → correctly ignored ✓
  `);
}

run().catch(err => {
  console.error("\n  ✗ TEST FAILED:", err.message);
  process.exit(1);
});
