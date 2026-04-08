import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ChatPanel from '../components/ChatPanel';

// Mock the API
vi.mock('../api/api', () => ({
  sendChatMessage: vi.fn(),
  getChatHistory: vi.fn(),
  clearChatSession: vi.fn(),
}));

// Mock VoiceButton
vi.mock('../components/VoiceButton', () => ({
  default: ({ onTranscript, disabled }) => (
    <button data-testid="voice-btn" disabled={disabled} onClick={() => onTranscript('test voice input')}>
      Voice
    </button>
  ),
  speakText: vi.fn(),
  stopSpeaking: vi.fn(),
}));

import { sendChatMessage, getChatHistory, clearChatSession } from '../api/api';
import { stopSpeaking } from '../components/VoiceButton';

describe('ChatPanel', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    getChatHistory.mockResolvedValue({ messages: [] });
  });

  it('renders with greeting message', () => {
    render(<ChatPanel onClose={mockOnClose} />);
    expect(screen.getByText(/Anna — Booking Assistant/)).toBeInTheDocument();
    expect(screen.getByText(/I'm Anna/)).toBeInTheDocument();
  });

  it('shows the step label "Welcome" initially', () => {
    render(<ChatPanel onClose={mockOnClose} />);
    expect(screen.getByText('Welcome')).toBeInTheDocument();
  });

  it('has a close button that calls onClose', () => {
    render(<ChatPanel onClose={mockOnClose} />);
    fireEvent.click(screen.getByTitle('Close chat'));
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('has a new conversation button', () => {
    render(<ChatPanel onClose={mockOnClose} />);
    expect(screen.getByTitle('New conversation')).toBeInTheDocument();
  });

  it('send button is disabled when input is empty', () => {
    render(<ChatPanel onClose={mockOnClose} />);
    expect(screen.getByLabelText('Send message')).toBeDisabled();
  });

  it('enables send button when text is entered', () => {
    render(<ChatPanel onClose={mockOnClose} />);
    const input = screen.getByLabelText('Type your message');
    fireEvent.change(input, { target: { value: 'Hello' } });
    expect(screen.getByLabelText('Send message')).not.toBeDisabled();
  });

  it('sends a message and shows the reply', async () => {
    sendChatMessage.mockResolvedValue({
      reply: 'Great! Let me help you book a caregiver.',
      sessionId: 'sess-123',
      step: 'gathering_info',
    });

    render(<ChatPanel onClose={mockOnClose} />);

    const input = screen.getByLabelText('Type your message');
    fireEvent.change(input, { target: { value: 'I need a caregiver' } });
    fireEvent.click(screen.getByLabelText('Send message'));

    await waitFor(() => {
      expect(screen.getByText('I need a caregiver')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText(/Let me help you book/)).toBeInTheDocument();
    });

    expect(screen.getByText('Collecting Details')).toBeInTheDocument();
  });

  it('clears input after sending', async () => {
    sendChatMessage.mockResolvedValue({
      reply: 'Sure!',
      sessionId: 'sess-123',
    });

    render(<ChatPanel onClose={mockOnClose} />);

    const input = screen.getByLabelText('Type your message');
    fireEvent.change(input, { target: { value: 'Test message' } });
    fireEvent.click(screen.getByLabelText('Send message'));

    await waitFor(() => {
      expect(input).toHaveValue('');
    });
  });

  it('shows error message on API failure', async () => {
    sendChatMessage.mockRejectedValue(new Error('Network error'));

    render(<ChatPanel onClose={mockOnClose} />);

    const input = screen.getByLabelText('Type your message');
    fireEvent.change(input, { target: { value: 'Hello' } });
    fireEvent.click(screen.getByLabelText('Send message'));

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('sends message on Enter key', async () => {
    sendChatMessage.mockResolvedValue({ reply: 'Hi!', sessionId: 'sess-1' });

    render(<ChatPanel onClose={mockOnClose} />);

    const input = screen.getByLabelText('Type your message');
    fireEvent.change(input, { target: { value: 'Enter test' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(sendChatMessage).toHaveBeenCalled();
    });
  });

  it('does not send on Shift+Enter', () => {
    render(<ChatPanel onClose={mockOnClose} />);

    const input = screen.getByLabelText('Type your message');
    fireEvent.change(input, { target: { value: 'Newline test' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', shiftKey: true });

    expect(sendChatMessage).not.toHaveBeenCalled();
  });

  it('resets conversation on New Chat', async () => {
    render(<ChatPanel onClose={mockOnClose} />);

    fireEvent.click(screen.getByTitle('New conversation'));

    await waitFor(() => {
      expect(screen.getByText('Welcome')).toBeInTheDocument();
    });
  });

  it('toggles read aloud', () => {
    render(<ChatPanel onClose={mockOnClose} />);

    const toggleBtn = screen.getByTitle('Read responses aloud');
    fireEvent.click(toggleBtn);
    expect(screen.getByTitle('Turn off read aloud')).toBeInTheDocument();

    fireEvent.click(screen.getByTitle('Turn off read aloud'));
    expect(stopSpeaking).toHaveBeenCalled();
  });

  it('stores sessionId in sessionStorage', async () => {
    sendChatMessage.mockResolvedValue({
      reply: 'Hello!',
      sessionId: 'sess-xyz',
    });

    render(<ChatPanel onClose={mockOnClose} />);

    const input = screen.getByLabelText('Type your message');
    fireEvent.change(input, { target: { value: 'Hi' } });
    fireEvent.click(screen.getByLabelText('Send message'));

    await waitFor(() => {
      expect(sessionStorage.getItem('chatSessionId')).toBe('sess-xyz');
    });
  });
});

describe('formatMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    getChatHistory.mockResolvedValue({ messages: [] });
  });

  it('renders bold text correctly', async () => {
    sendChatMessage.mockResolvedValue({
      reply: 'This is **bold** text',
      sessionId: 'sess-1',
    });

    render(<ChatPanel onClose={() => {}} />);

    const input = screen.getByLabelText('Type your message');
    fireEvent.change(input, { target: { value: 'test' } });
    fireEvent.click(screen.getByLabelText('Send message'));

    await waitFor(() => {
      const allStrong = document.querySelectorAll('strong');
      const last = allStrong[allStrong.length - 1];
      expect(last).toBeTruthy();
      expect(last.textContent).toBe('bold');
    });
  });

  it('escapes HTML to prevent XSS', async () => {
    sendChatMessage.mockResolvedValue({
      reply: '<script>alert("xss")</script>',
      sessionId: 'sess-1',
    });

    render(<ChatPanel onClose={() => {}} />);

    const input = screen.getByLabelText('Type your message');
    fireEvent.change(input, { target: { value: 'test' } });
    fireEvent.click(screen.getByLabelText('Send message'));

    await waitFor(() => {
      expect(screen.getByText(/alert/)).toBeInTheDocument();
    });
  });
});
