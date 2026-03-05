import React from 'react';
import { calculateRollStats } from '../utils/scoring';
import { InspectionJob } from '../types';
import { dataService } from '../services/dataService';
import toast from 'react-hot-toast';
import { useAppStore } from '../store/useAppStore';

const ReviewerView: React.FC = () => {
    const { activeJob, updateJob, setActiveJob } = useAppStore();

    const updateJobInSupabase = async (updatedJob: InspectionJob) => {
        updateJob(updatedJob);
        try {
            await dataService.updateJobMetadata(updatedJob.id, updatedJob);
        } catch (error) {
            console.error('Error updating job in Supabase:', error);
            toast.error('Failed to update job');
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

    if (!activeJob) {
        return (
            <div className="max-w-4xl mx-auto bg-white p-8 rounded shadow text-center">
                <h2 className="text-xl font-bold text-slate-800 mb-2">No Active Job</h2>
                <p className="text-slate-500">There are currently no inspection jobs ready for review.</p>
            </div>
        );
    }

    return (
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
                                    toast.success('Report Approved!');
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
                                        toast.error('Please provide feedback before rejecting.');
                                        return;
                                    }
                                    updateJobInSupabase({ ...activeJob, status: 'REJECTED' });
                                    toast.success('Report Rejected');
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
    );
};

export default ReviewerView;
