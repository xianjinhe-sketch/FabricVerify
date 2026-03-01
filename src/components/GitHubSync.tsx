import React, { useState, useEffect } from 'react';
import { Github, Loader2, CheckCircle2, XCircle } from 'lucide-react';

export default function GitHubSync() {
  const [isOpen, setIsOpen] = useState(false);
  const [token, setToken] = useState('');
  const [repo, setRepo] = useState('xianjinhe-sketch/FabricVerify');
  const [branch, setBranch] = useState('main');
  const [message, setMessage] = useState('Auto-sync from AI Studio');
  const [status, setStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [commitUrl, setCommitUrl] = useState('');

  useEffect(() => {
    const savedToken = localStorage.getItem('github_sync_token');
    if (savedToken) setToken(savedToken);
  }, []);

  const handleSync = async () => {
    if (!token || !repo || !branch) return;
    
    localStorage.setItem('github_sync_token', token);
    setStatus('syncing');
    setErrorMsg('');

    try {
      const res = await fetch('/api/sync-github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, repo, branch, message })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sync failed');
      
      setStatus('success');
      setCommitUrl(data.commitUrl);
      setTimeout(() => {
        setIsOpen(false);
        setStatus('idle');
      }, 5000);
    } catch (err: any) {
      setStatus('error');
      setErrorMsg(err.message);
    }
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 text-xs font-medium bg-slate-800 text-white px-2 py-1 rounded hover:bg-slate-700 transition-colors ml-2"
        title="Sync code to GitHub"
      >
        <Github size={12} />
        <span>Sync</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Github size={20} />
                Sync to GitHub
              </h2>
              <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600">
                <XCircle size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Personal Access Token</label>
                <input 
                  type="password" 
                  value={token}
                  onChange={e => setToken(e.target.value)}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                  placeholder="ghp_..."
                />
                <p className="text-xs text-slate-500 mt-1">Requires 'repo' scope. Saved locally in browser.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Repository</label>
                <input 
                  type="text" 
                  value={repo}
                  onChange={e => setRepo(e.target.value)}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Branch</label>
                  <input 
                    type="text" 
                    value={branch}
                    onChange={e => setBranch(e.target.value)}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Commit Message</label>
                <input 
                  type="text" 
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                />
              </div>

              {status === 'error' && (
                <div className="p-3 bg-red-50 text-red-700 text-sm rounded-md border border-red-100">
                  {errorMsg}
                </div>
              )}

              {status === 'success' && (
                <div className="p-3 bg-green-50 text-green-700 text-sm rounded-md border border-green-100 flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} />
                    <span className="font-medium">Successfully synced!</span>
                  </div>
                  <a href={commitUrl} target="_blank" rel="noreferrer" className="underline text-brand-600 hover:text-brand-700 break-all">
                    {commitUrl}
                  </a>
                </div>
              )}

              <button
                onClick={handleSync}
                disabled={status === 'syncing' || !token || !repo || !branch}
                className="w-full bg-slate-900 text-white font-medium py-2.5 rounded-md hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
              >
                {status === 'syncing' ? (
                  <><Loader2 size={16} className="animate-spin" /> Syncing...</>
                ) : (
                  'Push Changes'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
