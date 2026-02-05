import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HiOutlineChat,
  HiOutlineX,
  HiOutlinePaperAirplane,
  HiOutlineRefresh
} from 'react-icons/hi';
import { useAuth } from '../../context/AuthContext';
import { chatApi } from '../../services/api';
import toast from 'react-hot-toast';

export default function ChatBubble() {
  const { isAuthenticated } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const messagesEndRef = useRef(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Add welcome message when opened
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          role: 'assistant',
          content: "Hi! I'm RegBot, your privacy regulation assistant. How can I help you today?\n\nYou can ask me about:\n- Specific regulations (GDPR, CCPA, etc.)\n- Compliance requirements\n- Recent regulatory updates\n- Comparisons between regulations",
          timestamp: new Date()
        }
      ]);
    }
  }, [isOpen, messages.length]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await chatApi.sendMessage({
        message: userMessage.content,
        sessionId
      });

      const { sessionId: newSessionId, message } = response.data.data;
      setSessionId(newSessionId);

      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: message.content,
          sources: message.sources,
          timestamp: new Date(message.timestamp)
        }
      ]);
    } catch (error) {
      toast.error('Failed to send message');
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.',
          timestamp: new Date()
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const startNewChat = () => {
    setMessages([]);
    setSessionId(null);
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="chat-bubble">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="absolute bottom-16 right-0 w-96 h-[500px] bg-white dark:bg-surface-800 rounded-2xl shadow-2xl border border-surface-200 dark:border-surface-700 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-surface-200 dark:border-surface-700 bg-gradient-to-r from-primary-500 to-accent-500">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <HiOutlineChat className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">RegBot</h3>
                  <p className="text-xs text-white/80">AI Assistant</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={startNewChat}
                  className="p-2 rounded-lg hover:bg-white/20 text-white"
                  title="New chat"
                >
                  <HiOutlineRefresh className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-lg hover:bg-white/20 text-white"
                >
                  <HiOutlineX className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                      msg.role === 'user'
                        ? 'bg-accent-500 text-white'
                        : 'bg-surface-100 dark:bg-surface-700'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    {msg.sources?.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-surface-200 dark:border-surface-600">
                        <p className="text-xs font-medium mb-1 opacity-70">Sources:</p>
                        <div className="space-y-1">
                          {msg.sources.map((source, i) => (
                            <a
                              key={i}
                              href={source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block text-xs text-accent-400 hover:underline truncate"
                            >
                              {source.title}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-surface-100 dark:bg-surface-700 rounded-2xl px-4 py-3">
                    <div className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <motion.div
                          key={i}
                          className="w-2 h-2 bg-surface-400 rounded-full"
                          animate={{ y: [-2, 2, -2] }}
                          transition={{
                            duration: 0.5,
                            repeat: Infinity,
                            delay: i * 0.1
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-surface-200 dark:border-surface-700">
              <div className="flex items-center gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask about privacy regulations..."
                  className="flex-1 input resize-none py-2 max-h-24"
                  rows={1}
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || loading}
                  className="btn-accent p-2.5 rounded-xl disabled:opacity-50"
                >
                  <HiOutlinePaperAirplane className="w-5 h-5" />
                </button>
              </div>
              <p className="text-xs text-surface-400 mt-2 text-center">
                AI can make mistakes. Verify important information.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toggle button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 text-white shadow-lg flex items-center justify-center"
      >
        {isOpen ? (
          <HiOutlineX className="w-6 h-6" />
        ) : (
          <HiOutlineChat className="w-6 h-6" />
        )}
      </motion.button>
    </div>
  );
}
