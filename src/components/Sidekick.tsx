import { useState, useEffect, useRef } from 'react';
import { runtimeConfig } from '../lib/runtimeConfig';
import { clearSidekickToken, getSidekickToken, setSidekickToken } from '../lib/tokenStorage';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

export const Sidekick = () => {
    const [isOpen, setIsOpen] = useState(true);
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [apiKey, setApiKey] = useState('');
    const bottomRef = useRef<HTMLDivElement>(null);

    const API_URL = runtimeConfig.apiBaseUrl;

    useEffect(() => {
        let mounted = true;
        async function loadToken() {
            const storedKey = await getSidekickToken();
            if (storedKey && mounted) setApiKey(storedKey);
        }

        loadToken();

        return () => {
            mounted = false;
        }
    }, []);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSaveKey = async () => {
        if (input.trim()) {
            await setSidekickToken(input.trim());
            setApiKey(input.trim());
            setInput('');
        }
    };

    const sendMessage = async () => {
        if (!input.trim() || isLoading) return;

        const userMsg: Message = { role: 'user', content: input };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        try {
            const res = await fetch(`${API_URL}/ai/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({ message: userMsg.content, context: { source: 'desktop-sidekick' } })
            });

            if (!res.ok) {
                if (res.status === 401) {
                    setApiKey(''); // Reset key if unauthorized
                    await clearSidekickToken();
                    throw new Error("Unauthorized. Please re-enter API Key.");
                }
                throw new Error("Failed to fetch response");
            }

            const data = await res.json();
            const assistantMsg: Message = { role: 'assistant', content: data.data || "I'm not sure how to respond to that." };
            setMessages(prev => [...prev, assistantMsg]);
        } catch (error: any) {
            setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${error.message}` }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (apiKey) {
                sendMessage();
            } else {
                handleSaveKey();
            }
        }
    };

    return (
        <div className={`h-screen bg-zinc-900 border-l border-zinc-800 flex flex-col transition-all duration-300 ${isOpen ? 'w-96' : 'w-12'}`}>
            <div className="h-12 border-b border-zinc-800 flex items-center justify-between px-4 bg-zinc-900">
                {isOpen && <span className="font-semibold text-zinc-100">Chamber AI</span>}
                <button onClick={() => setIsOpen(!isOpen)} className="text-zinc-400 hover:text-white transition-colors">
                    {isOpen ? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M9 18l6-6-6-6" />
                        </svg>
                    ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M15 18l-6-6 6-6" />
                        </svg>
                    )}
                </button>
            </div>

            {isOpen && (
                <>
                    {!apiKey ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                            <p className="text-zinc-400 mb-4">Please enter your API Key or Access Token to connect to Chamber Law.</p>
                            <input
                                type="password"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Paste token here..."
                                className="w-full bg-zinc-800 text-zinc-100 px-3 py-2 rounded border border-zinc-700 focus:outline-none focus:border-blue-500 mb-2"
                            />
                            <button
                                onClick={handleSaveKey}
                                className="w-full bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700 transition"
                            >
                                Connect
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className="flex-1 p-4 overflow-y-auto space-y-4">
                                {messages.length === 0 && (
                                    <div className="text-zinc-500 text-sm text-center mt-10">
                                        How can I help you with your cases today?
                                    </div>
                                )}
                                {messages.map((msg, idx) => (
                                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-300'}`}>
                                            {msg.content}
                                        </div>
                                    </div>
                                ))}
                                {isLoading && (
                                    <div className="flex justify-start">
                                        <div className="bg-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-400">
                                            Thinking...
                                        </div>
                                    </div>
                                )}
                                <div ref={bottomRef} />
                            </div>

                            <div className="p-4 border-t border-zinc-800">
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        placeholder="Ask anything..."
                                        className="w-full bg-zinc-800 text-zinc-100 px-3 py-2 pr-10 rounded border border-zinc-700 focus:outline-none focus:border-zinc-500"
                                        disabled={isLoading}
                                    />
                                    <button
                                        onClick={sendMessage}
                                        disabled={isLoading || !input.trim()}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white disabled:opacity-50"
                                    >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"></path>
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </>
            )}
        </div>
    );
};
