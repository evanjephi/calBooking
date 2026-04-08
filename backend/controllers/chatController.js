const OpenAI = require("openai");
const ChatSession = require("../models/ChatSession");
const User = require("../models/User");
const { TOOL_DEFINITIONS, executeToolCall } = require("../services/chatTools");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY_MYCALY });

const SYSTEM_PROMPT = `You are Anna, a friendly and helpful booking assistant for PremierPSW Healthcare.
You help clients book Personal Support Workers (PSWs) — caregivers who provide in-home care.

IMPORTANT COMMUNICATION STYLE:
- Use simple, clear language. Many of our clients are elderly.
- Keep sentences short and easy to understand.
- Be warm, patient, and reassuring.
- Use plain words — avoid medical jargon or technical terms.
- When listing options, use numbered lists so they are easy to read.
- Always confirm important details before proceeding.
- If the user seems confused, gently re-explain in simpler terms.

ABOUT PREMIERPSW:
- We connect families and healthcare institutions with qualified Personal Support Workers.
- We serve communities across Ontario, Canada.
- All our PSWs are vetted and qualified.

SERVICE LEVELS (explain in plain language when asked):
1. Home Helper ($24.25/hr) — Light housekeeping, meal prep, companionship, errands, laundry.
2. Care Services ($26.19/hr) — Personal hygiene help, mobility assistance, medication reminders, vital signs monitoring.
3. Specialized Care ($27.84/hr) — Dementia care, palliative support, post-surgery recovery, complex care needs.

Note: Prices include a small platform fee. HST (13%) is added at checkout. A 4% card processing fee also applies.

BOOKING TYPES:
- Recurring: Regular visits over multiple weeks (e.g. 3 days a week for 4 weeks).
- One-Time: A single visit on a specific date.

VISIT DURATION OPTIONS: 1 hour, 2-3 hours, 4-6 hours, more than 6 hours.
TIME OF DAY OPTIONS: Daytime (8am-4pm), Evening (4pm-11pm), Overnight (10pm-7am), Weekend (8am-5pm).

BOOKING WORKFLOW — follow these steps in order:
1. Greet the user and ask what they need help with.
2. Find out their service level (or help them choose based on their needs).
3. Ask for booking type (recurring or one-time).
4. Collect location: city and postal code (street address is optional but helpful).
5. Collect schedule: time of day, visit duration. For recurring: days per week, preferred days, how many weeks. For one-time: specific date.
6. Create the booking request using the create_booking_request tool.
7. Check availability using check_availability.
8. Present the available PSWs to the user (name, distance, rating, experience).
9. Ask the user which PSW they prefer (or recommend the top match).
10. Finalize with select_psw_and_finalize.
11. Confirm success and provide a summary.

RULES:
- Always collect ALL required information before calling create_booking_request.
- Never skip the confirmation step — always summarize the details and ask "Does this look right?" before creating the request.
- If no PSWs are available, apologize and suggest adjusting the schedule or location.
- You can also help users view their bookings (get_my_bookings) or cancel bookings (cancel_booking).
- If the user asks general questions (about services, qualifications, pricing, how it works), answer from your knowledge above.
- If the user asks something outside your scope, politely say you can help with bookings and service information.
- Do NOT fabricate information about specific PSWs — only share what the system returns.
- When presenting PSW options, include their name, distance, rating, and experience in a clear list.

CURRENT USER INFO (use this so you don't have to re-ask):
{{USER_INFO}}

Today's date: {{TODAY}}`;

// Rate limit: max 20 messages per session per 5 minutes
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const RATE_LIMIT_MAX = 20;

function checkRateLimit(session) {
  const now = Date.now();
  const recentMessages = session.messages.filter(
    (m) => m.role === "user" && m._id && new Date(m._id.getTimestamp?.() || now) > now - RATE_LIMIT_WINDOW_MS
  );
  // Simpler: count user messages in the last window based on array position
  const userMsgCount = session.messages.filter((m) => m.role === "user").length;
  if (userMsgCount > 100) {
    return false; // session too long, start a new one
  }
  return true;
}

