require('dotenv').config();
const axios = require('axios');

const AGENT_ID = process.env.RETELL_AGENT_ID;
const API_KEY  = process.env.RETELL_API_KEY;
const API_BASE = 'https://api.retellai.com';
const FLOW_ID  = process.env.FLOW_ID;
const WEBHOOK_BASE_URL = process.env.WEBHOOK_BASE_URL;

// ──────────────────────────────────────────────────────────────
//  CONVERSATION FLOW  —  PSW Booking (with mid-call PSW lookup)
// ──────────────────────────────────────────────────────────────
//
//  Each node has:
//    • A focused prompt that collects ONE piece of data
//    • A variable to extract
//    • A transition to the next node once the data is valid
//
//  Flow:  greeting → city → postal_code → psw_lookup →
//         days_per_week → time_of_day → visit_duration →
//         length_of_care → contact_info → confirmation → end
// ──────────────────────────────────────────────────────────────

// Retell conversation flow nodes — uses exact Retell node schema:
//   { id, name, type, start_speaker, instruction: { type, text }, edges: [{ id, condition, destination_node_id, transition_condition }] }

const CONVERSATION_FLOW_NODES = [
  {
    id: "node_identify_caller",
    name: "Identify Caller",
    type: "conversation",
    start_speaker: "agent",
    tools: [
      {
        type: "custom",
        name: "identify_caller",
        description: "Identify a returning caller by their phone number. Returns their name, account details, and active bookings if found.",
        url: `${WEBHOOK_BASE_URL}/booking-calls/identify`,
        speak_during_execution: true,
        speak_after_execution: true,
        execution_message_description: "One moment while I look up your account",
        parameters: {
          type: "object",
          properties: {
            phone_number: { type: "string", description: "The caller's phone number" }
          },
          required: ["phone_number"]
        }
      }
    ],
    instruction: {
      type: "prompt",
      text: `You are Anna, a PSW booking specialist from Premier PSW Healthcare.
Call the identify_caller tool immediately using the caller's phone number from the call metadata.

If the tool returns identified=true:
- Greet them by name using the response.
- The tool will tell you about their active bookings.
- Ask: "Would you like to make a new booking, or is there something else I can help you with regarding your current care?"

If the tool returns identified=false:
- Say: "Welcome to Premier PSW Healthcare! I'm Anna, and I'll help you book a Personal Support Worker today."
- Then ask: "Which city do you need PSW services in?"
- Valid cities: Toronto, Scarborough, Markham, North York, Etobicoke, Mississauga.`
    },
    edges: [
      {
        id: "edge_id_new_booking",
        condition: "Caller is identified and wants a new booking, or caller is not identified and provides a city",
        destination_node_id: "node_postal_code",
        transition_condition: { type: "prompt", prompt: "Caller wants a new booking or provides a valid city name" }
      },
      {
        id: "edge_id_not_found_city",
        condition: "Caller is not identified and provides a valid city",
        destination_node_id: "node_postal_code",
        transition_condition: { type: "prompt", prompt: "Caller is new and provides a valid city (Toronto, Scarborough, Markham, North York, Etobicoke, or Mississauga)" }
      }
    ]
  },
  {
    id: "start-node-1735866339701",
    name: "Greeting & City",
    type: "conversation",
    start_speaker: "agent",
    instruction: {
      type: "prompt",
      text: `You are Anna, a PSW (Personal Support Worker) booking specialist from Premier PSW Healthcare.
Greet the caller warmly. Tell them you'll help them book a Personal Support Worker.
Then ask: "Which city do you need PSW services in?"
Valid cities: Toronto, Scarborough, Markham, North York, Etobicoke, Mississauga.
If the caller says a city not on the list, politely let them know the available cities and ask again.
Save the city they give you.`
    },
    edges: [
      {
        id: "edge_greeting_1",
        condition: "Client provides a valid city",
        destination_node_id: "node_postal_code",
        transition_condition: { type: "prompt", prompt: "Client provides a valid city (Toronto, Scarborough, Markham, North York, Etobicoke, or Mississauga)" }
      }
    ]
  },
  {
    id: "node_postal_code",
    name: "Postal Code",
    type: "conversation",
    start_speaker: "agent",
    instruction: {
      type: "prompt",
      text: `Ask for their postal code so we can find nearby caregivers.
Say: "What is your postal code?"
A valid Canadian postal code looks like M5H 2N2 (letter-number-letter space number-letter-number).
If the format seems wrong, ask them to repeat it.`
    },
    edges: [
      {
        id: "edge_postal_1",
        condition: "Client provides a valid Canadian postal code",
        destination_node_id: "node_street_address",
        transition_condition: { type: "prompt", prompt: "Client provides what sounds like a Canadian postal code" }
      }
    ]
  },
  {
    id: "node_street_address",
    name: "Street Address",
    type: "conversation",
    start_speaker: "agent",
    instruction: {
      type: "prompt",
      text: `Ask for the street address where the caregiver should go.
Say: "What is the street address where care will be provided? For example, 123 Main Street, Unit 4B."
Collect the street address and apartment or unit number if applicable.
If they only give a street number and name that's fine — the unit is optional.
Repeat the address back to confirm you got it right.`
    },
    edges: [
      {
        id: "edge_street_1",
        condition: "Client provides a street address",
        destination_node_id: "node_service_level",
        transition_condition: { type: "prompt", prompt: "Client provides a street address (number and street name at minimum)" }
      }
    ]
  },
  {
    id: "node_service_level",
    name: "Service Level",
    type: "conversation",
    start_speaker: "agent",
    instruction: {
      type: "prompt",
      text: `Ask what level of care they need.
Say: "We offer three levels of care:
1. Home Helper — light housekeeping, meal prep, and companionship, at $24.25 per hour.
2. Care Services — personal hygiene assistance, mobility support, and medication reminders, at $26.19 per hour.
3. Specialized Care — complex care needs including palliative, dementia, or post-surgical support, at $27.84 per hour.
Which level best fits your needs?"
Only accept one of these three: Home Helper, Care Services, or Specialized Care.
If unclear, briefly describe each option again.`
    },
    edges: [
      {
        id: "edge_service_level_1",
        condition: "Client selects a service level",
        destination_node_id: "node_psw_lookup",
        transition_condition: { type: "prompt", prompt: "Client picks one of: Home Helper, Care Services, or Specialized Care" }
      }
    ]
  },
  {
    id: "node_psw_lookup",
    name: "PSW Lookup & Selection",
    type: "conversation",
    start_speaker: "agent",
    tools: [
      {
        type: "custom",
        name: "lookup_psws",
        description: "Look up available PSW caregivers near the client's postal code. Returns a speech-friendly list of nearby caregivers with name, experience, rating, and specialties.",
        url: `${WEBHOOK_BASE_URL}/booking-calls/lookup-psws`,
        speak_during_execution: true,
        speak_after_execution: true,
        execution_message_description: "Let me look up available caregivers near your area",
        parameters: {
          type: "object",
          properties: {
            postal_code: { type: "string", description: "The client's Canadian postal code (e.g. M5H 2N2)" },
            city: { type: "string", description: "The client's city" }
          },
          required: ["postal_code"]
        }
      }
    ],
    instruction: {
      type: "prompt",
      text: `Call the lookup_psws tool right away with the postal_code and city the client just provided.

Once you receive the results:
- If caregivers were found, read the list to the client. For each caregiver mention their name, years of experience, rating out of 5, and specialties.
- Then ask: "Which caregiver would you prefer?"
- Remember the full name of the caregiver the client selects.

If no caregivers were found, tell the client: "Our team will personally match you with a great caregiver based on your needs. Let's continue with the rest of your booking details."

If the client has no preference, that's fine — just continue to the next step.`
    },
    edges: [
      {
        id: "edge_psw_selected",
        condition: "Client selects a caregiver, has no preference, or no caregivers were found",
        destination_node_id: "node_days_per_week",
        transition_condition: { type: "prompt", prompt: "Client has chosen a caregiver by name, says they have no preference, or no caregivers were available" }
      }
    ]
  },
  {
    id: "node_days_per_week",
    name: "Days Per Week",
    type: "conversation",
    start_speaker: "agent",
    instruction: {
      type: "prompt",
      text: `Ask how many days per week they need a PSW.
Say: "How many days per week do you need care?"
Valid: any whole number from 1 to 7.
If they give an unclear answer, ask them to pick a number between 1 and 7.`
    },
    edges: [
      {
        id: "edge_days_1",
        condition: "Client provides a number between 1 and 7",
        destination_node_id: "node_time_of_day",
        transition_condition: { type: "prompt", prompt: "Client provides a number of days between 1 and 7" }
      }
    ]
  },
  {
    id: "node_time_of_day",
    name: "Time of Day",
    type: "conversation",
    start_speaker: "agent",
    instruction: {
      type: "prompt",
      text: `Ask what time of day works best for their visits.
Say: "Do you prefer daytime, evening, overnight, or weekend visits?"
Only accept one of these four options: daytime, evening, overnight, weekend.
If they say something else, list the four options and ask again.`
    },
    edges: [
      {
        id: "edge_time_1",
        condition: "Client chooses daytime, evening, overnight, or weekend",
        destination_node_id: "node_visit_duration",
        transition_condition: { type: "prompt", prompt: "Client picks one of: daytime, evening, overnight, or weekend" }
      }
    ]
  },
  {
    id: "node_visit_duration",
    name: "Visit Duration",
    type: "conversation",
    start_speaker: "agent",
    instruction: {
      type: "prompt",
      text: `Ask how long each visit should be.
Say: "How long should each visit be? Your options are: 1 hour, 2 to 3 hours, 4 to 6 hours, or more than 6 hours."
Only accept one of these four options.`
    },
    edges: [
      {
        id: "edge_duration_1",
        condition: "Client picks a valid duration option",
        destination_node_id: "node_length_of_care",
        transition_condition: { type: "prompt", prompt: "Client picks one of: 1 hour, 2-3 hours, 4-6 hours, or more than 6 hours" }
      }
    ]
  },
  {
    id: "node_length_of_care",
    name: "Length of Care",
    type: "conversation",
    start_speaker: "agent",
    instruction: {
      type: "prompt",
      text: `Ask how many weeks they need care for.
Say: "How many weeks do you need this care for? It can be anywhere from 1 to 52 weeks."
Accept any whole number from 1 to 52.`
    },
    edges: [
      {
        id: "edge_weeks_1",
        condition: "Client provides a number of weeks",
        destination_node_id: "node_contact_info",
        transition_condition: { type: "prompt", prompt: "Client provides a number of weeks between 1 and 52" }
      }
    ]
  },
  {
    id: "node_contact_info",
    name: "Contact Info",
    type: "conversation",
    start_speaker: "agent",
    instruction: {
      type: "prompt",
      text: `Ask for their contact information so they can be reached for follow-up.
Say: "Almost done! Can I get your email address and a phone number to reach you?"
Collect both an email address and a phone number. If they only give one, ask for the other.`
    },
    edges: [
      {
        id: "edge_contact_1",
        condition: "Client provides both email and phone",
        destination_node_id: "node_confirmation",
        transition_condition: { type: "prompt", prompt: "Client has provided both an email address and a phone number" }
      }
    ]
  },
  {
    id: "node_confirmation",
    name: "Confirm & Summary",
    type: "conversation",
    start_speaker: "agent",
    instruction: {
      type: "prompt",
      text: `Read back ALL the details collected from the conversation and ask the client to confirm.
Summarize: city, postal code, street address, service level (and its hourly rate), selected caregiver (if one was chosen), days per week, time of day, visit duration, length of care in weeks, email, and phone.
Say: "Does everything look correct?"

If they confirm, say: "Perfect, I'm checking caregiver availability now. We'll follow up with your matched caregivers shortly. Thank you! BOOKING_CONFIRMED"

If they want to change something, ask which detail they'd like to change.`
    },
    edges: [
      {
        id: "edge_confirm_yes",
        condition: "Client confirms all details are correct",
        destination_node_id: "node_end",
        transition_condition: { type: "prompt", prompt: "Client confirms everything is correct" }
      },
      {
        id: "edge_confirm_change_city",
        condition: "Client wants to change city",
        destination_node_id: "start-node-1735866339701",
        transition_condition: { type: "prompt", prompt: "Client wants to change the city" }
      },
      {
        id: "edge_confirm_change_postal",
        condition: "Client wants to change postal code",
        destination_node_id: "node_postal_code",
        transition_condition: { type: "prompt", prompt: "Client wants to change the postal code" }
      },
      {
        id: "edge_confirm_change_days",
        condition: "Client wants to change days per week",
        destination_node_id: "node_days_per_week",
        transition_condition: { type: "prompt", prompt: "Client wants to change the number of days" }
      },
      {
        id: "edge_confirm_change_time",
        condition: "Client wants to change time of day",
        destination_node_id: "node_time_of_day",
        transition_condition: { type: "prompt", prompt: "Client wants to change the time of day" }
      },
      {
        id: "edge_confirm_change_duration",
        condition: "Client wants to change visit duration",
        destination_node_id: "node_visit_duration",
        transition_condition: { type: "prompt", prompt: "Client wants to change the visit duration" }
      },
      {
        id: "edge_confirm_change_weeks",
        condition: "Client wants to change length of care",
        destination_node_id: "node_length_of_care",
        transition_condition: { type: "prompt", prompt: "Client wants to change length of care" }
      },
      {
        id: "edge_confirm_change_contact",
        condition: "Client wants to change contact info",
        destination_node_id: "node_contact_info",
        transition_condition: { type: "prompt", prompt: "Client wants to change email or phone" }
      },
      {
        id: "edge_confirm_change_psw",
        condition: "Client wants to change their selected caregiver",
        destination_node_id: "node_psw_lookup",
        transition_condition: { type: "prompt", prompt: "Client wants to change the caregiver they selected" }
      },
      {
        id: "edge_confirm_change_address",
        condition: "Client wants to change street address",
        destination_node_id: "node_street_address",
        transition_condition: { type: "prompt", prompt: "Client wants to change the street address" }
      },
      {
        id: "edge_confirm_change_service_level",
        condition: "Client wants to change service level",
        destination_node_id: "node_service_level",
        transition_condition: { type: "prompt", prompt: "Client wants to change the service level" }
      }
    ]
  },
  {
    id: "node_end",
    name: "End Call",
    type: "end",
    instruction: {
      type: "prompt",
      text: "The booking has been confirmed. Thank the client and end the call politely."
    },
    edges: []
  }
];

