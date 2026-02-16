import { Layout } from './components/Layout'
import './App.css'

function App() {
  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">Unified Workspace</h1>
        <p className="text-zinc-400">Welcome to your new legal operating system.</p>

        <div className="grid grid-cols-2 gap-4 mt-8">
          <div className="p-6 bg-zinc-900 rounded border border-zinc-800">
            <h2 className="text-xl font-semibold mb-2">Recent Cases</h2>
            <div className="space-y-2">
              <div className="h-2 bg-zinc-800 rounded w-3/4"></div>
              <div className="h-2 bg-zinc-800 rounded w-1/2"></div>
            </div>
          </div>
          <div className="p-6 bg-zinc-900 rounded border border-zinc-800">
            <h2 className="text-xl font-semibold mb-2">Drafts</h2>
            <div className="space-y-2">
              <div className="h-2 bg-zinc-800 rounded w-3/4"></div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}

export default App
