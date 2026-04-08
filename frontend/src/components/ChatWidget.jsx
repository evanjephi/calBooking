import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import ChatPanel from "./ChatPanel";

export default function ChatWidget() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  // Only show for logged-in clients
  if (!user || user.role === "admin") return null;

  return (
    <>
      {/* Chat Panel */}
      {open && <ChatPanel onClose={() => setOpen(false)} />}

      {/* FAB - Floating Action Button */}
      {!open && (
        <button
          className="chat-fab"
          onClick={() => setOpen(true)}
          aria-label="Open booking assistant"
          title="Need help? Chat with Anna"
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span className="chat-fab-label">Need Help?</span>
        </button>
      )}
    </>
  );
}