exports.sendMessage = async (req, res) => {
  try {
    const { message, sessionId } = req.body;
    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return res.status(400).json({ message: "Message is required." });
    }
    if (message.length > 2000) {
      return res.status(400).json({ message: "Message is too long. Please keep it under 2000 characters." });
    }

    const userId = req.user.id;
    const user = await User.findById(userId).select("firstName lastName email phone address role").lean();

    // Find or create session
    let session;
    if (sessionId) {
      session = await ChatSession.findOne({ _id: sessionId, userId });
    }
    if (!session) {
      session = new ChatSession({ userId, messages: [] });
    }

    if (!checkRateLimit(session)) {
      return res.status(429).json({ message: "You've sent too many messages. Please start a new conversation." });
    }

    // Build user info string for system prompt
    const userInfo = user
      ? `Name: ${user.firstName} ${user.lastName}, Email: ${user.email}, Phone: ${user.phone || "not provided"}, ` +
        `Address: ${user.address?.street || ""} ${user.address?.unit || ""} ${user.address?.city || ""} ${user.address?.postalCode || ""}`
          .replace(/\s+/g, " ").trim()
      : "Not available";

    const today = new Date().toLocaleDateString("en-CA", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });

    const systemPrompt = SYSTEM_PROMPT
      .replace("{{USER_INFO}}", userInfo)
      .replace("{{TODAY}}", today);

    // Add user message
    session.messages.push({ role: "user", content: message.trim() });

    // Build messages for OpenAI (prepend system prompt)
    const openaiMessages = [
      { role: "system", content: systemPrompt },
      ...session.messages.map((m) => {
        const msg = { role: m.role, content: m.content || "" };
        if (m.tool_calls) msg.tool_calls = m.tool_calls;
        if (m.tool_call_id) msg.tool_call_id = m.tool_call_id;
        if (m.name) msg.name = m.name;
        return msg;
      }),
    ];

    // Call OpenAI with tool definitions
    let response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: openaiMessages,
      tools: TOOL_DEFINITIONS,
      tool_choice: "auto",
      temperature: 0.7,
      max_tokens: 800,
    });

    let assistantMessage = response.choices[0].message;
    let loopCount = 0;
    const MAX_TOOL_LOOPS = 5;

    // Handle tool calls in a loop
    while (assistantMessage.tool_calls && loopCount < MAX_TOOL_LOOPS) {
      loopCount++;

      // Save assistant message with tool_calls
      session.messages.push({
        role: "assistant",
        content: assistantMessage.content || "",
        tool_calls: assistantMessage.tool_calls,
      });

      // Execute each tool call
      for (const toolCall of assistantMessage.tool_calls) {
        const fnName = toolCall.function.name;
        let fnArgs;
        try {
          fnArgs = JSON.parse(toolCall.function.arguments);
        } catch {
          fnArgs = {};
        }

        const toolResult = await executeToolCall(fnName, fnArgs, userId);

        // Update session step based on tool
        if (fnName === "create_booking_request" && toolResult.success) {
          session.bookingRequestId = toolResult.bookingRequestId;
          session.currentStep = "checking_availability";
        } else if (fnName === "check_availability") {
          session.currentStep = "selecting_psw";
        } else if (fnName === "select_psw_and_finalize" && toolResult.success) {
          session.currentStep = "complete";
        }

        session.messages.push({
          role: "tool",
          content: JSON.stringify(toolResult),
          tool_call_id: toolCall.id,
          name: fnName,
        });
      }

      // Call OpenAI again with tool results
      const updatedMessages = [
        { role: "system", content: systemPrompt },
        ...session.messages.map((m) => {
          const msg = { role: m.role, content: m.content || "" };
          if (m.tool_calls) msg.tool_calls = m.tool_calls;
          if (m.tool_call_id) msg.tool_call_id = m.tool_call_id;
          if (m.name) msg.name = m.name;
          return msg;
        }),
      ];

      response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: updatedMessages,
        tools: TOOL_DEFINITIONS,
        tool_choice: "auto",
        temperature: 0.7,
        max_tokens: 800,
      });

      assistantMessage = response.choices[0].message;
    }

    // Save final assistant response
    const replyText = assistantMessage.content || "I'm sorry, I couldn't process that. Could you try again?";
    session.messages.push({ role: "assistant", content: replyText });

    await session.save();

    res.json({
      reply: replyText,
      sessionId: session._id,
      step: session.currentStep,
    });
  } catch (error) {
    console.error("Chat error:", error);
    if (error?.status === 429) {
      return res.status(429).json({ message: "The assistant is busy right now. Please try again in a moment." });
    }
    res.status(500).json({ message: "Something went wrong with the assistant. Please try again." });
  }
};

exports.getHistory = async (req, res) => {
  try {
    const session = await ChatSession.findOne({
      _id: req.params.sessionId,
      userId: req.user.id,
    });
    if (!session) {
      return res.status(404).json({ message: "Session not found." });
    }

    // Return only user and assistant messages (not system/tool)
    const messages = session.messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .filter((m) => m.content && m.content.trim().length > 0)
      .map((m) => ({ role: m.role, content: m.content }));

    res.json({ messages, step: session.currentStep, sessionId: session._id });
  } catch (error) {
    console.error("Chat history error:", error);
    res.status(500).json({ message: "Could not load chat history." });
  }
};

exports.clearSession = async (req, res) => {
  try {
    await ChatSession.deleteOne({ _id: req.params.sessionId, userId: req.user.id });
    res.json({ message: "Chat session cleared." });
  } catch (error) {
    res.status(500).json({ message: "Could not clear session." });
  }
};
