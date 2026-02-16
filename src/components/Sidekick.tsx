import { useState } from 'react';

export const Sidekick = () => {
    const [isOpen, setIsOpen] = useState(true);
    const [input, setInput] = useState('');

    return (
        <div className={`h-screen bg-zinc-900 border-l border-zinc-800 flex flex-col transition-all duration-300 ${isOpen ? 'w-80' : 'w-12'}`}>
            <div className="h-12 border-b border-zinc-800 flex items-center justify-between px-4">
                {isOpen && <span className="font-semibold text-zinc-100">Chamber AI</span>}
                <button onClick={() => setIsOpen(!isOpen)} className="text-zinc-400 hover:text-white">
                    {isOpen ? '→' : '←'}
                </button>
            </div>

            {isOpen && (
                <>
                    <div className="flex-1 p-4 overflow-y-auto">
                        <div className="text-zinc-500 text-sm text-center mt-10">
                            How can I help you with your cases today?
                        </div>
                    </div>

                    <div className="p-4 border-t border-zinc-800">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Ask anything (Cmd+K)..."
                            className="w-full bg-zinc-800 text-zinc-100 px-3 py-2 rounded border border-zinc-700 focus:outline-none focus:border-zinc-500"
                        />
                    </div>
                </>
            )}
        </div>
    );
};
