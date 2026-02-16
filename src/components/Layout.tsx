import { ReactNode } from 'react';
import { Sidekick } from './Sidekick';

export const Layout = ({ children }: { children: ReactNode }) => {
    return (
        <div className="flex h-screen w-full bg-zinc-950 text-zinc-100 overflow-hidden font-sans">
            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0">
                <header className="h-12 border-b border-zinc-800 flex items-center px-4 bg-zinc-900 draggable">
                    <span className="font-bold text-zinc-100">Chamber.Law</span>
                </header>
                <main className="flex-1 overflow-y-auto p-6">
                    {children}
                </main>
            </div>

            {/* Right Sidebar (Sidekick) */}
            <Sidekick />
        </div>
    );
};
