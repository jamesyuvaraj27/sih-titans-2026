import { useState, useRef, useEffect, type FormEvent, type KeyboardEvent } from 'react';
import { Bot, Send, Sparkles, User, AlertCircle, RefreshCw, ArrowRight, BookOpen } from 'lucide-react';
import { useAuth } from '../lib/auth.js';
import { api } from '../lib/api.js';
import { Card, Button, Badge } from '../components/ui.js';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  source?: 'gemini' | 'local';
}

const STARTER_SUGGESTIONS = [
  'What should I learn next?',
  'Explain my skill gaps',
  'Explain a technical concept',
];

/**
 * Formats basic Markdown elements commonly returned by Gemini:
 * - Code blocks (```)
 * - Inline code (`)
 * - Bold (**text**)
 * - Bullet lists (* or -)
 * - Paragraph breaks
 */
function MarkdownContent({ text }: { text: string }) {
  const parts = text.split(/(```[\s\S]*?```)/g);

  return (
    <div className="space-y-2 text-[14px] leading-relaxed text-ink">
      {parts.map((part, pIdx) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          const lines = part.slice(3, -3).trim().split('\n');
          const firstLine = lines[0]?.trim();
          const hasLang = firstLine && !firstLine.includes(' ') && lines.length > 1;
          const code = hasLang ? lines.slice(1).join('\n') : lines.join('\n');
          const lang = hasLang ? firstLine : '';

          return (
            <div key={pIdx} className="my-2 overflow-hidden rounded border border-border bg-raised text-ink">
              {lang && (
                <div className="flex items-center justify-between border-b border-border bg-surface px-3 py-1 text-[11px] font-mono text-subtle uppercase">
                  <span>{lang}</span>
                </div>
              )}
              <pre className="overflow-x-auto p-3 font-mono text-[13px] leading-snug">
                <code>{code}</code>
              </pre>
            </div>
          );
        }

        const paragraphs = part.split(/\n\n+/);
        return (
          <div key={pIdx} className="space-y-2">
            {paragraphs.map((para, paraIdx) => {
              const trimmed = para.trim();
              if (!trimmed) return null;

              // Check if paragraph is a list
              const lines = trimmed.split('\n');
              const isList = lines.every((l) => l.trim().startsWith('* ') || l.trim().startsWith('- ') || /^\d+\.\s/.test(l.trim()));

              if (isList) {
                return (
                  <ul key={paraIdx} className="list-disc pl-5 space-y-1 my-1">
                    {lines.map((item, itemIdx) => {
                      const cleanItem = item.replace(/^(\*|-|\d+\.)\s+/, '');
                      return (
                        <li key={itemIdx} className="leading-snug">
                          {renderInline(cleanItem)}
                        </li>
                      );
                    })}
                  </ul>
                );
              }

              return (
                <p key={paraIdx} className="leading-relaxed">
                  {renderInline(trimmed)}
                </p>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function renderInline(text: string) {
  // Split on bold (**text**) and inline code (`code`)
  const segments = text.split(/(\*\*.*?\*\*|`.*?`)/g);

  return segments.map((seg, idx) => {
    if (seg.startsWith('**') && seg.endsWith('**') && seg.length >= 4) {
      return <strong key={idx} className="font-semibold text-ink">{seg.slice(2, -2)}</strong>;
    }
    if (seg.startsWith('`') && seg.endsWith('`') && seg.length >= 2) {
      return (
        <code key={idx} className="rounded bg-raised border border-border px-1 py-0.5 font-mono text-[12px] text-primary">
          {seg.slice(1, -1)}
        </code>
      );
    }
    return seg;
  });
}

export function LearnerChat() {
  const { me } = useAuth();
  const quals = (typeof me?.qualifications === 'object' && me?.qualifications !== null && !Array.isArray(me?.qualifications))
    ? (me?.qualifications as Record<string, any>)
    : {};
  const currentJobRole = quals.currentJobRole || me?.designation || 'Software Engineer';
  const desiredJobRole = quals.desiredJobRole || 'Data Analyst';

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Hello ${me?.nameEn?.split(' ')[0] || 'there'}! I am your STATINTEL Learning Assistant.\n\nAsk me about your skills, learning path, competencies, or technical topics. How can I help your progression toward **${desiredJobRole}** today?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  async function sendMessage(textToSend: string) {
    const trimmed = textToSend.trim();
    if (!trimmed || loading) return;

    setError(null);
    setInput('');

    const userMsg: Message = {
      id: String(Date.now()),
      role: 'user',
      content: trimmed,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setLoading(true);

    try {
      // Send chat history for context continuity
      const historyPayload = newHistory
        .filter((m) => m.id !== 'welcome')
        .slice(-8)
        .map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));

      const res = await api<{ reply: string; source?: 'gemini' | 'local' }>('/learner/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: trimmed,
          history: historyPayload,
        }),
      });

      const assistantMsg: Message = {
        id: String(Date.now() + 1),
        role: 'assistant',
        content: res.reply,
        source: res.source ?? 'gemini',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error('Chat error:', err);
      setError(err?.message || 'Failed to receive a response from the Learning Assistant. Please try again.');
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  function handleSuggestionClick(suggestion: string) {
    sendMessage(suggestion);
  }

  function handleResetChat() {
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: `Hello ${me?.nameEn?.split(' ')[0] || 'there'}! I am your STATINTEL Learning Assistant.\n\nAsk me about your skills, learning path, competencies, or technical topics. How can I help your progression toward **${desiredJobRole}** today?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setError(null);
    setInput('');
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-120px)] max-w-4xl flex-col space-y-4">
      {/* Header */}
      <header className="border-b border-border pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white shadow-sm">
                <Bot size={18} aria-hidden="true" />
              </div>
              <h1 className="text-[20px] font-bold tracking-tight text-ink">
                STATINTEL Learning Assistant
              </h1>
              <Badge tone="primary">
                <Sparkles size={11} className="mr-1" />
                AI Assistant
              </Badge>
            </div>
            <p className="mt-1 text-[13px] text-muted">
              Ask me about your skills, learning path, competencies, or technical topics.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-[12px] text-muted">
              <span className="font-medium text-ink">{currentJobRole}</span>
              <ArrowRight size={12} className="text-primary" />
              <span className="font-semibold text-primary">{desiredJobRole}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetChat}
              title="Reset conversation"
              className="text-subtle hover:text-ink"
            >
              <RefreshCw size={14} className="mr-1" />
              New Chat
            </Button>
          </div>
        </div>
      </header>

      {/* Main chat messages container */}
      <Card className="flex flex-1 flex-col overflow-hidden shadow-sm">
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft border border-primary/20 text-primary">
                    <Bot size={16} aria-hidden="true" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 shadow-xs ${
                    isUser
                      ? 'bg-primary text-white rounded-br-xs'
                      : 'bg-surface border border-border text-ink rounded-bl-xs'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4 mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[11px] font-semibold ${isUser ? 'text-white/80' : 'text-subtle'}`}>
                        {isUser ? 'You' : 'Learning Assistant'}
                      </span>
                      {!isUser && msg.id !== 'welcome' && (
                        msg.source === 'local' ? (
                          <span className="inline-flex items-center gap-1 rounded bg-raised border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted">
                            <BookOpen size={10} className="text-primary" />
                            STATINTEL knowledge base
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded bg-primary-soft border border-primary/20 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                            <Sparkles size={10} />
                            AI response
                          </span>
                        )
                      )}
                    </div>
                    <span className={`text-[10px] ${isUser ? 'text-white/60' : 'text-subtle'}`}>
                      {msg.timestamp}
                    </span>
                  </div>

                  {isUser ? (
                    <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-white">
                      {msg.content}
                    </p>
                  ) : (
                    <MarkdownContent text={msg.content} />
                  )}
                </div>

                {isUser && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-white">
                    <User size={16} aria-hidden="true" />
                  </div>
                )}
              </div>
            );
          })}

          {/* Loading Indicator */}
          {loading && (
            <div className="flex gap-3 justify-start items-center">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft border border-primary/20 text-primary">
                <Bot size={16} className="animate-pulse" aria-hidden="true" />
              </div>
              <div className="rounded-2xl rounded-bl-xs border border-border bg-surface px-4 py-3 shadow-xs text-muted flex items-center gap-2">
                <span className="flex space-x-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]"></span>
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]"></span>
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce"></span>
                </span>
                <span className="text-[13px] ml-1.5">Thinking...</span>
              </div>
            </div>
          )}

          {/* Error notification */}
          {error && (
            <div className="rounded-lg border border-critical/30 bg-critical/10 p-3 text-[13px] text-critical flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="font-semibold">Unable to process request</p>
                <p className="text-[12px] opacity-90 mt-0.5">{error}</p>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Starter suggestions bar */}
        <div className="border-t border-border bg-raised/50 px-4 py-2.5">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-subtle shrink-0">
              Suggestions:
            </span>
            {STARTER_SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => handleSuggestionClick(suggestion)}
                disabled={loading}
                className="inline-flex shrink-0 items-center rounded-full border border-border bg-surface px-3 py-1 text-[12px] font-medium text-ink transition-colors hover:border-primary/40 hover:bg-primary-soft hover:text-primary disabled:opacity-50 cursor-pointer"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>

        {/* Input box */}
        <form onSubmit={onSubmit} className="border-t border-border bg-surface p-3">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Ask me about your skills, learning path, competencies, or technical topics..."
              disabled={loading}
              className="min-h-[44px] flex-1 rounded border border-border-strong bg-raised px-4 text-[14px] text-ink placeholder:text-subtle focus:border-primary focus:outline-none"
            />
            <Button
              type="submit"
              disabled={!input.trim() || loading}
              loading={loading}
              className="shrink-0 px-4"
            >
              <Send size={16} aria-hidden="true" />
              <span className="hidden sm:inline">Send</span>
            </Button>
          </div>
          <p className="mt-1.5 text-center text-[11px] text-subtle">
            STATINTEL Learning Assistant is customized for your profile and career pathway.
          </p>
        </form>
      </Card>
    </div>
  );
}
