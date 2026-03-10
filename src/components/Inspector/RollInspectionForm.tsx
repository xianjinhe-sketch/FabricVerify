import React from 'react';
import { Ruler, Scale, Plus, Minus, Trash2, ArrowLeft, Camera, ShieldAlert, CircleMinus } from 'lucide-react';
import { InspectionJob, RollData, Defect } from '../../types';
import { DefectInput } from './DefectInput';
import { calculateRollStats, suggestPointsFromLength } from '../../utils/scoring';
import toast from 'react-hot-toast';

interface RollInspectionFormProps {
    job: InspectionJob;
    rollId: string;
    onUpdateJob: (job: InspectionJob) => void;
    onBack: () => void;
}

export const RollInspectionForm: React.FC<RollInspectionFormProps> = ({ job, rollId, onUpdateJob, onBack }) => {
    const currentRoll = job.rolls.find(r => r.id === rollId);
    if (!currentRoll) return <div>Roll not found</div>;

    const updateRoll = (updates: Partial<RollData>) => {
        const newRolls = job.rolls.map(r => r.id === rollId ? { ...r, ...updates } : r);
        onUpdateJob({ ...job, rolls: newRolls });
    };

    const addDefect = (defectData: Omit<Defect, 'id'>) => {
        const newDefect: Defect = {
            ...defectData,
            id: crypto.randomUUID()
        };
        updateRoll({ defects: [...currentRoll.defects, newDefect] });
        toast.success(`Points added: ${defectData.points}`);
    };

    const removeDefect = (defectId: string) => {
        updateRoll({ defects: currentRoll.defects.filter(d => d.id !== defectId) });
    };

    const handleDefectImageUpload = (defectId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = async () => {
                let result = reader.result as string;
                try {
                    const { compressImage } = await import('../../utils/image');
                    result = await compressImage(result);
                } catch (err) {
                    console.error('Image compression failed', err);
                    toast.error('Image compression failed, using original.');
                }

                const newDefects = currentRoll.defects.map(d =>
                    d.id === defectId ? { ...d, imagePath: result } : d
                );
                updateRoll({ defects: newDefects });
            };
            reader.readAsDataURL(file);
        }
    };

    const stats = calculateRollStats(currentRoll, job.passThreshold);

    return (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <button onClick={onBack} title="Go back to list" aria-label="Go back to roll list" className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors">
                    <ArrowLeft size={24} />
                </button>
                <div className="flex-1">
                    <h2 className="text-xl font-black text-slate-800 tracking-tight">Inspecting Roll: {currentRoll.rollNo}</h2>
                    <p className="text-sm text-slate-500 font-medium tracking-wide">Lot {currentRoll.dyeLot}</p>
                </div>
                <div className="text-right">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Live Score</div>
                    <div className={`text-3xl font-black tracking-tighter ${stats.isPass ? 'text-green-500' : 'text-red-500'}`}>
                        {stats.score.toFixed(1)} <span className="text-sm font-bold text-slate-400">pts</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Verification Card */}
                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 space-y-4">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2 border-b pb-2">
                        <Ruler size={18} className="text-brand-500" /> Physical Measurements
                    </h3>

                    <div className="space-y-6">
                        {/* Length (m) */}
                        <div className="space-y-2">
                            <div className="flex justify-between items-end">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase">Length (m)</label>
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Ticket: {currentRoll.length}m</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="relative flex-1">
                                    <input
                                        type="number"
                                        step="0.1"
                                        id={`actual-length-${rollId}`}
                                        title="Actual Length"
                                        placeholder="Actual Length"
                                        value={currentRoll.actualLength ?? currentRoll.length}
                                        onChange={(e) => updateRoll({ actualLength: Number(e.target.value) })}
                                        className={`w-full px-3 py-2 bg-slate-50 border-0 rounded-lg font-mono text-lg focus:ring-2 focus:ring-brand-500 ${Math.abs((currentRoll.actualLength ?? currentRoll.length) - currentRoll.length) > 2 ? 'text-red-500 font-bold' : (currentRoll.actualLength ?? currentRoll.length) !== currentRoll.length ? 'text-orange-600 font-bold' : ''
                                            }`}
                                    />

                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">m</span>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <button
                                        onClick={() => updateRoll({ actualLength: Number(((currentRoll.actualLength ?? currentRoll.length) + 0.1).toFixed(1)) })}
                                        title="Increase Length"
                                        className="p-1 bg-slate-100 hover:bg-slate-200 rounded text-slate-600"
                                    >
                                        <Plus size={14} />
                                    </button>
                                    <button
                                        onClick={() => updateRoll({ actualLength: Number(((currentRoll.actualLength ?? currentRoll.length) - 0.1).toFixed(1)) })}
                                        title="Decrease Length"
                                        className="p-1 bg-slate-100 hover:bg-slate-200 rounded text-slate-600"
                                    >
                                        <Minus size={14} />
                                    </button>
                                </div>
                            </div>
                            <div className="flex justify-between items-center text-[10px] font-bold">
                                <span className="text-slate-400">DIFF:</span>
                                {(() => {
                                    const actual = currentRoll.actualLength ?? currentRoll.length;
                                    const ticket = currentRoll.length;
                                    const diff = actual - ticket;
                                    const percent = ((diff / ticket) * 100).toFixed(2);
                                    const isError = Math.abs(Number(percent)) > 2; // Example threshold
                                    return (
                                        <span className={isError ? 'text-red-500' : 'text-slate-500'}>
                                            {diff > 0 ? '+' : ''}{diff.toFixed(1)}m ({percent}%)
                                        </span>
                                    );
                                })()}
                            </div>
                        </div>

                        {/* Cuttable Width (in) */}
                        <div className="space-y-2">
                            <div className="flex justify-between items-end">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase">Cuttable Width (in)</label>
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Req: {currentRoll.width}"</span>
                            </div>
                            <div className="relative">
                                <input
                                    type="number"
                                    id={`cuttable-width-${rollId}`}
                                    title="Actual Cuttable Width"
                                    placeholder="Actual Cuttable Width"
                                    value={currentRoll.cuttableWidth ?? currentRoll.width}
                                    onChange={(e) => updateRoll({ cuttableWidth: Number(e.target.value) })}
                                    className={`w-full px-3 py-2 bg-slate-50 border-0 rounded-lg font-mono text-lg focus:ring-2 focus:ring-brand-500 ${(currentRoll.cuttableWidth ?? currentRoll.width) < currentRoll.width ? 'text-red-500 font-bold' : ''
                                        }`}
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">in</span>
                            </div>
                            <div className="flex justify-between items-center text-[10px] font-bold">
                                <span className="text-slate-400">DIFF:</span>
                                {(() => {
                                    const actual = currentRoll.cuttableWidth ?? currentRoll.width;
                                    const req = currentRoll.width;
                                    const diff = actual - req;
                                    const percent = ((diff / req) * 100).toFixed(2);
                                    const isError = actual < req;
                                    return (
                                        <span className={isError ? 'text-red-500' : 'text-slate-500'}>
                                            {diff > 0 ? '+' : ''}{diff.toFixed(1)}" ({percent}%)
                                        </span>
                                    );
                                })()}
                            </div>
                        </div>

                        {/* Full Width (in) */}
                        <div className="space-y-2">
                            <div className="flex justify-between items-end">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase">Full Width (in)</label>
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Req: {currentRoll.width}"</span>
                            </div>
                            <div className="relative">
                                <input
                                    type="number"
                                    id={`overall-width-${rollId}`}
                                    title="Actual Overall Width"
                                    placeholder="Actual Overall Width"
                                    value={currentRoll.overallWidth ?? currentRoll.width}
                                    onChange={(e) => updateRoll({ overallWidth: Number(e.target.value) })}
                                    className={`w-full px-3 py-2 bg-slate-50 border-0 rounded-lg font-mono text-lg focus:ring-2 focus:ring-brand-500 ${(currentRoll.overallWidth ?? currentRoll.width) < currentRoll.width ? 'text-red-500 font-bold' : ''
                                        }`}
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">in</span>
                            </div>
                            <div className="flex justify-between items-center text-[10px] font-bold">
                                <span className="text-slate-400">DIFF:</span>
                                {(() => {
                                    const actual = currentRoll.overallWidth ?? currentRoll.width;
                                    const req = currentRoll.width;
                                    const diff = actual - req;
                                    const percent = ((diff / req) * 100).toFixed(2);
                                    const isError = actual < req;
                                    return (
                                        <span className={isError ? 'text-red-500' : 'text-slate-500'}>
                                            {diff > 0 ? '+' : ''}{diff.toFixed(1)}" ({percent}%)
                                        </span>
                                    );
                                })()}
                            </div>
                        </div>

                        {/* Weight (gsm) */}
                        <div className="space-y-2">
                            <div className="flex justify-between items-end">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase">Weight (gsm)</label>
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Req: {currentRoll.weight}</span>
                            </div>
                            <div className="relative">
                                <input
                                    type="number"
                                    id={`actual-weight-${rollId}`}
                                    title="Actual Weight"
                                    placeholder="Actual Weight"
                                    value={currentRoll.actualWeight ?? currentRoll.weight}
                                    onChange={(e) => updateRoll({ actualWeight: Number(e.target.value) })}
                                    className={`w-full px-3 py-2 bg-slate-50 border-0 rounded-lg font-mono text-lg focus:ring-2 focus:ring-brand-500 ${Math.abs((currentRoll.actualWeight ?? currentRoll.weight) - currentRoll.weight) > currentRoll.weight * 0.05 ? 'text-red-500 font-bold' : ''
                                        }`}
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">gsm</span>
                            </div>
                            <div className="flex justify-between items-center text-[10px] font-bold">
                                <span className="text-slate-400">DIFF:</span>
                                {(() => {
                                    const actual = currentRoll.actualWeight ?? currentRoll.weight;
                                    const req = currentRoll.weight;
                                    const diff = actual - req;
                                    const percent = ((diff / req) * 100).toFixed(2);
                                    const isError = Math.abs(actual - req) > req * 0.05; // 5% tolerance example
                                    return (
                                        <span className={isError ? 'text-red-500' : 'text-slate-500'}>
                                            {diff > 0 ? '+' : ''}{diff.toFixed(1)} ({percent}%)
                                        </span>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Quality Card */}
                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2 border-b pb-2 mb-4">
                        <ShieldAlert size={18} className="text-orange-500" /> Defects Log ({stats.totalPoints} pts)
                    </h3>

                    <div className="space-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                        {currentRoll.defects.length === 0 ? (
                            <div className="text-center py-6 text-slate-400 font-medium">
                                No defects logged yet.
                            </div>
                        ) : (
                            currentRoll.defects.map(defect => (
                                <div key={defect.id} className="group flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100 hover:border-orange-200 transition-colors">
                                    <div className="flex-1">
                                        <div className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                            {defect.name}
                                            <span className="bg-orange-100 text-orange-700 text-[10px] px-1.5 py-0.5 rounded font-black">{defect.points}pt</span>
                                            {(defect.isHole || defect.isContinuous) && <span className="bg-red-100 text-red-700 text-[10px] px-1.5 py-0.5 rounded font-black">MAJOR</span>}
                                        </div>
                                        {defect.lengthInches && <div className="text-[10px] text-slate-500">Size: {defect.lengthInches}"</div>}
                                    </div>

                                    <div className="flex items-center gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                        <div className="relative">
                                            <input
                                                type="file"
                                                accept="image/*"
                                                id={`defect-img-${defect.id}`}
                                                className="hidden"
                                                title="Upload defect image"
                                                placeholder="Upload defect image"
                                                onChange={(e) => handleDefectImageUpload(defect.id, e)}
                                            />
                                            <label htmlFor={`defect-img-${defect.id}`} className={`p-1.5 rounded cursor-pointer ${defect.imagePath ? 'bg-brand-100 text-brand-600' : 'bg-white border text-slate-400 hover:text-brand-500'}`}>
                                                <Camera size={16} />
                                            </label>
                                        </div>
                                        <button onClick={() => removeDefect(defect.id)} title="Delete Defect" aria-label="Delete Defect" className="p-1.5 bg-red-50 text-red-500 rounded hover:bg-red-100 transition-colors">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Add Defect Section */}
            <div className="bg-slate-800 rounded-xl shadow-lg p-5 text-white">
                <h3 className="font-bold flex items-center gap-2 mb-4">
                    <CircleMinus size={18} className="text-brand-400" /> Log New Defect
                </h3>

                <DefectInput onAddDefect={addDefect} />

                <div className="mt-6 pt-4 border-t border-slate-700">
                    <p className="text-[10px] uppercase text-slate-400 font-bold mb-2">Or add by length (1-4 points)</p>
                    <div className="flex items-center gap-3">
                        <label htmlFor="custom-defect-name" className="sr-only">Custom Defect Name</label>
                        <input type="text" title="Custom Defect Name" placeholder="Custom Defect Name" id="custom-defect-name" className="flex-1 bg-slate-900 border-0 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-brand-500" />

                        <label htmlFor="custom-defect-length" className="sr-only">Defect Length (inches)</label>
                        <input type="number" title="Length (inches)" min="0" placeholder="Length (inches)" id="custom-defect-length" className="w-32 bg-slate-900 border-0 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-brand-500" />
                        <button
                            title="Add Custom Defect"
                            onClick={() => {
                                const name = (document.getElementById('custom-defect-name') as HTMLInputElement).value;
                                const length = Number((document.getElementById('custom-defect-length') as HTMLInputElement).value);
                                if (name && length > 0) {
                                    addDefect({ name, lengthInches: length, points: suggestPointsFromLength(length), isContinuous: false, isHole: false });
                                    (document.getElementById('custom-defect-name') as HTMLInputElement).value = '';
                                    (document.getElementById('custom-defect-length') as HTMLInputElement).value = '';
                                } else {
                                    toast.error("Please enter a name and length");
                                }
                            }}
                            className="bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded font-bold text-sm shadow flex items-center gap-1"
                        >
                            <Plus size={16} /> Add
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex gap-4">
                <button
                    onClick={() => {
                        updateRoll({ status: 'INSPECTED' });
                        onBack();
                        toast.success('Roll marked as inspected');
                    }}
                    className="flex-1 py-4 bg-green-500 text-white rounded-xl font-bold text-lg hover:bg-green-400 shadow-lg shadow-green-500/20 active:scale-[0.98] transition-all"
                >
                    Complete & Save Roll
                </button>
            </div>
        </div>
    );
};
