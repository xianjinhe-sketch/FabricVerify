import React, { useState, useEffect } from 'react';
import { Role, InspectionJob, FabricType, RollData, Defect } from './types';
import { calculateRollStats } from './utils/scoring';
import InspectorView from './components/InspectorView';
import ClientPortal from './components/ClientPortal';
import CSDashboard from './components/CSDashboard';
import { LayoutDashboard, ClipboardCheck, Users, SearchCheck, Loader2 } from 'lucide-react';
import GitHubSync from './components/GitHubSync';
import { dataService } from './services/dataService';

// Main App Component
const App: React.FC = () => {
  const [currentRole, setCurrentRole] = useState<Role>(Role.INSPECTOR);
  const [loading, setLoading] = useState(true);

  // Global State for Inspection Job
  const [activeJob, setActiveJob] = useState<InspectionJob | null>(null);

  useEffect(() => {
    fetchActiveJob();
  }, []);

  const fetchActiveJob = async () => {
    setLoading(true);
    try {
      const job = await dataService.fetchActiveJob();
      setActiveJob(job);
    } catch (error) {
      console.error('Error fetching active job:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateJobInSupabase = async (updatedJob: InspectionJob) => {
    setActiveJob(updatedJob);
    try {
      await dataService.updateJobMetadata(updatedJob.id, updatedJob);
    } catch (error) {
      console.error('Error updating job in Supabase:', error);
    }
  };

  const generateReport = () => {
    if (!activeJob) return;
    const headers = [
      "Roll No", "Dye Lot", "Length (m)", "Width (inch)",
      "1 Point Defects", "2 Point Defects", "3 Point Defects", "4 Point Defects",
      "Total Points", "Score (Pts/100sq.yd)", "Result", "Comments"
    ];

    const rows = activeJob.rolls.map(r => {
      const stats = calculateRollStats(r, activeJob.passThreshold);
      return [
        r.rollNo,
        r.dyeLot,
        r.actualLength || r.length,
        r.actualWidth || r.width,
        stats.points1, stats.points2, stats.points3, stats.points4,
        stats.totalPoints,
        stats.score.toFixed(1),
        stats.isPass ? 'PASS' : 'FAIL',
        `"${r.comments.replace(/"/g, '""')}"`
      ].join(",");
    });

    const metaInfo = [
      '',
      `Sampling Method,${activeJob.samplingMethod || 'N/A'}`,
      `Pass Threshold,${activeJob.passThreshold}`,
      ...(activeJob.reviewerComments ? [`Reviewer Comments,"${activeJob.reviewerComments.replace(/"/g, '""')}"`] : [])
    ];
    const csvContent = [headers.join(","), ...rows, ...metaInfo].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Approved_Report_${activeJob.bookingId}.csv`;
    a.click();
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
          <Loader2 className="animate-spin text-brand-600" size={48} />
          <p className="text-slate-500 font-medium">Synchronizing with Supabase...</p>
        </div>
      );
    }

    if (!activeJob && currentRole !== Role.CS && currentRole !== Role.CLIENT) {
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

    switch (currentRole) {
      case Role.CLIENT:
        return <ClientPortal />;
      case Role.CS:
        return <CSDashboard />;
      case Role.INSPECTOR:
        return activeJob ? (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white p-4 rounded-lg shadow-sm mb-6 border-l-4 border-brand-500">
              <h2 className="font-bold text-lg">Job #{activeJob.id.split('-')[0].toUpperCase()}</h2>
              <p className="text-slate-500 text-sm">Booking ID: {activeJob.bookingId} | Fabric: {activeJob.fabricType}</p>
            </div>
            <InspectorView job={activeJob} onUpdateJob={updateJobInSupabase} />
          </div>
        ) : null;
      case Role.REVIEWER:
        return activeJob ? (
          <div className="max-w-4xl mx-auto bg-white p-8 rounded shadow">
            <h2 className="text-2xl font-bold mb-6">Report Review</h2>
            {activeJob.status === 'SUBMITTED' || activeJob.status === 'APPROVED' ? (
              <div>
                <div className={`p-4 rounded mb-4 ${activeJob.status === 'APPROVED' ? 'bg-green-100 text-green-800' : 'bg-blue-50 text-blue-800'}`}>
                  {activeJob.status === 'APPROVED'
                    ? 'This report has been approved.'
                    : 'This report has been submitted by the inspector and is ready for review.'}
                </div>
                <h3 className="font-bold text-lg mb-2">Summary</h3>
                <p>Rolls Inspected: {activeJob.rolls.length}</p>
                <p>Rolls Passed: {activeJob.rolls.filter(r => {
                  const stats = calculateRollStats(r, activeJob.passThreshold);
                  return stats.isPass;
                }).length}</p>

                <div className="mt-4">
                  <label className="block text-sm font-bold text-slate-700 mb-2">Reviewer Feedback</label>
                  <textarea
                    className="w-full p-3 border rounded-lg h-24"
                    placeholder="Provide feedback if rejecting or internal notes..."
                    value={activeJob.reviewerComments || ''}
                    onChange={(e) => updateJobInSupabase({ ...activeJob, reviewerComments: e.target.value })}
                  />
                </div>

                <div className="flex gap-4 mt-6">
                  <button
                    className="bg-brand-600 text-white px-6 py-3 rounded font-bold hover:bg-brand-700 disabled:opacity-50 flex-1"
                    onClick={() => {
                      if (activeJob.status === 'APPROVED') {
                        generateReport();
                      } else {
                        updateJobInSupabase({ ...activeJob, status: 'APPROVED' });
                        generateReport();
                      }
                    }}
                  >
                    {activeJob.status === 'APPROVED' ? 'Download CSV Report' : 'Approve & Generate Report'}
                  </button>
                  {activeJob.status === 'SUBMITTED' && (
                    <button
                      onClick={() => {
                        if (!activeJob.reviewerComments || activeJob.reviewerComments.trim() === '') {
                          alert('Please provide feedback before rejecting.');
                          return;
                        }
                        updateJobInSupabase({ ...activeJob, status: 'REJECTED' });
                      }}
                      className="border border-red-300 text-red-600 px-6 py-3 rounded font-bold hover:bg-red-50 flex-1"
                    >
                      Reject / Request Changes
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-slate-500 italic">No reports pending review. (Status: {activeJob.status})</div>
            )}
          </div>
        ) : null;
      default:
        return <div>Select a role</div>;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Header / Role Switcher for Demo */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-brand-700">
            <SearchCheck size={28} />
            <div className="flex items-baseline gap-2">
              <h1 className="text-xl font-bold tracking-tight">FabricVerify</h1>
              <span className="text-[10px] font-medium bg-brand-100 text-brand-800 px-2 py-0.5 rounded-full">v1.0.2</span>
              <GitHubSync />
            </div>
          </div>

          <div className="hidden md:flex gap-1 bg-slate-100 p-1 rounded-lg">
            {[
              { r: Role.CLIENT, icon: Users, label: 'Client' },
              { r: Role.CS, icon: LayoutDashboard, label: 'CS Admin' },
              { r: Role.INSPECTOR, icon: ClipboardCheck, label: 'Inspector' },
              { r: Role.REVIEWER, icon: SearchCheck, label: 'Reviewer' }
            ].map((item) => (
              <button
                key={item.r}
                onClick={() => setCurrentRole(item.r)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors
                   ${currentRole === item.r ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
              >
                <item.icon size={16} /> {item.label}
              </button>
            ))}
          </div>
        </div>
        {/* Mobile Nav */}
        <div className="md:hidden flex overflow-x-auto gap-2 p-2 bg-slate-100 no-scrollbar">
          {[Role.CLIENT, Role.CS, Role.INSPECTOR, Role.REVIEWER].map(r => (
            <button
              key={r}
              onClick={() => setCurrentRole(r)}
              className={`whitespace-nowrap px-3 py-1 text-xs font-bold rounded-full ${currentRole === r ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 border'}`}
            >
              {r}
            </button>
          ))}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-xl mx-auto w-full p-4 md:p-6">
        {renderContent()}
      </main>
    </div>
  );
};

export default App;