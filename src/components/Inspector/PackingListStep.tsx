import React, { useState } from 'react';
import { Camera, FileText, Upload, Plus, Square, CheckSquare, ChevronRight, BadgeCheck, ShieldCheck } from 'lucide-react';
import { InspectionJob, RollData, FabricType, FabricGroup, ClientStandard } from '../../types';
import { parsePackingList } from '../../services/geminiService';
import { getThresholdByGroup, getFabricGroupMapping, calculateRollStats as calcRollStats } from '../../utils/scoring';
import toast from 'react-hot-toast';

interface PackingListStepProps {
    job: InspectionJob;
    onUpdateJob: (job: InspectionJob) => void;
    clientStandards: ClientStandard | null;
    onSelectRoll: (rollId: string) => void;
    onAddRoll: () => void;
    onNext: () => void;
}

export const PackingListStep: React.FC<PackingListStepProps> = ({
    job,
    onUpdateJob,
    clientStandards,
    onSelectRoll,
    onAddRoll,
    onNext
}) => {
    const [loadingOCR, setLoadingOCR] = useState(false);

    // Helper to handle file uploads
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

                onUpdateJob({ ...job, packingListPhotos: [...(job.packingListPhotos || []), result] });
            };
            reader.readAsDataURL(file);
        }
    };

    const runOCR = async () => {
        if (!job.packingListPhotos || job.packingListPhotos.length === 0) return;
        setLoadingOCR(true);
        try {
            const newRolls = await parsePackingList(job.packingListPhotos);
            if (!newRolls || newRolls.length === 0) {
                toast.error('未能从图片中识别到任何卷布信息。请确认图片清晰，或尝试重新拍照后多选上传。', { duration: 5000 });
            } else {
                if (job.rolls.length > 0) {
                    toast((t) => (
                        <div className="flex flex-col gap-3">
                            <p className="font-semibold text-sm text-slate-800">识别到 {newRolls.length} 卷。是将这些新卷【追加】到现有列表还是【替换】现有列表？</p>
                            <div className="flex gap-2">
                                <button onClick={() => {
                                    toast.dismiss(t.id);
                                    onUpdateJob({ ...job, rolls: [...job.rolls, ...(newRolls as RollData[])], samplingMethod: job.samplingMethod || 'TEN_PERCENT' });
                                    toast.success(`Successfully appended ${newRolls.length} rolls.`);
                                }} className="bg-brand-600 text-white px-3 py-1.5 rounded text-sm font-bold">追加 (Append)</button>
                                <button onClick={() => {
                                    toast.dismiss(t.id);
                                    onUpdateJob({ ...job, rolls: newRolls as RollData[], samplingMethod: job.samplingMethod || 'TEN_PERCENT' });
                                    toast.success(`Successfully replaced with ${newRolls.length} rolls.`);
                                }} className="bg-slate-800 text-white px-3 py-1.5 rounded text-sm font-bold">替换 (Replace)</button>
                                <button onClick={() => toast.dismiss(t.id)} className="bg-slate-200 text-slate-800 px-3 py-1.5 rounded text-sm font-bold">取消</button>
                            </div>
                        </div>
                    ), { duration: Infinity });
                } else {
                    onUpdateJob({ ...job, rolls: newRolls as RollData[], samplingMethod: job.samplingMethod || 'TEN_PERCENT' });
                    toast.success(`Successfully parsed ${newRolls.length} rolls.`);
                }
            }
        } catch (err: any) {
            console.error('OCR Error:', err);
            let errorMsg = err.message || String(err);
            if (errorMsg.includes('socket') || errorMsg.includes('timeout')) {
                errorMsg = "网络连接超时，请检查您的网络环境。";
            }
            toast.error(`扫描失败：\n\n${errorMsg}`, { duration: 6000 });
        } finally {
            setLoadingOCR(false);
        }
    };

    const handleRollUpdate = (updatedRoll: RollData) => {
        const newRolls = job.rolls.map(r => r.id === updatedRoll.id ? updatedRoll : r);
        onUpdateJob({ ...job, rolls: newRolls });
    };

    const toggleRollSelection = (rollId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const roll = job.rolls.find(r => r.id === rollId);
        if (roll) {
            handleRollUpdate({ ...roll, isSelected: !roll.isSelected });
        }
    };

    const calculateRollStats = (roll: RollData) => calcRollStats(roll, job.passThreshold || 20);

    // Sort rolls: Selected first, then by ID or original order
    const sortedRolls = [...job.rolls].sort((a, b) => {
        if (a.isSelected === b.isSelected) return 0;
        return a.isSelected ? -1 : 1;
    });

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold text-slate-800">2. Packing List & Rolls</h2>

            {/* Fabric Type & Group Selection */}
            <div className="bg-white border border-slate-200 p-4 rounded-lg shadow-sm space-y-4">
                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Fabric Type (Inspection Protocol)</label>
                    <div className="flex gap-2">
                        {[FabricType.WOVEN, FabricType.KNITTED, FabricType.OTHER].map(type => (
                            <button
                                key={type}
                                onClick={() => onUpdateJob({ ...job, fabricType: type })}
                                className={`flex-1 py-2 rounded text-xs font-bold border transition-all ${job.fabricType === type ? 'bg-brand-600 text-white border-brand-700 shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                            >
                                {type === FabricType.WOVEN ? 'WOVEN (ITS-IP-7401)' : type === FabricType.KNITTED ? 'KNITTED (ITS-IP-7402)' : 'OTHER'}
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <label htmlFor="fabric-group-select" className="block text-sm font-bold text-slate-700 mb-1">Fabric Group</label>
                    <select
                        id="fabric-group-select"
                        value={job.fabricGroup || ''}
                        onChange={(e) => {
                            const group = e.target.value as FabricGroup;
                            onUpdateJob({ ...job, fabricGroup: group, passThreshold: getThresholdByGroup(group) });
                        }}
                        className="w-full p-2 border rounded-lg bg-slate-50 text-sm"
                    >
                        <option value="">Select Group...</option>
                        {Object.entries(getFabricGroupMapping(job.fabricType)).map(([group, description]) => (
                            <option key={group} value={group}>{group}: {description}</option>
                        ))}
                    </select>
                </div>

                <div className="flex justify-between items-center text-xs pt-2 border-t border-slate-100">
                    <span className="text-slate-500">Threshold: <b>{job.passThreshold} pts / 100 sq.yd</b></span>
                    {job.fabricGroup && <span className="text-brand-600 font-bold flex items-center gap-1"><BadgeCheck size={12} /> Intertek Standard Applied</span>}
                </div>

                {clientStandards && (
                    <div className="mt-4 p-3 bg-brand-50 rounded-lg border border-brand-100">
                        <h4 className="text-xs font-bold text-brand-800 mb-2 flex items-center gap-1">
                            <ShieldCheck size={14} /> Client Specific Standards ({job.clientName})
                        </h4>
                        <div className="grid grid-cols-2 gap-2 text-[10px]">
                            <div className="bg-white p-1.5 rounded border border-brand-100">
                                <span className="text-slate-400 block uppercase">Sampling</span>
                                <span className="font-bold text-slate-700">{clientStandards.samplingStandard || 'N/A'}</span>
                            </div>
                            <div className="bg-white p-1.5 rounded border border-brand-100">
                                <span className="text-slate-400 block uppercase">Weight Tol.</span>
                                <span className="font-bold text-slate-700">{clientStandards.weightTolerance || 'N/A'}</span>
                            </div>
                            <div className="bg-white p-1.5 rounded border border-brand-100">
                                <span className="text-slate-400 block uppercase">Width Tol.</span>
                                <span className="font-bold text-slate-700">{clientStandards.widthTolerance || 'N/A'}</span>
                            </div>
                            <div className="bg-white p-1.5 rounded border border-brand-100">
                                <span className="text-slate-400 block uppercase">Color Tol.</span>
                                <span className="font-bold text-slate-700">{clientStandards.colorTolerance || 'N/A'}</span>
                            </div>
                            <div className="bg-white p-1.5 rounded border border-brand-100">
                                <span className="text-slate-400 block uppercase">Qty Tol.</span>
                                <span className="font-bold text-slate-700">{clientStandards.quantityTolerance || 'N/A'}</span>
                            </div>
                            <div className="bg-white p-1.5 rounded border border-brand-100">
                                <span className="text-slate-400 block uppercase">Length Tol.</span>
                                <span className="font-bold text-slate-700">{clientStandards.lengthTolerance || 'N/A'}</span>
                            </div>
                            <div className="bg-white p-1.5 rounded border border-brand-100">
                                <span className="text-slate-400 block uppercase">Bow/Skew Solid</span>
                                <span className="font-bold text-slate-700">{clientStandards.bowSkewSolid || 'N/A'}</span>
                            </div>
                            <div className="bg-white p-1.5 rounded border border-brand-100">
                                <span className="text-slate-400 block uppercase">Bow/Skew Print</span>
                                <span className="font-bold text-slate-700">{clientStandards.bowSkewPrint || 'N/A'}</span>
                            </div>
                            <div className="bg-white p-1.5 rounded border border-brand-100">
                                <span className="text-slate-400 block uppercase">Max Pts/Roll</span>
                                <span className="font-bold text-slate-700">{clientStandards.maxAcceptablePointPerRoll || '28'}</span>
                            </div>
                            <div className="bg-white p-1.5 rounded border border-brand-100">
                                <span className="text-slate-400 block uppercase">Max Pts/Shipment</span>
                                <span className="font-bold text-slate-700">{clientStandards.maxShipmentPointCount || '20'}</span>
                            </div>
                            {clientStandards.otherStandards && (
                                <div className="bg-white p-1.5 rounded border border-brand-100 col-span-2">
                                    <span className="text-slate-400 block uppercase">Other</span>
                                    <span className="font-bold text-slate-700">{clientStandards.otherStandards}</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Sampling Suggestion */}
            {job.rolls.length > 0 && (
                <div className="bg-white border border-slate-200 p-4 rounded-lg shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <p className="text-slate-800 font-bold text-sm">Sampling Strategy (Protocol 1.4)</p>
                            <div className="flex items-center gap-2 mt-1">
                                <input
                                    id="shipment-yards-input"
                                    type="number"
                                    min="0"
                                    placeholder="Total Shipment Yards"
                                    aria-label="Total Shipment Yards"
                                    className="p-1 border rounded text-xs w-32"
                                    onChange={(e) => onUpdateJob({ ...job, totalShipmentQuantity: Math.max(0, Number(e.target.value)) })}
                                />
                                <label htmlFor="shipment-yards-input" className="text-[10px] text-slate-400">Shipment Yards</label>
                            </div>
                        </div>
                        <div className="flex bg-slate-100 p-1 rounded-lg">
                            {[
                                { id: 'TEN_PERCENT', label: '10%' },
                                { id: 'SQRT_TEN', label: 'Intertek' },
                                { id: 'MANUAL', label: 'Other' }
                            ].map(method => (
                                <button
                                    key={method.id}
                                    onClick={() => onUpdateJob({ ...job, samplingMethod: method.id as any })}
                                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${job.samplingMethod === method.id ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    {method.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {job.samplingMethod !== 'MANUAL' && (
                        <div className="flex items-center justify-between bg-brand-50 p-3 rounded-md border border-brand-100">
                            <div className="text-xs text-brand-700">
                                {job.samplingMethod === 'TEN_PERCENT' ? (
                                    <>Recommended sample: <b>{Math.max(1, Math.ceil(job.rolls.length * 0.1))}</b> rolls (10% of total)</>
                                ) : (
                                    <>
                                        {job.totalShipmentQuantity && job.totalShipmentQuantity < 1000 ? (
                                            <>Shipment &lt; 1000 yds: <b>100% Inspection</b> required</>
                                        ) : (
                                            <>Protocol Sample: <b>{Math.max(1, Math.min(job.rolls.length, Math.ceil(Math.sqrt(job.rolls.length) * 10)))}</b> rolls (√n * 10)</>
                                        )}
                                    </>
                                )}
                            </div>
                            <button
                                onClick={() => {
                                    let count = 0;
                                    if (job.samplingMethod === 'TEN_PERCENT') {
                                        count = Math.max(1, Math.ceil(job.rolls.length * 0.1));
                                    } else {
                                        if (job.totalShipmentQuantity && job.totalShipmentQuantity < 1000) {
                                            count = job.rolls.length;
                                        } else {
                                            count = Math.max(1, Math.min(job.rolls.length, Math.ceil(Math.sqrt(job.rolls.length) * 10)));
                                        }
                                    }
                                    const newRolls = job.rolls.map((r, i) => ({ ...r, isSelected: i < count }));
                                    onUpdateJob({ ...job, rolls: newRolls });
                                    toast.success(`Applied sampling to ${count} rolls.`);
                                }}
                                className="px-4 py-1.5 bg-brand-600 text-white text-xs font-bold rounded hover:bg-brand-700"
                            >
                                Apply
                            </button>
                        </div>
                    )}
                </div>
            )}

            <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
                <h3 className="font-semibold mb-2">Upload Packing List</h3>

                <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="relative">
                        <input
                            type="file"
                            accept="image/*"
                            id="camera-upload"
                            aria-label="Upload packing list via camera"
                            className="hidden"
                            onChange={handleFileUpload}
                        />
                        <label htmlFor="camera-upload" className="flex items-center justify-center gap-2 py-3 bg-slate-800 text-white rounded cursor-pointer hover:bg-slate-700 font-bold">
                            <Camera size={18} /> Camera
                        </label>
                    </div>
                    <div className="relative">
                        <input
                            type="file"
                            accept="image/*"
                            id="file-upload"
                            aria-label="Upload packing list via file"
                            className="hidden"
                            onChange={handleFileUpload}
                        />
                        <label htmlFor="file-upload" className="flex items-center justify-center gap-2 py-3 bg-white border border-slate-300 text-slate-700 rounded cursor-pointer hover:bg-slate-50 font-bold">
                            <Upload size={18} /> File
                        </label>
                    </div>
                </div>

                {job.packingListPhotos && job.packingListPhotos.length > 0 && (
                    <div className="mt-4">
                        <div className="flex gap-2 overflow-x-auto pb-2">
                            {job.packingListPhotos.map((photo, idx) => (
                                <div key={idx} className="relative flex-shrink-0">
                                    <img src={photo} alt={`Packing List ${idx + 1}`} className="h-32 w-auto object-contain rounded border bg-slate-100" />
                                    <button
                                        onClick={() => {
                                            const newPhotos = job.packingListPhotos!.filter((_, i) => i !== idx);
                                            onUpdateJob({ ...job, packingListPhotos: newPhotos });
                                        }}
                                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                                    >×</button>
                                </div>
                            ))}
                        </div>
                        <button
                            onClick={runOCR}
                            disabled={loadingOCR}
                            className="mt-3 w-full py-2 bg-indigo-600 text-white rounded flex items-center justify-center gap-2 font-bold"
                        >
                            {loadingOCR ? 'Scanning...' : <><FileText size={18} /> Analyze List ({job.packingListPhotos.length} photo{job.packingListPhotos.length > 1 ? 's' : ''})</>}
                        </button>
                    </div>
                )}
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <div>
                        <h3 className="font-semibold">Identified Rolls ({job.rolls.length})</h3>
                        <p className="text-xs text-slate-500">Check box to select for inspection.</p>
                    </div>
                    <button
                        onClick={onAddRoll}
                        className="text-sm bg-brand-600 text-white px-3 py-1.5 rounded font-bold flex items-center gap-1 shadow-sm"
                    >
                        <Plus size={14} /> Add
                    </button>
                </div>
                <div className="divide-y divide-slate-100">
                    {sortedRolls.map((roll) => {
                        const stats = calculateRollStats(roll);
                        // Styles based on status
                        let bgClass = "bg-white";
                        let textClass = "text-slate-900";
                        let statusIndicator = null;

                        if (!roll.isSelected) {
                            bgClass = "bg-slate-100";
                            textClass = "text-slate-400";
                        } else {
                            // Selected
                            bgClass = "bg-white"; // Pending state
                            if (roll.status === 'INSPECTED') {
                                if (stats.isPass) {
                                    bgClass = "bg-green-50";
                                    statusIndicator = <span className="text-xs font-bold text-green-700 bg-green-200 px-1 rounded">PASS</span>;
                                } else {
                                    bgClass = "bg-yellow-50";
                                    statusIndicator = <span className="text-xs font-bold text-yellow-700 bg-yellow-200 px-1 rounded">FAIL</span>;
                                }
                            } else {
                                // Pending
                                statusIndicator = <span className="text-xs font-bold text-slate-500 bg-slate-200 px-1 rounded">PENDING</span>;
                            }
                        }

                        return (
                            <div
                                key={roll.id}
                                className={`p-3 flex items-center gap-3 ${bgClass} transition-colors`}
                            >
                                <button onClick={(e) => toggleRollSelection(roll.id, e)} className="text-slate-500 hover:text-brand-600" aria-label={roll.isSelected ? "Deselect roll" : "Select roll"}>
                                    {roll.isSelected ? <CheckSquare className="text-brand-600" size={24} /> : <Square size={24} />}
                                </button>

                                <div
                                    onClick={() => roll.isSelected && onSelectRoll(roll.id)}
                                    className={`flex-1 flex justify-between items-center ${roll.isSelected ? 'cursor-pointer' : ''}`}
                                >
                                    <div>
                                        <div className={`font-medium ${textClass} flex items-center gap-2`}>
                                            {roll.rollNo} {statusIndicator}
                                        </div>
                                        <div className={`text-sm ${textClass} opacity-80`}>Lot: {roll.dyeLot} | {roll.length}m</div>
                                    </div>
                                    {roll.isSelected && <ChevronRight size={20} className="text-slate-400" />}
                                </div>
                            </div>
                        );
                    })}
                    {job.rolls.length === 0 && (
                        <div className="p-8 text-center text-slate-500">
                            No rolls found.
                        </div>
                    )}
                </div>
            </div>

            <button
                onClick={onNext}
                className="w-full py-3 bg-green-600 text-white rounded-lg font-bold text-lg hover:bg-green-500 shadow-md mt-4"
            >
                View Summary & Finish
            </button>
        </div>
    );
};