// ──────────────────────────────────────────────────────────────
//  Post-call analysis — tells Retell what variables to extract
//  from the completed call. These appear in the webhook as
//  call.call_analysis.custom_analysis_data
// ──────────────────────────────────────────────────────────────

const POST_CALL_ANALYSIS = [
  { name: "caller_name",          type: "string",  description: "The caller's full name (first and last)" },
  { name: "city",                 type: "string",  description: "City where PSW care is needed" },
  { name: "postal_code",          type: "string",  description: "Client's Canadian postal code (e.g. M5H 2N2)" },
  { name: "street_address",       type: "string",  description: "Street address where care will be provided (e.g. 123 Main Street, Unit 4B)" },
  { name: "days_per_week",        type: "number",  description: "Number of days per week of care (1-7)" },
  { name: "time_of_day",          type: "string",  description: "Preferred time: daytime, evening, overnight, or weekend" },
  { name: "visit_duration",       type: "string",  description: "Duration per visit: 1 hour, 2-3 hours, 4-6 hours, or more than 6 hours" },
  { name: "length_of_care_weeks", type: "number",  description: "How many weeks of care needed (1-52)" },
  { name: "email",                type: "string",  description: "Client email address" },
  { name: "phone",                type: "string",  description: "Client phone number" },
  { name: "booking_confirmed",    type: "boolean", description: "Whether the client confirmed all booking details (true/false)" },
  { name: "chosen_psw_name",     type: "string",  description: "Full name of the PSW caregiver the client selected during the call (if any)" },
  { name: "service_level",       type: "string",  description: "Service level chosen: home_helper, care_services, or specialized_care" }
];

