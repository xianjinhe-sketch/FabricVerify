import React, { useState, useEffect } from 'react';
import { Download } from 'lucide-react';
import { InspectionJob, ClientStandard, RollData } from '../types';
import { dataService } from '../services/dataService';
import { analyzeLighting } from '../services/geminiService';
import { exportExcelReport } from '../utils/exportExcel';
import { calculateRollStats } from '../utils/scoring';
import toast from 'react-hot-toast';

import { EnvironmentStep } from './Inspector/EnvironmentStep';
import { PackingListStep } from './Inspector/PackingListStep';
import { RollInspectionForm } from './Inspector/RollInspectionForm';

interface InspectorViewProps {
  job: InspectionJob;
  onUpdateJob: (updatedJob: InspectionJob) => void;
}

const InspectorView: React.FC<InspectorViewProps> = ({ job, onUpdateJob }) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [inspectingRollId, setInspectingRollId] = useState<string | null>(null);
  const [clientStandards, setClientStandards] = useState<ClientStandard | null>(null);

  useEffect(() => {
    const loadStandards = async () => {
      try {
        const standards = await dataService.fetchClientStandards(job.clientName || 'Default Client');
        const match = standards.find((s: ClientStandard) => s.fabricType === job.fabricType);
        setClientStandards(match || null);
      } catch (err) {
        console.error("Failed to load standards", err);
      }
    };
    if (job.clientName && job.fabricType) {
      loadStandards();
    }
  }, [job.clientName, job.fabricType]);

  const runLightingAnalysis = async () => {
    if (!job.environmentPhotos.lighting) return;
    const loadingToast = toast.loading('Analyzing lighting conditions...');
    try {
      const result: any = await analyzeLighting(job.environmentPhotos.lighting);
      onUpdateJob({ ...job, lightingLux: result.lux });
      toast.success(`Lighting detected: ${result.lux} Lux`, { id: loadingToast });
    } catch (err) {
      console.error('Lighting Analysis Error:', err);
      toast.error('Failed to analyze lighting. Please try again or take a clearer photo.', { id: loadingToast });
    }
  };

  const handleAddRoll = () => {
    const newRollCount = job.rolls.filter(r => r.id.startsWith(`MANUAL-`)).length + 1;
    const newRoll: Omit<RollData, 'id'> = {
      rollNo: `MANUAL-${newRollCount}`,
      dyeLot: 'N/A',
      length: 0,
      width: 0,
      weight: 0,
      defects: [],
      comments: '',
      status: 'PENDING',
      isSelected: true
    };
    onUpdateJob({ ...job, rolls: [{ ...newRoll, id: crypto.randomUUID() }, ...job.rolls] });
    toast.success('Manual roll added');
  };

  const renderSummaryStep = () => {
    const selectedRolls = job.rolls.filter(r => r.isSelected);
    const inspectedRolls = selectedRolls.filter(r => r.status === 'INSPECTED');
    const isComplete = selectedRolls.length > 0 && selectedRolls.length === inspectedRolls.length;

    let passedRolls = 0;
    let totalPoints = 0;

    inspectedRolls.forEach(r => {
      const stats = calculateRollStats(r, job.passThreshold);
      if (stats.isPass) passedRolls++;
      totalPoints += stats.totalPoints;
    });

    return (
      <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
        <h2 className="text-xl font-bold text-slate-800">3. Inspection Summary</h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 text-center">
            <div className="text-3xl font-black text-brand-600 mb-1">{selectedRolls.length}</div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Rolls Selected</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 text-center">
            <div className="text-3xl font-black text-blue-600 mb-1">{inspectedRolls.length}</div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Rolls Inspected</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 text-center">
            <div className="text-3xl font-black text-green-600 mb-1">{passedRolls}</div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Rolls Passed</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 text-center">
            <div className="text-3xl font-black text-orange-600 mb-1">{totalPoints}</div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Total Points</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200">
          <label className="block text-sm font-bold text-slate-700 mb-2">Overall Comments (Optional)</label>
          <textarea
            className="w-full p-3 border rounded-lg h-32 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            placeholder="Add any final notes, general observations about the fabric, packaging issues, etc..."
            value={job.inspectorComments || ''}
            onChange={(e) => onUpdateJob({ ...job, inspectorComments: e.target.value })}
          />
        </div>

        <div className="flex gap-4">
          <button
            onClick={() => setStep(2)}
            className="px-6 py-3 bg-white border border-slate-300 text-slate-700 rounded-lg font-bold hover:bg-slate-50"
          >
            Back
          </button>

          <div className="flex-1 flex gap-2">
            <button
              onClick={() => {
                if (!isComplete) {
                  toast((t) => (
                    <div className="flex flex-col gap-3">
                      <p className="font-semibold text-sm">There are still {selectedRolls.length - inspectedRolls.length} uninspected rolls. Are you sure you want to submit the report early?</p>
                      <div className="flex gap-2">
                        <button onClick={() => {
                          toast.dismiss(t.id);
                          onUpdateJob({ ...job, status: 'SUBMITTED' });
                          toast.success('Report submitted successfully to Reviewer!');
                        }} className="bg-brand-600 text-white px-3 py-1.5 rounded text-sm font-bold">Yes, Submit</button>
                        <button onClick={() => toast.dismiss(t.id)} className="bg-slate-200 text-slate-800 px-3 py-1.5 rounded text-sm font-bold">Cancel</button>
                      </div>
                    </div>
                  ), { duration: Infinity });
                  return;
                }
                onUpdateJob({ ...job, status: 'SUBMITTED' });
                toast.success('Report submitted successfully to Reviewer!');
              }}
              className="flex-1 py-3 bg-brand-600 text-white rounded-lg font-bold hover:bg-brand-700 shadow-md transition-colors"
            >
              Submit Report
            </button>
            <button
              onClick={() => {
                try {
                  exportExcelReport(job);
                  toast.success('Excel report downloaded');
                } catch (err) {
                  console.error("Excel generation error", err);
                  toast.error('Failed to generate Excel report');
                }
              }}
              className="px-4 py-3 bg-slate-800 text-white rounded-lg font-bold hover:bg-slate-700 transition-colors flex items-center justify-center"
              title="Export as Excel"
            >
              <Download size={20} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (inspectingRollId) {
    return (
      <RollInspectionForm
        job={job}
        rollId={inspectingRollId}
        onUpdateJob={onUpdateJob}
        onBack={() => setInspectingRollId(null)}
      />
    );
  }

  return (
    <>
      <div className="bg-white p-4 rounded-xl shadow-sm mb-6 flex justify-between items-center border border-slate-200">
        <div className="flex gap-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              onClick={() => setStep(s as 1 | 2 | 3)}
              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold cursor-pointer transition-colors ${step === s ? 'bg-brand-600 text-white shadow-md' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
            >
              {s}
            </div>
          ))}
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Current Step</div>
          <div className="font-bold text-brand-800">
            {step === 1 ? 'Environment' : step === 2 ? 'Rolls List' : 'Summary'}
          </div>
        </div>
      </div>

      {step === 1 && (
        <EnvironmentStep
          job={job}
          onUpdateJob={onUpdateJob}
          runLightingAnalysis={runLightingAnalysis}
          onNext={() => setStep(2)}
        />
      )}

      {step === 2 && (
        <PackingListStep
          job={job}
          onUpdateJob={onUpdateJob}
          clientStandards={clientStandards}
          onSelectRoll={(id) => setInspectingRollId(id)}
          onAddRoll={handleAddRoll}
          onNext={() => setStep(3)}
        />
      )}

      {step === 3 && renderSummaryStep()}
    </>
  );
};

export default InspectorView;