const axios = require("axios");
require("dotenv").config();

const API_KEY = process.env.RETELL_API_KEY;
const AGENT_ID = process.env.RETELL_AGENT_ID;
const FROM_NUMBER = process.env.RETELL_FROM_NUMBER;

async function testRetellAPI() {
  console.log("Testing Retell REST API directly...\n");

  // Test 1: List Agents (known working endpoint)
  console.log("1️⃣  Testing GET /list-agents");
  try {
    const response = await axios.get("https://api.retellai.com/list-agents", {
      headers: { 
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
      }
    });
    console.log("   ✅ Success!");
    console.log("   Agents found:", response.data.agents?.length || 0);
    if (response.data.agents && response.data.agents.length > 0) {
      response.data.agents.forEach((agent, idx) => {
        console.log(`   ${idx + 1}. ${agent.agent_name} (ID: ${agent.agent_id})`);
      });
    }
  } catch (err) {
    console.log("   ❌ Error:", err.response?.status, err.message);
    if (err.response?.data) console.log("   ", err.response.data);
  }

  // Test 2: Try registerCall with different endpoint names
  console.log("\n2️⃣  Testing POST /register-call");
  try {
    const response = await axios.post(
      "https://api.retellai.com/register-call",
      {
        agent_id: AGENT_ID,
        audio_websocket_protocol: "web",
        audio_encoding: "s16le",
        sample_rate: 22050,
        from_number: FROM_NUMBER,
        to_number: "+16477135523"
      },
      { 
        headers: { 
          "Authorization": `Bearer ${API_KEY}`,
          "Content-Type": "application/json"
        } 
      }
    );
    console.log("   ✅ Success!");
    console.log("   Response:", JSON.stringify(response.data, null, 2));
  } catch (err) {
    console.log("   ❌ Error:", err.response?.status);
    if (err.response?.data) {
      console.log("   Details:", err.response.data);
    }
  }

  // Test 3: Try alternative endpoint name
  console.log("\n3️⃣  Testing POST /call (alternative name)");
  try {
    const response = await axios.post(
      "https://api.retellai.com/call",
      {
        agent_id: AGENT_ID,
        audio_websocket_protocol: "web",
        audio_encoding: "s16le",
        sample_rate: 22050,
        from_number: FROM_NUMBER,
        to_number: "+16477135523"
      },
      { 
        headers: { 
          "Authorization": `Bearer ${API_KEY}`,
          "Content-Type": "application/json"
        } 
      }
    );
    console.log("   ✅ Success!");
    console.log("   Response:", JSON.stringify(response.data, null, 2));
  } catch (err) {
    console.log("   ❌ Error:", err.response?.status);
  }

  // Test 4: Check v2 API
  console.log("\n4️⃣  Testing POST /v2/register-call");
  try {
    const response = await axios.post(
      "https://api.retellai.com/v2/register-call",
      {
        agent_id: AGENT_ID,
        audio_websocket_protocol: "web",
        audio_encoding: "s16le",
        sample_rate: 22050,
        from_number: FROM_NUMBER,
        to_number: "+16477135523"
      },
      { 
        headers: { 
          "Authorization": `Bearer ${API_KEY}`,
          "Content-Type": "application/json"
        } 
      }
    );
    console.log("   Success!");
    console.log("   Response:", JSON.stringify(response.data, null, 2));
  } catch (err) {
    console.log("   Error:", err.response?.status);
  }

  // Test 5: Try create-call endpoint
  console.log("\n Testing POST /create-call");
  try {
    const response = await axios.post(
      "https://api.retellai.com/create-call",
      {
        agent_id: AGENT_ID,
        audio_websocket_protocol: "web",
        audio_encoding: "s16le",
        sample_rate: 22050,
        from_number: FROM_NUMBER,
        to_number: "+16477135523"
      },
      { 
        headers: { 
          "Authorization": `Bearer ${API_KEY}`,
          "Content-Type": "application/json"
        } 
      }
    );
    console.log("   Success!");
    console.log("   Response:", JSON.stringify(response.data, null, 2));
  } catch (err) {
    console.log("   Error:", err.response?.status);
  }

  // Test 6: Try POST /initiate-call
  console.log("\n  Testing POST /initiate-call");
  try {
    const response = await axios.post(
      "https://api.retellai.com/initiate-call",
      {
        agent_id: AGENT_ID,
        audio_websocket_protocol: "web",
        audio_encoding: "s16le",
        sample_rate: 22050,
        from_number: FROM_NUMBER,
        to_number: "+16477135523"
      },
      { 
        headers: { 
          "Authorization": `Bearer ${API_KEY}`,
          "Content-Type": "application/json"
        } 
      }
    );
    console.log("   ✅ Success!");
    console.log("   Response:", JSON.stringify(response.data, null, 2));
  } catch (err) {
    console.log("   ❌ Error:", err.response?.status);
  }

  console.log("\n" + "=".repeat(60));
  console.log("Test completed. Check results above for working endpoint.");
}

testRetellAPI().catch(err => {
  console.error("Fatal error:", err.message);
});