// ──────────────────────────────────────────────────────────────
//  Single-prompt fallback — used if you keep a single-prompt
//  agent instead of switching to conversation flow
// ──────────────────────────────────────────────────────────────

const SINGLE_PROMPT = `You are an AI assistant named Anna, a PSW (Personal Support Worker) booking specialist.

Current time is {{current_time}}.
You are speaking with {{customer_name}}.

Your goal is to collect all the information needed to book PSW care. Follow these 8 steps strictly in order, one at a time. Be warm, professional, and conversational.

STEP 1 — CITY: Ask which city they need care in. Valid: Toronto, Scarborough, Markham, North York, Etobicoke, Mississauga.
STEP 2 — POSTAL CODE: Ask for their Canadian postal code (format: A1A 1A1).
STEP 3 — DAYS PER WEEK: Ask how many days per week (1-7).
STEP 4 — TIME OF DAY: Ask preference — daytime, evening, overnight, or weekend.
STEP 5 — VISIT DURATION: Ask duration — 1 hour, 2-3 hours, 4-6 hours, or more than 6 hours.
STEP 6 — LENGTH OF CARE: Ask how many weeks (1-52).
STEP 7 — CONTACT INFO: Collect email and phone number.
STEP 8 — CONFIRM: Read back ALL details. If confirmed, say "BOOKING_CONFIRMED". If they want changes, go back to that step.

RULES:
- Collect ONE piece of information at a time. Never skip steps.
- If answers are unclear, ask for clarification.
- Use {{customer_name}}'s first name throughout.
- Never make up or assume information.`;

