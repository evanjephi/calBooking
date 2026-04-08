import { useState, useRef, useEffect, useCallback } from "react";
import { sendChatMessage, getChatHistory, clearChatSession } from "../api/api";
import VoiceButton, { speakText, stopSpeaking } from "./VoiceButton";

const STEP_LABELS = {
  greeting: "Welcome",
  gathering_info: "Collecting Details",
  checking_availability: "Finding Caregivers",
  selecting_psw: "Choosing Caregiver",
  finalizing: "Confirming Booking",
  complete: "Booking Complete",
  general_qa: "General Info",
};

export default function ChatPanel({ onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(() => sessionStorage.getItem("chatSessionId") || null);
  const [step, setStep] = useState("greeting");
  const [readAloud, setReadAloud] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load history on mount if session exists
  useEffect(() => {
    if (sessionId) {
      getChatHistory(sessionId)
        .then((data) => {
          if (data.messages?.length > 0) {
            setMessages(data.messages);
            setStep(data.step || "greeting");
          }
        })
        .catch(() => {
          // Session expired or invalid
          sessionStorage.removeItem("chatSessionId");
          setSessionId(null);
        });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Show greeting if no messages
  useEffect(() => {
    if (messages.length === 0 && !sessionId) {
      setMessages([
        {
          role: "assistant",
          content:
            "Hello! I'm Anna, your PremierPSW booking assistant. 😊\n\nI can help you:\n\n1. **Book a caregiver** — I'll walk you through it step by step\n2. **View your bookings** — Check upcoming visits\n3. **Answer questions** — About our services, pricing, or how things work\n\nHow can I help you today?",
        },
      ]);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSend = useCallback(async (text) => {
    const messageText = (text || input).trim();
    if (!messageText || loading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: messageText }]);
    setLoading(true);

    try {
      const data = await sendChatMessage({ message: messageText, sessionId });
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      if (data.sessionId) {
        setSessionId(data.sessionId);
        sessionStorage.setItem("chatSessionId", data.sessionId);
      }
      if (data.step) setStep(data.step);
      if (data.step === "complete") {
        window.dispatchEvent(new Event("booking-created"));
      }
      if (readAloud) speakText(data.reply);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: err.message || "Sorry, something went wrong. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [input, loading, sessionId, readAloud]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewChat = async () => {
    stopSpeaking();
    if (sessionId) {
      try {
        await clearChatSession(sessionId);
      } catch { /* ignore */ }
    }
    sessionStorage.removeItem("chatSessionId");
    setSessionId(null);
    setStep("greeting");
    setMessages([
      {
        role: "assistant",
        content:
          "Hello! I'm Anna, your PremierPSW booking assistant. 😊\n\nHow can I help you today?",
      },
    ]);
  };

  const handleVoiceTranscript = useCallback((transcript) => {
    handleSend(transcript);
  }, [handleSend]);

  const toggleReadAloud = () => {
    setReadAloud((prev) => {
      if (prev) stopSpeaking();
      return !prev;
    });
  };

  return (
    <div className="chat-panel">
      {/* Header */}
      <div className="chat-panel-header">
        <div className="chat-panel-header-left">
          <div className="chat-avatar">A</div>
          <div>
            <div className="chat-header-name">Anna — Booking Assistant</div>
            <div className="chat-header-step">{STEP_LABELS[step] || ""}</div>
          </div>
        </div>
        <div className="chat-panel-header-right">
          <button
            className={`chat-header-btn ${readAloud ? "chat-header-btn--active" : ""}`}
            onClick={toggleReadAloud}
            title={readAloud ? "Turn off read aloud" : "Read responses aloud"}
            aria-label={readAloud ? "Turn off read aloud" : "Read responses aloud"}
          >
            {readAloud ? "🔊" : "🔇"}
          </button>
          <button className="chat-header-btn" onClick={handleNewChat} title="New conversation" aria-label="New conversation">
            ↻
          </button>
          <button className="chat-header-btn" onClick={onClose} title="Close chat" aria-label="Close chat">
            ✕
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`chat-bubble chat-bubble--${msg.role}`}>
            {msg.role === "assistant" && <div className="chat-bubble-avatar">A</div>}
            <div className="chat-bubble-content">
              <div className="chat-bubble-text" dangerouslySetInnerHTML={{ __html: formatMessage(msg.content) }} />
            </div>
          </div>
        ))}
        {loading && (
          <div className="chat-bubble chat-bubble--assistant">
            <div className="chat-bubble-avatar">A</div>
            <div className="chat-bubble-content">
              <div className="chat-typing">
                <span></span><span></span><span></span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="chat-input-area">
        <VoiceButton onTranscript={handleVoiceTranscript} disabled={loading} />
        <textarea
          ref={inputRef}
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your message or tap the mic…"
          rows={1}
          disabled={loading}
          aria-label="Type your message"
        />
        <button
          className="chat-send-btn"
          onClick={() => handleSend()}
          disabled={loading || !input.trim()}
          aria-label="Send message"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// Simple markdown-like formatting for assistant messages
function formatMessage(text) {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br />");
}
