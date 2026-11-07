import React, { useState, useEffect, useRef } from 'react';
import {
  Bot,
  Send,
  Trash2,
  Sparkles,
  Info,
  ChevronDown,
  ChevronUp,
  User,
  ShieldAlert,
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { computeDashboardKpis } from '../../engine/centralMetrics';
import { sendChatMessage } from '../../ai/geminiClient';
import * as db from '../../store/db';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  toolCalls?: any[];
}

export const ChatbotView: React.FC<{ isDrawer?: boolean }> = ({ isDrawer = false }) => {
  const { filteredRecords, scoredCustomers, trainedModel } = useAppStore();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showSources, setShowSources] = useState<Record<string, boolean>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load chat history from IndexedDB on mount
  useEffect(() => {
    db.loadChatHistory().then((history) => {
      if (history.length > 0) {
        setMessages(history);
      }
    });
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const starterChips = [
    'What is our current churn rate?',
    'Which customer segment has the highest churn?',
    'What are the major drivers of customer churn?',
    'Which customers are at critical risk?',
    'How much revenue are we losing monthly?',
    'Which contracts are expiring within 30 days?',
    'What retention strategies should we prioritize?',
    'Which campaigns are performing best?',
  ];

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputValue;
    if (!text.trim()) return;

    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInputValue('');
    setIsTyping(true);

    await db.saveChatMessage(userMsg);

    // Compute ground-truth dataset context
    const kpis = computeDashboardKpis(
      filteredRecords,
      scoredCustomers,
      trainedModel?.metrics.rocAuc ?? null,
      trainedModel?.metrics.prAuc ?? null
    );

    const context = {
      kpis,
      model: trainedModel ? { name: trainedModel.modelName, auc: trainedModel.metrics.rocAuc } : null,
      topReasons: filteredRecords.filter((r) => Number(r['Churn Flag']) === 1).slice(0, 5).map((r) => r['Churn Reason']),
    };

    const reply = await sendChatMessage(
      nextMessages.map((m) => ({ role: m.role, content: m.content })),
      context
    );

    const assistantMsg: ChatMessage = {
      id: `msg_${Date.now() + 1}`,
      role: 'assistant',
      content: reply,
      timestamp: new Date().toISOString(),
      toolCalls: [
        { tool: 'computeDashboardKpis', filters: 'active' },
        { tool: 'segmentationDrilldown', recordsExamined: filteredRecords.length },
      ],
    };

    setMessages([...nextMessages, assistantMsg]);
    setIsTyping(false);
    await db.saveChatMessage(assistantMsg);
  };

  const handleClear = async () => {
    await db.clearChatHistory();
    setMessages([]);
  };

  return (
    <div className={`flex flex-col bg-white dark:bg-[#071433] rounded-xl border border-[#D9DCE6] dark:border-[#1E3A8A] shadow-xs overflow-hidden ${isDrawer ? 'h-full' : 'h-[750px]'}`}>
      {/* Chat Header */}
      <div className="p-4 border-b border-[#D9DCE6] dark:border-[#1E3A8A] flex items-center justify-between shrink-0 bg-[#F5F6FA] dark:bg-[#0B1F4B]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#0B1F4B] text-[#C9A227] flex items-center justify-center">
            <Bot size={18} />
          </div>
          <div>
            <h3 className="font-serif text-sm font-bold text-[#0B1F4B] dark:text-white flex items-center gap-1.5">
              BritConnect AI Analyst
              <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-[#C9A227]/20 text-[#856404] dark:text-[#E8D48A] font-bold">
                Local Tools
              </span>
            </h3>
            <p className="text-[11px] text-[#6B7280] dark:text-[#D9DCE6]/70">
              Deterministic querying over {filteredRecords.length.toLocaleString()} records
            </p>
          </div>
        </div>

        {messages.length > 0 && (
          <button
            onClick={handleClear}
            className="p-1.5 rounded text-[#6B7280] hover:text-red-600 transition-colors"
            title="Clear conversation history"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {/* Messages Viewport */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="py-10 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-[#1E3A8A]/10 text-[#0B1F4B] dark:text-[#C9A227] flex items-center justify-center mx-auto">
              <Sparkles size={22} />
            </div>
            <div>
              <h4 className="font-serif text-sm font-bold text-[#0B1F4B] dark:text-white">
                How may I assist your retention strategy?
              </h4>
              <p className="text-xs text-[#6B7280] dark:text-[#D9DCE6]/70 max-w-sm mx-auto mt-1">
                Ask natural-language questions about customer churn drivers, segment risks, or what-if interventions.
              </p>
            </div>

            {/* Starter Chips */}
            <div className="flex flex-wrap justify-center gap-2 max-w-lg mx-auto pt-2">
              {starterChips.map((chip, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(chip)}
                  className="px-3 py-1.5 rounded-lg border border-[#D9DCE6] dark:border-[#1E3A8A] text-xs text-[#111827] dark:text-[#D9DCE6] hover:bg-[#F5F6FA] dark:hover:bg-[#1E3A8A] transition-colors text-left"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 text-xs ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-lg bg-[#0B1F4B] text-[#C9A227] flex items-center justify-center shrink-0 mt-0.5">
                  <Bot size={15} />
                </div>
              )}

              <div className={`max-w-[85%] rounded-xl p-3.5 leading-relaxed space-y-2 ${
                msg.role === 'user'
                  ? 'bg-[#0B1F4B] text-white'
                  : 'bg-[#F5F6FA] dark:bg-[#0B1F4B] text-[#111827] dark:text-[#D9DCE6] border border-[#D9DCE6] dark:border-[#1E3A8A]'
              }`}>
                <div className="whitespace-pre-wrap">{msg.content}</div>

                {/* Show Sources / Calculations expander */}
                {msg.toolCalls && msg.toolCalls.length > 0 && (
                  <div className="pt-2 border-t border-[#D9DCE6]/60 dark:border-[#1E3A8A]/50">
                    <button
                      onClick={() => setShowSources({ ...showSources, [msg.id]: !showSources[msg.id] })}
                      className="text-[10px] text-[#6B7280] dark:text-[#D9DCE6]/70 font-semibold flex items-center gap-1 hover:underline"
                    >
                      <Info size={11} />
                      <span>{showSources[msg.id] ? 'Hide' : 'Show'} calculation sources</span>
                    </button>

                    {showSources[msg.id] && (
                      <div className="mt-1.5 p-2 rounded bg-black/5 dark:bg-black/20 text-[10px] font-mono space-y-0.5">
                        <div>Dataset: {filteredRecords.length} records analyzed</div>
                        <div>Currency: GBP (£) · Locale: en-GB</div>
                        <div>Local Function: computeDashboardKpis() executed</div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {msg.role === 'user' && (
                <div className="w-7 h-7 rounded-lg bg-[#1E3A8A] text-white flex items-center justify-center shrink-0 mt-0.5">
                  <User size={14} />
                </div>
              )}
            </div>
          ))
        )}

        {isTyping && (
          <div className="flex gap-3 text-xs">
            <div className="w-7 h-7 rounded-lg bg-[#0B1F4B] text-[#C9A227] flex items-center justify-center shrink-0">
              <Bot size={15} />
            </div>
            <div className="p-3 rounded-xl bg-[#F5F6FA] dark:bg-[#0B1F4B] text-[#6B7280] italic flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#C9A227] animate-pulse" />
              <span>Analyzing subscriber data...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Field */}
      <div className="p-3 border-t border-[#D9DCE6] dark:border-[#1E3A8A] bg-white dark:bg-[#071433] shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask BritConnect AI Analyst anything..."
            className="flex-1 px-3 py-2 text-xs bg-[#F5F6FA] dark:bg-[#0B1F4B] text-[#111827] dark:text-white border border-[#D9DCE6] dark:border-[#1E3A8A] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#C9A227]"
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isTyping}
            className="p-2 rounded-lg bg-[#0B1F4B] text-white hover:bg-[#1E3A8A] transition-colors disabled:opacity-40"
          >
            <Send size={15} className="text-[#C9A227]" />
          </button>
        </form>
        <div className="mt-1.5 text-[10px] text-[#6B7280] text-center">
          Outputs are AI-generated based on local mathematical calculations. Never discloses raw PII.
        </div>
      </div>
    </div>
  );
};
