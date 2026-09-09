import React, { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { askDuka } from '@/lib/assistant';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { Send, Sparkles } from 'lucide-react';

interface Message { role: 'user' | 'assistant'; text: string; }

const SUGGESTIONS = [
  'How much did I sell today?',
  'Who owes me the most?',
  'Which products are selling fastest?',
  'Which products are low on stock?',
  'What was my profit this week?',
  'Which products should I restock?',
];

export default function AssistantPage() {
  const { shop } = useAuth();
  const { addToast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || !shop || thinking) return;
    setMessages(m => [...m, { role: 'user', text: question }]);
    setInput('');
    setThinking(true);
    try {
      const answer = await askDuka(question, { shopId: shop.id, shopName: shop.name });
      setMessages(m => [...m, { role: 'assistant', text: answer }]);
    } catch {
      addToast('error', 'Could not answer that');
      setMessages(m => [...m, { role: 'assistant', text: 'Sorry, I could not read the shop data just now. Please try again.' }]);
    } finally {
      setThinking(false);
    }
  };

  return (
    <div className="px-4 lg:px-8 py-5 max-w-2xl mx-auto flex flex-col h-full pb-24 lg:pb-6">
      <div className="page-header">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Duka Assistant
          </h1>
          <p className="text-xs text-text-muted mt-0.5">Answers come only from your real shop data</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 py-4">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-xl bg-primary-ghost border border-primary/20 flex items-center justify-center mx-auto mb-3">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <p className="text-sm font-medium text-text-secondary">Ask about your shop</p>
            <p className="text-xs text-text-muted mt-1">Try one of the suggestions below</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm whitespace-pre-line ${
              m.role === 'user'
                ? 'bg-primary text-text-inverse rounded-br-md'
                : 'bg-surface border border-border-subtle text-text rounded-bl-md'
            }`}>
              {m.text}
            </div>
          </div>
        ))}
        {thinking && (
          <div className="flex justify-start">
            <div className="px-4 py-2.5 rounded-2xl rounded-bl-md bg-surface border border-border-subtle text-sm text-text-muted">
              Checking your numbers…
            </div>
          </div>
        )}
      </div>

      {/* Suggestions */}
      {messages.length === 0 && (
        <div className="flex flex-wrap gap-1.5 pb-3">
          {SUGGESTIONS.map(s => (
            <button key={s} onClick={() => send(s)}
              className="px-3 py-1.5 rounded-full bg-surface border border-border-subtle text-[11px] font-medium text-text-secondary hover:text-primary hover:border-primary/30 transition-colors">
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') send(input); }}
          placeholder="Ask about sales, debt, stock…"
          className="flex-1 h-11 px-4 rounded-xl border border-border-subtle bg-elevated text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/25"
        />
        <Button onClick={() => send(input)} disabled={!input.trim() || thinking} aria-label="Send">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
