import React, { useState, useRef, useEffect } from 'react';
import { GeneratedContent } from '../types.ts';
// Fix: Import function that was previously not exported from geminiService.
import { getAIChat } from '../services/geminiService.ts';
import MarkdownRenderer from '../utils/MarkdownRenderer.tsx';

interface Message {
 role: 'user' | 'model';
 text: string;
}

interface AIChatAssistantProps {
 content: GeneratedContent;
 onClose: () => void;
}

export const AIChatAssistant: React.FC<AIChatAssistantProps> = ({ content, onClose }) => {
 const [messages, setMessages] = useState<Message[]>([
 { role: 'model', text: `Hi! I'm your AI assistant for "${content.title}". How can I help you improve or analyze this content?` }
 ]);
 const [inputValue, setInputValue] = useState('');
 const [isTyping, setIsTyping] = useState(false);
 const chatRef = useRef<any | null>(null);
 const messagesEndRef = useRef<HTMLDivElement>(null);

 const scrollToBottom = () => {
 messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
 };

 useEffect(() => {
 scrollToBottom();
 }, [messages, isTyping]);

 const handleSend = async () => {
 if (!inputValue.trim() || isTyping) return;

 const userMessage = inputValue;
 setInputValue('');
 setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
 setIsTyping(true);

 try {
 if (!chatRef.current) {
 chatRef.current = await getAIChat(content);
 }

 const stream = await chatRef.current.sendMessageStream({ message: userMessage });
 let fullText = '';
 
 setMessages(prev => [...prev, { role: 'model', text: '' }]);

 for await (const chunk of stream) {
 const chunkResponse = chunk as any;
 const text = chunkResponse.text || '';
 fullText += text;
 setMessages(prev => {
 const last = prev[prev.length - 1];
 const others = prev.slice(0, -1);
 return [...others, { ...last, text: fullText }];
 });
 }
 } catch (error) {
 console.error('Chat error:', error);
 setMessages(prev => [...prev, { role: 'model', text: 'Sorry, I encountered an error. Please try again.' }]);
 } finally {
 setIsTyping(false);
 }
 };

 return (
 <div className="fixed bottom-4 right-4 w-96 h-[500px] bg-white border border-slate-200 rounded-2xl flex flex-col z-50 overflow-hidden">
 <div className="bg-slate-800 p-4 flex justify-between items-center text-white shrink-0">
 <div className="flex items-center gap-2">
 <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
 <h3 className="font-bold text-sm">AI Assistant</h3>
 </div>
 <button onClick={onClose} className="hover:text-slate-300">
 <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
 </button>
 </div>

 <div className="flex-grow overflow-y-auto p-4 space-y-4 custom-scrollbar">
 {messages.map((msg, i) => (
 <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
 <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${
 msg.role === 'user' 
 ? 'bg-emerald-600 text-white rounded-tr-none' 
 : 'bg-slate-100 text-slate-800 rounded-tl-none border border-slate-200'
 }`}>
 {msg.role === 'model' ? <MarkdownRenderer markdown={msg.text} /> : msg.text}
 </div>
 </div>
 ))}
 {isTyping && messages[messages.length-1].role === 'user' && (
 <div className="flex justify-start">
 <div className="bg-slate-100 p-3 rounded-2xl rounded-tl-none">
 <div className="flex gap-1">
 <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></div>
 <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
 <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.4s]"></div>
 </div>
 </div>
 </div>
 )}
 <div ref={messagesEndRef} />
 </div>

 <div className="p-4 border-t border-slate-200 bg-white shrink-0">
 <div className="relative">
 <input 
 type="text" 
 value={inputValue}
 onChange={(e) => setInputValue(e.target.value)}
 onKeyDown={(e) => e.key === 'Enter' && handleSend()}
 placeholder="Ask anything..."
 className="w-full pl-4 pr-12 py-2.5 bg-slate-100 border-none rounded-xl text-sm focus:ring-2 focus:ring-emerald-500"
 />
 <button 
 onClick={handleSend}
 disabled={!inputValue.trim() || isTyping}
 className="absolute right-2 top-1.5 p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
 >
 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
 </button>
 </div>
 </div>
 </div>
 );
};