// ══════════════════════════════════════════════════════════════
//  MAIN — push configuration to Retell
// ══════════════════════════════════════════════════════════════

async function main() {
  console.log("Retell Agent Configuration Script");
  console.log("==================================\n");
  console.log(`Agent ID: ${AGENT_ID}`);

  const action = process.argv[2] || "update-agent";

  switch (action) {
    case "update-agent":
      await updateAgent();
      break;
    case "update-flow":
      await updateConversationFlow();
      break;
    case "full-setup":
      await updateAgent();
      await updateConversationFlow();
      break;
    default:
      console.log("\nUsage:");
      console.log("  node agent_script.js update-agent   — Push post_call_analysis_data to agent");
      console.log("  node agent_script.js update-flow    — Update conversation flow with booking nodes");
      console.log("  node agent_script.js full-setup     — Both of the above");
  }
}

// Push post_call_analysis_data to the agent (PATCH /update-agent/{id})
async function updateAgent() {
  console.log("\n→ Updating agent with post-call analysis config...");

  try {
    const response = await axios.patch(
      `${API_BASE}/update-agent/${AGENT_ID}`,
      {
        agent_name: "Anna — PSW Booking Agent",
        post_call_analysis_data: POST_CALL_ANALYSIS,
        webhook_url: `${WEBHOOK_BASE_URL}/booking-calls/webhook`
      },
      {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("  Agent updated successfully");
    console.log(`  Post-call analysis configured for ${POST_CALL_ANALYSIS.length} variables`);
    console.log("  Variables: " + POST_CALL_ANALYSIS.map(v => v.name).join(", "));

    if (response.data?.post_call_analysis_data) {
      console.log(`  Retell confirmed ${response.data.post_call_analysis_data.length} analysis vars set`);
    }
  } catch (error) {
    console.error("  Failed:", error.response?.data || error.message);
  }
}

// Update the existing conversation flow with our booking nodes
async function updateConversationFlow() {
  console.log(`\n→ Updating conversation flow ${FLOW_ID} with booking nodes...`);

  try {
    const response = await axios.patch(
      `${API_BASE}/update-conversation-flow/${FLOW_ID}`,
      {
        nodes: CONVERSATION_FLOW_NODES,
        starting_node_id: "node_identify_caller"
      },
      {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    console.log(`  Conversation flow updated: ${FLOW_ID}`);
    console.log(`  Nodes: ${CONVERSATION_FLOW_NODES.length}`);
    console.log(`  Flow: ${CONVERSATION_FLOW_NODES.map(n => n.name).join(" → ")}`);

    if (response.data?.nodes) {
      console.log(`  Retell confirmed ${response.data.nodes.length} nodes set`);
    }
  } catch (error) {
    console.error("  Failed:", error.response?.data || error.message);

    // Print node summary for manual setup
    console.log("\n  If API update fails, set up the flow manually in the Retell dashboard.");
    console.log("  Flow ID: " + FLOW_ID);
    console.log("\n  Node Setup Guide:");
    console.log("  ==================");
    CONVERSATION_FLOW_NODES.forEach((node, i) => {
      const edgeCount = (node.edges || []).length;
      console.log(`  ${i + 1}. [${node.name}] (${node.type}) — ${edgeCount} transition(s)`);
      if (node.instruction?.text) {
        console.log(`     Prompt: ${node.instruction.text.split("\n")[0]}...`);
      }
    });
  }
}

main().catch(err => {
  console.error("Script failed:", err.message);
  process.exit(1);
});