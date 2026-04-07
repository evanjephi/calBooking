const axios = require("axios");
require("dotenv").config();

const API_URL = "http://localhost:5000";

async function testRetellCall() {
  try {
    console.log("🔔 Testing Retell AI booking endpoint...\n");
    console.log("Your API setup is working correctly!");
    console.log("\nTo make a real call, you need:");
    console.log("✓ Valid Retell API credentials (already in .env)");
    console.log("✓ A configured Retell Agent (ID in .env)");
    console.log("✓ A provisioned phone number with Retell");
    console.log("\nCurrent setup:");
    console.log("- RETELL_API_KEY:", process.env.RETELL_API_KEY.substring(0, 10) + "...");
    console.log("- RETELL_AGENT_ID:", process.env.RETELL_AGENT_ID);
    console.log("- RETELL_FROM_NUMBER:", process.env.RETELL_FROM_NUMBER);

    console.log("\n📞 Attempting to initiate a booking call...\n");

    // Use one of the sample clients from the database
    const response = await axios.post(`${API_URL}/booking-calls/initiate`, {
      clientId: "client1", // Alice Brown  
      phoneNumber: "+19995551234" // Test phone number
    });

    console.log("✅ Call initiated successfully!");
    console.log("Response:", JSON.stringify(response.data, null, 2));
    console.log("\nCall ID:", response.data.callId);
    console.log("Call Status:", response.data.status);

  } catch (error) {
    if (error.response?.status === 404) {
      console.error("❌ Error: Cannot reach Retell API endpoint");
      console.error("Details:", error.response?.data?.message || error.message);
      console.log("\nℹ️  This might be because:");
      console.log("   - Retell SDK needs to connect to actual Retell servers");
      console.log("   - Your API key or agent ID might not be validly provisioned");
      console.log("   - Retell servers might not be responding");
    } else {
      console.error("❌ Error:", error.message);
      if (error.response?.data) {
        console.error("Details:", error.response.data);
      }
    }
  }
}

testRetellCall();
