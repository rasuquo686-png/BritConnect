import React from 'react';
import { X } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { ChatbotView } from './ChatbotView';

export const ChatDrawer: React.FC = () => {
  const { isChatDrawerOpen, toggleChatDrawer } = useAppStore();

  if (!isChatDrawerOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        onClick={toggleChatDrawer}
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
      />

      {/* Slide-over panel */}
      <div className="relative w-full max-w-md bg-white dark:bg-[#071433] shadow-2xl flex flex-col h-full border-l border-[#D9DCE6] dark:border-[#1E3A8A]">
        <div className="absolute right-3 top-3 z-10">
          <button
            onClick={toggleChatDrawer}
            className="p-1 rounded-lg text-[#6B7280] hover:text-[#111827] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10"
            title="Close AI Analyst Drawer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-hidden p-1">
          <ChatbotView isDrawer={true} />
        </div>
      </div>
    </div>
  );
};
