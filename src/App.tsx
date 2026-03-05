import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { Role } from './types';
import InspectorView from './components/InspectorView';
import ClientPortal from './components/ClientPortal';
import CSDashboard from './components/CSDashboard';
import ReviewerView from './components/ReviewerView';
import { LayoutDashboard, ClipboardCheck, Users, SearchCheck, Loader2 } from 'lucide-react';
import { useAppStore } from './store/useAppStore';
import { dataService } from './services/dataService';
import toast from 'react-hot-toast';

// Component to handle header and navigation
const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentRole, setRole } = useAppStore();
  const location = useLocation();

  const getRoleFromPath = (path: string) => {
    if (path.includes('/client')) return Role.CLIENT;
    if (path.includes('/cs')) return Role.CS;
    if (path.includes('/inspector')) return Role.INSPECTOR;
    if (path.includes('/reviewer')) return Role.REVIEWER;
    return Role.INSPECTOR;
  };

  useEffect(() => {
    const roleFromPath = getRoleFromPath(location.pathname);
    if (currentRole !== roleFromPath) {
      setRole(roleFromPath);
    }
  }, [location.pathname, currentRole, setRole]);

  const navItems = [
    { r: Role.CLIENT, icon: Users, label: 'Client', path: '/client' },
    { r: Role.CS, icon: LayoutDashboard, label: 'CS Admin', path: '/cs' },
    { r: Role.INSPECTOR, icon: ClipboardCheck, label: 'Inspector', path: '/inspector' },
    { r: Role.REVIEWER, icon: SearchCheck, label: 'Reviewer', path: '/reviewer' }
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-brand-700">
            <SearchCheck size={24} />
            <div className="flex items-baseline gap-1">
              <h1 className="text-lg font-bold tracking-tight">FabricVerify</h1>
              <span className="text-[9px] font-medium bg-brand-100 text-brand-800 px-1.5 py-0.5 rounded-full">v1.2</span>
            </div>
          </div>

          <div className="hidden md:flex gap-1 bg-slate-100 p-1 rounded-lg">
            {navItems.map((item) => (
              <Link
                key={item.r}
                to={item.path}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors
                   ${location.pathname.startsWith(item.path) ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
              >
                <item.icon size={16} /> {item.label}
              </Link>
            ))}
          </div>
        </div>
        {/* Mobile Nav */}
        <div className="md:hidden flex overflow-x-auto gap-2 p-2 bg-slate-100 no-scrollbar">
          {navItems.map((item) => (
            <Link
              key={item.r}
              to={item.path}
              className={`whitespace-nowrap px-3 py-1 text-xs font-bold rounded-full ${location.pathname.startsWith(item.path) ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 border'}`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </header>

      <main className="flex-1 w-full p-3">
        {children}
      </main>
    </div>
  );
};

// Main App Component with Routes
const App: React.FC = () => {
  const { setActiveJob, setLoading, loading, currentRole, activeJob } = useAppStore();

  useEffect(() => {
    fetchActiveJob();
  }, [currentRole]); // Optional dependency, keeping it similar to original

  const fetchActiveJob = async () => {
    setLoading(true);
    try {
      const job = await dataService.fetchActiveJob();
      setActiveJob(job);
    } catch (error) {
      console.error('Error fetching active job:', error);
      toast.error('Failed to fetch active job');
    } finally {
      setLoading(false);
    }
  };

  const updateJobInSupabase = async (updatedJob: any) => {
    setActiveJob(updatedJob);
    try {
      await dataService.updateJobMetadata(updatedJob.id, updatedJob);
    } catch (error) {
      console.error('Error updating job in Supabase:', error);
      toast.error('Failed to update job');
    }
  };

  const InspectorRoute = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
          <Loader2 className="animate-spin text-brand-600" size={48} />
          <p className="text-slate-500 font-medium">Synchronizing with Supabase...</p>
        </div>
      );
    }

    if (!activeJob) {
      return (
        <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 text-center">
          <ClipboardCheck className="mx-auto text-slate-300 mb-4" size={48} />
          <h2 className="text-xl font-bold text-slate-800 mb-2">No Active Job</h2>
          <p className="text-slate-500 mb-6">There are currently no inspection jobs assigned to you.</p>
          <button
            onClick={fetchActiveJob}
            className="bg-brand-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-brand-700"
          >
            Refresh Data
          </button>
        </div>
      );
    }

    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white p-4 rounded-lg shadow-sm mb-6 border-l-4 border-brand-500">
          <h2 className="font-bold text-lg">Job #{activeJob.id.split('-')[0].toUpperCase()}</h2>
          <p className="text-slate-500 text-sm">Booking ID: {activeJob.bookingId} | Fabric: {activeJob.fabricType}</p>
        </div>
        <InspectorView job={activeJob} onUpdateJob={updateJobInSupabase} />
      </div>
    );
  };

  return (
    <Router>
      <AppLayout>
        <Routes>
          <Route path="/" element={<Navigate to="/inspector" replace />} />
          <Route path="/client/*" element={<ClientPortal />} />
          <Route path="/cs/*" element={<CSDashboard />} />
          <Route path="/inspector/*" element={<InspectorRoute />} />
          <Route path="/reviewer/*" element={<ReviewerView />} />
        </Routes>
      </AppLayout>
    </Router>
  );
};

export default App;