import React, { useState, useMemo, useEffect } from 'react';
import { Camera, FileText, Upload, Plus, Trash2, ChevronRight, Save, Download, Printer, CheckSquare, Square, ScanLine, BadgeCheck, ClipboardCheck } from 'lucide-react';
import { InspectionJob, RollData, DEFECT_TYPES, Defect, FabricGroup, FabricType } from '../types';
import { parsePackingList, parseWeight, analyzeLighting } from '../services/geminiService';
import { calculateRollStats as calcRollStats, suggestPointsFromLength, getThresholdByGroup, getFabricGroupMapping, getBowSkewTolerance } from '../utils/scoring';

interface InspectorViewProps {
  job: InspectionJob;
  onUpdateJob: (job: InspectionJob) => void;
}

const InspectorView: React.FC<InspectorViewProps> = ({ job, onUpdateJob }) => {
  const [step, setStep] = useState<number>(1);
  const [loadingOCR, setLoadingOCR] = useState(false);
  const [selectedRollId, setSelectedRollId] = useState<string | null>(null);

  // Track defect usage for sorting
  const [defectCounts, setDefectCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    // Initialize defect counts from existing jobs if needed
    const counts: Record<string, number> = {};
    job.rolls.forEach(r => r.defects.forEach(d => {
      counts[d.name] = (counts[d.name] || 0) + 1;
    }));
    setDefectCounts(counts);
  }, []);

  const incrementDefectCount = (name: string) => {
    setDefectCounts(prev => ({ ...prev, [name]: (prev[name] || 0) + 1 }));
  };

  // Helper to handle file uploads
  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: 'gate' | 'workshop' | 'machine' | 'packingList'
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        let result = reader.result as string;

        // 如果是装箱单或大图，进行前端压缩
        if (field === 'packingList' || field === 'machine') {
          const { compressImage } = await import('../utils/image');
          result = await compressImage(result);
        }

        if (field === 'packingList') {
          onUpdateJob({ ...job, packingListPhotos: [...(job.packingListPhotos || []), result] });
        } else {
          onUpdateJob({
            ...job,
            environmentPhotos: { ...job.environmentPhotos, [field]: result }
          });
        }
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
        alert('未能从图片中识别到任何卷布信息。请确认图片清晰，或尝试重新拍照后多选上传。');
      } else {
        // 如果已经有卷了，询问是追加还是替换
        let finalRolls = newRolls as RollData[];
        if (job.rolls.length > 0) {
          const confirmAdd = window.confirm(`识别到 ${newRolls.length} 卷。是将这些新卷【追加】到现有列表吗？\n\n点击"确定"追加，点击"取消"替换整个列表。`);
          if (confirmAdd) {
            finalRolls = [...job.rolls, ...finalRolls];
          }
        }
        onUpdateJob({ ...job, rolls: finalRolls, samplingMethod: job.samplingMethod || 'TEN_PERCENT' });
      }
    } catch (err: any) {
      console.error('OCR Error:', err);
      // 提取更友好的错误提示
      let errorMsg = String(err);
      if (errorMsg.includes('429') || errorMsg.includes('quota')) {
        errorMsg = "API 请求频率过快（429），请稍等 1 分钟后再试。";
      } else if (errorMsg.includes('socket') || errorMsg.includes('timeout')) {
        errorMsg = "网络连接超时，请检查您的网络环境。";
      }
      alert(`扫描失败：${errorMsg}`);
    } finally {
      setLoadingOCR(false);
    }
  };

  const runLightingAnalysis = async () => {
    if (!job.environmentPhotos.lighting) return;
    const res = await analyzeLighting(job.environmentPhotos.lighting);
    onUpdateJob({ ...job, lightingLux: res.lux });
    alert(`Lighting Analysis: ${res.lux} Lux\nStatus: ${res.status}\n${res.message}`);
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

  // --- Logic for 4 Point System (using shared scoring utility) ---
  const calculateRollStats = (roll: RollData) => calcRollStats(roll, job.passThreshold || 20);

  const exportReport = () => {
    const headers = [
      "Roll No", "Dye Lot", "Length (m)", "Width (inch)", "Weight",
      "1 Point Defects", "2 Point Defects", "3 Point Defects", "4 Point Defects",
      "Total Points", "Score (Pts/100sq.yd)", "Result", "Comments"
    ];

    const selectedRolls = job.rolls.filter(r => r.isSelected);

    const rows = selectedRolls.map(r => {
      const stats = calculateRollStats(r);
      return [
        r.rollNo,
        r.dyeLot,
        r.actualLength || r.length,
        r.cuttableWidth || r.width,
        r.actualWeight || r.weight,
        stats.points1,
        stats.points2,
        stats.points3,
        stats.points4,
        stats.totalPoints,
        stats.score.toFixed(1),
        stats.isPass ? 'PASS' : 'FAIL',
        `"${r.comments.replace(/"/g, '""')}"`
      ].join(",");
    });

    const metaInfo = [
      '',
      `Sampling Method,${job.samplingMethod || 'N/A'}`,
      `Pass Threshold,${job.passThreshold}`,
      ...(job.reviewerComments ? [`Reviewer Comments,"${job.reviewerComments.replace(/"/g, '""')}"`] : [])
    ];
    const csvContent = [headers.join(","), ...rows, ...metaInfo].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Fabric_Inspection_Report_${job.bookingId}.csv`;
    a.click();
  };

  const renderEnvironmentStep = () => (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-slate-800">1. Environment Photos</h2>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {['gate', 'workshop', 'machine', 'lighting'].map((type) => (
          <div key={type} className="border-2 border-dashed border-slate-300 rounded-lg p-4 flex flex-col items-center justify-center bg-white relative group">
            <span className="capitalize font-semibold mb-2">{type}</span>
            {job.environmentPhotos[type as keyof typeof job.environmentPhotos] ? (
              <div className="relative w-full">
                <img
                  src={job.environmentPhotos[type as keyof typeof job.environmentPhotos]}
                  alt={type}
                  className="h-32 w-full object-cover rounded mb-2"
                />
                {type === 'lighting' && (
                  <button
                    onClick={(e) => { e.preventDefault(); runLightingAnalysis(); }}
                    className="absolute top-2 right-2 bg-brand-600 text-white p-1 rounded-full shadow-lg hover:bg-brand-700"
                    title="Run AI Light Detection"
                  >
                    <ScanLine size={16} />
                  </button>
                )}
              </div>
            ) : (
              <div className="h-32 w-full bg-slate-100 rounded mb-2 flex items-center justify-center text-slate-400">
                <Camera size={32} />
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              id={`file-${type}`}
              onChange={(e) => handleFileUpload(e, type as any)}
            />
            <div className="flex flex-col w-full gap-2">
              <label
                htmlFor={`file-${type}`}
                className="px-4 py-2 bg-brand-600 text-white rounded text-sm cursor-pointer hover:bg-brand-500 w-full text-center"
              >
                {job.environmentPhotos[type as keyof typeof job.environmentPhotos] ? 'Retake Photo' : 'Upload Photo'}
              </label>
              {type === 'lighting' && job.lightingLux !== undefined && (
                <div className={`text-[10px] font-bold text-center px-1 py-0.5 rounded ${job.lightingLux >= 1000 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                  Detected: {job.lightingLux} Lux
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      <button
        onClick={() => setStep(2)}
        className="w-full py-3 bg-brand-600 text-white rounded-lg font-bold text-lg hover:bg-brand-500 shadow-md mt-4"
      >
        Next Step
      </button>
    </div>
  );

  const renderPackingListStep = () => {
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
              {[FabricType.WOVEN, FabricType.KNITTED].map(type => (
                <button
                  key={type}
                  onClick={() => onUpdateJob({ ...job, fabricType: type })}
                  className={`flex-1 py-2 rounded text-xs font-bold border transition-all ${job.fabricType === type ? 'bg-brand-600 text-white border-brand-700 shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                >
                  {type === FabricType.WOVEN ? 'WOVEN (ITS-IP-7401)' : 'KNITTED (ITS-IP-7402)'}
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
                    placeholder="Total Shipment Yards"
                    className="p-1 border rounded text-xs w-32"
                    onChange={(e) => onUpdateJob({ ...job, totalShipmentQuantity: Number(e.target.value) })}
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
                capture="environment"
                id="camera-upload"
                className="hidden"
                onChange={(e) => handleFileUpload(e, 'packingList')}
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
                className="hidden"
                onChange={(e) => handleFileUpload(e, 'packingList')}
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
              onClick={() => {
                const newRoll: RollData = {
                  id: Math.random().toString(36).substr(2, 9),
                  rollNo: `R-${job.rolls.length + 1}`,
                  dyeLot: '',
                  length: 0,
                  weight: 0,
                  width: 58,
                  defects: [],
                  comments: '',
                  status: 'PENDING',
                  isSelected: true
                };
                onUpdateJob({ ...job, rolls: [newRoll, ...job.rolls] }); // Add to top
              }}
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
                    onClick={() => roll.isSelected && setSelectedRollId(roll.id)}
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
          onClick={() => setStep(3)}
          className="w-full py-3 bg-brand-600 text-white rounded-lg font-bold text-lg hover:bg-brand-500 shadow-md mt-4"
        >
          View Summary & Finish
        </button>
      </div>
    );
  };

  const renderInspectionForm = () => {
    const roll = job.rolls.find(r => r.id === selectedRollId);
    if (!roll) return null;
    const stats = calculateRollStats(roll);

    return (
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 overflow-y-auto pt-4 pb-20 md:pt-10 transition-all">
        <div className="max-w-xl mx-auto bg-slate-50 min-h-full md:min-h-[90vh] md:rounded-t-3xl shadow-2xl relative overflow-hidden flex flex-col">
          {/* Header */}
          <div className="bg-white px-4 py-4 sticky top-0 z-10 flex items-center justify-between border-b border-slate-200">
            <button
              onClick={() => setSelectedRollId(null)}
              className="text-slate-500 font-medium px-2 hover:bg-slate-50 py-1 rounded"
            >
              Cancel
            </button>
            <div className="flex flex-col items-center flex-1">
              <h2 className="font-extrabold text-lg text-slate-800 leading-none">Roll #{roll.rollNo}</h2>
              <span className="text-[10px] text-slate-400 font-bold mt-1">Lot: {roll.dyeLot}</span>
            </div>
            <button
              onClick={() => {
                handleRollUpdate({ ...roll, status: 'INSPECTED' });
                setSelectedRollId(null);
              }}
              className="text-brand-600 font-bold px-2 hover:bg-slate-50 py-1 rounded"
            >
              Done
            </button>
          </div>

          <div className="p-4 space-y-6 flex-1 pb-24 h-full overflow-y-auto">
            {/* Quick Stats Banner */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 text-white p-6 rounded-2xl shadow-xl flex justify-between items-center relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10 blur-2xl"></div>
              <div className="flex flex-col relative z-10">
                <span className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">Penalty Points</span>
                <span className="text-4xl font-black">{stats.totalPoints}</span>
              </div>
              <div className="flex flex-col text-right relative z-10">
                <span className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1 font-sans">Points/100y²</span>
                <div className="flex items-center justify-end gap-3">
                  <span className={`text-4xl font-black ${stats.isPass ? 'text-green-400' : 'text-red-400'}`}>
                    {stats.score.toFixed(1)}
                  </span>
                  <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${stats.isPass ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                    {stats.isPass ? 'PASS' : 'FAIL'}
                  </div>
                </div>
              </div>
            </div>

            {/* Roll Specifications Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BadgeCheck size={16} className="text-brand-600" />
                  <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider">Specifications</span>
                </div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Ref: {roll.dyeLot}</span>
              </div>
              <div className="p-4 grid grid-cols-2 gap-x-4 gap-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="roll-no-input" className="text-[10px] text-slate-400 uppercase font-black px-1">Roll Number</label>
                  <input
                    id="roll-no-input"
                    type="text"
                    value={roll.rollNo}
                    onChange={(e) => handleRollUpdate({ ...roll, rollNo: e.target.value })}
                    className="w-full bg-slate-50 border-none rounded-xl px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-brand-500 transition-all placeholder:text-slate-300"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="dye-lot-input" className="text-[10px] text-slate-400 uppercase font-black px-1">Dye Lot</label>
                  <input
                    id="dye-lot-input"
                    type="text"
                    value={roll.dyeLot}
                    onChange={(e) => handleRollUpdate({ ...roll, dyeLot: e.target.value })}
                    className="w-full bg-slate-50 border-none rounded-xl px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-brand-500 transition-all placeholder:text-slate-300"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="original-length-input" className="text-[10px] text-slate-400 uppercase font-black px-1">Original Length (m)</label>
                  <input
                    id="original-length-input"
                    type="number"
                    step="0.1"
                    value={roll.actualLength || roll.length}
                    onChange={(e) => handleRollUpdate({ ...roll, actualLength: Number(e.target.value) })}
                    className="w-full bg-slate-50 border-none rounded-xl px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-brand-500 transition-all text-brand-600 font-sans"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="cuttable-width-input" className="text-[10px] text-slate-400 uppercase font-black px-1">Cuttable Width (in)</label>
                  <input
                    id="cuttable-width-input"
                    type="number"
                    step="0.01"
                    value={roll.cuttableWidth || roll.width}
                    onChange={(e) => handleRollUpdate({ ...roll, cuttableWidth: Number(e.target.value) })}
                    className="w-full bg-slate-50 border-none rounded-xl px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-brand-500 transition-all font-sans"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="overall-width-input" className="text-[10px] text-slate-400 uppercase font-black px-1">Overall Width (in)</label>
                  <input
                    id="overall-width-input"
                    type="number"
                    step="0.01"
                    value={roll.overallWidth || ''}
                    onChange={(e) => handleRollUpdate({ ...roll, overallWidth: Number(e.target.value) })}
                    className="w-full bg-slate-50 border-none rounded-xl px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-brand-500 transition-all font-sans"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="bow-skew-input" className="text-[10px] text-slate-400 uppercase font-black px-1">Bow/Skew (%)</label>
                  <input
                    id="bow-skew-input"
                    type="number"
                    step="0.1"
                    value={roll.bowSkew || ''}
                    onChange={(e) => handleRollUpdate({ ...roll, bowSkew: Number(e.target.value) })}
                    placeholder={`Max: ${getBowSkewTolerance(job.fabricType, false)} Solid / ${getBowSkewTolerance(job.fabricType, true)} Print`}
                    className="w-full bg-slate-50 border-none rounded-xl px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-brand-500 transition-all font-sans"
                  />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <label htmlFor="actual-weight-input" className="text-[10px] text-slate-400 uppercase font-black px-1 flex justify-between items-center">
                    Weight (gsm/oz)
                    <span className="text-brand-600 flex items-center gap-1 cursor-pointer" onClick={() => document.getElementById('weight-cam')?.click()}>
                      <ScanLine size={12} /> Scan
                    </span>
                  </label>
                  <div className="relative group">
                    <input
                      id="actual-weight-input"
                      type="number"
                      step="0.1"
                      value={roll.actualWeight || roll.weight}
                      onChange={(e) => handleRollUpdate({ ...roll, actualWeight: Number(e.target.value) })}
                      className="w-full bg-slate-50 border-none rounded-xl px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-brand-500 transition-all font-sans"
                    />
                    <input
                      id="weight-cam"
                      aria-label="Fabric weight camera"
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = async () => {
                            const res = await parseWeight(reader.result as string);
                            if (res) handleRollUpdate({ ...roll, actualWeight: res });
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Defects Log Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <h3 className="font-extrabold text-slate-800 flex items-center gap-2">
                  <div className="w-1.5 h-6 bg-red-500 rounded-full"></div>
                  Inspection Journal
                </h3>
                <div className="flex flex-col items-end">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{roll.defects.length} Incidents</span>
                  {roll.defects.length > 0 && <span className="text-[9px] text-red-400 font-bold uppercase tracking-widest mt-0.5">Points Audit Active</span>}
                </div>
              </div>

              <div className="space-y-3">
                {roll.defects.length === 0 ? (
                  <div className="text-center py-10 bg-white rounded-3xl border-2 border-dashed border-slate-200 shadow-inner">
                    <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                      <ClipboardCheck className="text-slate-300" size={24} />
                    </div>
                    <p className="text-slate-400 text-sm font-medium">Ready for inspection entry.</p>
                  </div>
                ) : (
                  roll.defects.map((defect, idx) => (
                    <div key={idx} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center group active:scale-[0.98] transition-all">
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          {defect.imageUrl ? (
                            <img src={defect.imageUrl} alt="Defect" className="w-16 h-16 rounded-xl object-cover border-2 border-slate-50 shadow-sm" />
                          ) : (
                            <div className="w-16 h-16 bg-slate-100 rounded-xl flex items-center justify-center text-slate-300">
                              <Camera size={24} />
                            </div>
                          )}
                          <div className={`absolute -top-2 -left-2 w-7 h-7 rounded-full border-4 border-white flex items-center justify-center text-[10px] font-black shadow-md ${defect.points >= 3 ? 'bg-red-500 text-white' : 'bg-yellow-400 text-yellow-900'}`}>
                            {defect.points}
                          </div>
                        </div>
                        <div>
                          <div className="font-black text-slate-800 text-sm mb-0.5">{defect.name}</div>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            <span className="text-[9px] bg-slate-100 text-slate-500 px-2.5 py-1 rounded-full font-black uppercase tracking-widest">
                              {defect.points} POINT{defect.points > 1 ? 'S' : ''}
                            </span>
                            {defect.isContinuous && <span className="text-[9px] bg-indigo-50 text-indigo-500 px-2.5 py-1 rounded-full font-black uppercase tracking-widest">Continuous</span>}
                            {defect.isHole && <span className="text-[9px] bg-red-50 text-red-500 px-2.5 py-1 rounded-full font-black uppercase tracking-widest border border-red-100">Hole</span>}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          const newDefects = roll.defects.filter((_, i) => i !== idx);
                          handleRollUpdate({ ...roll, defects: newDefects });
                        }}
                        title="Delete this defect log"
                        className="text-slate-300 hover:text-red-500 hover:bg-red-50 p-3 rounded-2xl transition-all"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Interactive Add Defect Section */}
            <div className="bg-white p-6 rounded-[2rem] shadow-2xl shadow-slate-200/60 border border-slate-200 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                <Plus size={80} />
              </div>
              <h3 className="font-black text-slate-800 mb-6 text-xs uppercase tracking-[0.2em] flex items-center gap-2">
                <div className="w-2 h-2 bg-brand-600 rounded-full"></div>
                Log Incident
              </h3>
              <DefectInput
                defectCounts={defectCounts}
                onAdd={(d) => {
                  handleRollUpdate({ ...roll, defects: [...roll.defects, d] });
                  incrementDefectCount(d.name);
                }}
              />
            </div>

            {/* Remarks Section */}
            <div className="space-y-3 pb-4 px-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                Inspector Observations
              </label>
              <textarea
                value={roll.comments}
                onChange={(e) => handleRollUpdate({ ...roll, comments: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded-2xl p-4 text-sm font-semibold focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 transition-all outline-none min-h-[120px] shadow-sm placeholder:text-slate-300"
                placeholder="Detail any surface irregularities, handle/feel issues or color shading across the roll..."
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderSummaryStep = () => {
    // Only show selected rolls
    const selectedRolls = job.rolls.filter(r => r.isSelected);

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800">Summary ({selectedRolls.length} Rolls)</h2>
          <button
            onClick={exportReport}
            className="text-sm bg-brand-50 text-brand-700 px-3 py-2 rounded font-bold border border-brand-100 flex items-center gap-2"
          >
            <Download size={16} /> CSV
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="bg-slate-100 text-slate-700 uppercase font-bold text-[10px]">
                <tr>
                  <th className="p-2">Roll</th>
                  <th className="p-2">Lot</th>
                  <th className="p-2">Len</th>
                  <th className="p-2">Wgt</th>
                  <th className="p-2 text-center bg-yellow-50">1</th>
                  <th className="p-2 text-center bg-yellow-50">2</th>
                  <th className="p-2 text-center bg-yellow-50">3</th>
                  <th className="p-2 text-center bg-yellow-50">4</th>
                  <th className="p-2 text-right">Tot</th>
                  <th className="p-2 text-right">Score</th>
                  <th className="p-2 text-center">Res</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {selectedRolls.map(r => {
                  const stats = calculateRollStats(r);
                  return (
                    <tr key={r.id} className="hover:bg-slate-50 text-xs">
                      <td className="p-2 font-medium">{r.rollNo}</td>
                      <td className="p-2">{r.dyeLot}</td>
                      <td className="p-2">{r.actualLength || r.length}</td>
                      <td className="p-2">{r.actualWeight || r.weight}</td>
                      <td className="p-2 text-center text-slate-500 bg-yellow-50/30">{stats.points1 || '-'}</td>
                      <td className="p-2 text-center text-slate-500 bg-yellow-50/30">{stats.points2 || '-'}</td>
                      <td className="p-2 text-center text-slate-500 bg-yellow-50/30">{stats.points3 || '-'}</td>
                      <td className="p-2 text-center text-slate-500 bg-yellow-50/30">{stats.points4 || '-'}</td>
                      <td className="p-2 text-right font-semibold">{stats.totalPoints}</td>
                      <td className="p-2 text-right">{stats.score.toFixed(1)}</td>
                      <td className="p-2 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${stats.isPass ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {stats.isPass ? 'PASS' : 'FAIL'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            onClick={() => setStep(2)}
            className="flex-1 py-3 border border-slate-300 text-slate-700 rounded-lg font-bold"
          >
            Back
          </button>
          <button
            onClick={() => {
              onUpdateJob({ ...job, status: 'SUBMITTED' });
              alert("Report Submitted for Review!");
            }}
            className="flex-1 py-3 bg-green-600 text-white rounded-lg font-bold shadow hover:bg-green-500 flex items-center justify-center gap-2"
          >
            Submit
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="pb-20">
      {/* Reviewer Feedback Alert */}
      {job.status === 'REJECTED' && job.reviewerComments && (
        <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg shadow-sm">
          <div className="flex items-center gap-2 text-red-700 font-bold mb-1">
            <BadgeCheck size={18} /> Reviewer Rejection Feedback
          </div>
          <p className="text-red-600 text-sm whitespace-pre-wrap">{job.reviewerComments}</p>
        </div>
      )}

      {selectedRollId && renderInspectionForm()}
      {!selectedRollId && (
        <>
          {step === 1 && renderEnvironmentStep()}
          {step === 2 && renderPackingListStep()}
          {step === 3 && renderSummaryStep()}
        </>
      )}
    </div>
  );
};

const DefectInput: React.FC<{ onAdd: (d: Defect) => void, defectCounts: Record<string, number> }> = ({ onAdd, defectCounts }) => {
  const [category, setCategory] = useState<'WARP' | 'WEFT'>('WARP');
  const [type, setType] = useState<string>('');
  const [points, setPoints] = useState<1 | 2 | 3 | 4>(1);
  const [isContinuous, setIsContinuous] = useState(false);
  const [isHole, setIsHole] = useState(false);
  const [photo, setPhoto] = useState<string | undefined>(undefined);
  const [defectLength, setDefectLength] = useState<number | undefined>(undefined);

  // Sort defect types by usage count
  const sortedTypes = useMemo(() => {
    return [...DEFECT_TYPES[category]].sort((a, b) => {
      const countA = defectCounts[a] || 0;
      const countB = defectCounts[b] || 0;
      if (countA === countB) return a.localeCompare(b);
      return countB - countA;
    });
  }, [category, defectCounts]);

  useEffect(() => {
    if (sortedTypes.length > 0) setType(sortedTypes[0]);
  }, [sortedTypes]);

  useEffect(() => {
    if (isContinuous || isHole) {
      setPoints(4);
    } else if (defectLength !== undefined && defectLength > 0) {
      setPoints(suggestPointsFromLength(defectLength));
    }
  }, [defectLength, isContinuous, isHole]);

  const handleAdd = () => {
    onAdd({
      id: Math.random().toString(),
      name: type,
      points: (isHole || isContinuous) ? 4 : points,
      defectLength,
      imageUrl: photo,
      isContinuous,
      isHole
    });
    setPhoto(undefined);
    setDefectLength(undefined);
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button
          onClick={() => setCategory('WARP')}
          className={`flex-1 py-1.5 rounded text-xs font-medium transition-colors ${category === 'WARP' ? 'bg-slate-800 text-white' : 'bg-slate-200 hover:bg-slate-300'}`}
        >
          Warp
        </button>
        <button
          onClick={() => setCategory('WEFT')}
          className={`flex-1 py-1.5 rounded text-xs font-medium transition-colors ${category === 'WEFT' ? 'bg-slate-800 text-white' : 'bg-slate-200 hover:bg-slate-300'}`}
        >
          Weft
        </button>
      </div>

      <select
        value={type}
        onChange={(e) => setType(e.target.value)}
        className="w-full p-2 border rounded bg-slate-50 text-sm"
        aria-label="Select defect type"
      >
        {sortedTypes.map(t => <option key={t} value={t}>{t}</option>)}
      </select>

      <div className="flex gap-4 items-center px-1">
        <label className="flex items-center gap-2 cursor-pointer group">
          <input
            type="checkbox"
            checked={isContinuous}
            onChange={(e) => setIsContinuous(e.target.checked)}
            className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500"
          />
          <span className="text-xs font-medium text-slate-700 group-hover:text-brand-600">Continuous (4 pts)</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer group">
          <input
            type="checkbox"
            checked={isHole}
            onChange={(e) => setIsHole(e.target.checked)}
            className="w-4 h-4 rounded text-red-600 focus:ring-red-500"
          />
          <span className="text-xs font-medium text-red-600 group-hover:text-red-700">Hole (4 pts)</span>
        </label>
      </div>

      <div>
        <label htmlFor="defect-length-input" className="text-[10px] text-slate-500 uppercase font-bold">Defect Length (inches)</label>
        <input
          id="defect-length-input"
          type="number"
          step="0.1"
          value={defectLength || ''}
          onChange={(e) => setDefectLength(e.target.value ? Number(e.target.value) : undefined)}
          placeholder="Auto-suggests points: ≤3→1, ≤6→2, ≤9→3, >9→4"
          className="w-full p-1.5 text-sm border rounded bg-slate-50 font-medium mt-1"
        />
      </div>

      <div className="flex gap-2">
        {[1, 2, 3, 4].map((p) => (
          <button
            key={p}
            disabled={isHole || isContinuous}
            onClick={() => setPoints(p as any)}
            className={`flex-1 py-2 rounded border text-center font-bold text-sm transition-all
              ${((isHole || isContinuous) ? p === 4 : points === p) ? 'bg-red-500 text-white border-red-600 shadow-inner' : 'bg-white text-slate-700 hover:bg-slate-50'}
              ${(isHole || isContinuous) && p !== 4 ? 'opacity-30' : ''}`}
          >
            {p}
          </button>
        ))}
      </div>

      {photo && (
        <div className="relative w-20 h-20">
          <img src={photo} alt="Defect detail" className="w-full h-full object-cover rounded border" />
          <button onClick={() => setPhoto(undefined)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1" aria-label="Remove defect photo"><Trash2 size={12} /></button>
        </div>
      )}

      <div className="flex gap-2 mt-2">
        <button
          onClick={handleAdd}
          className="flex-1 py-3 bg-slate-900 text-white rounded font-medium flex items-center justify-center gap-2 hover:bg-slate-800 shadow"
        >
          <Plus size={16} /> Add Defect
        </button>

        <div className="relative">
          <input
            id="defect-cam"
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                const reader = new FileReader();
                reader.onloadend = () => {
                  onAdd({
                    id: Math.random().toString(),
                    name: type,
                    points: (isHole || isContinuous) ? 4 : points,
                    defectLength,
                    imageUrl: reader.result as string,
                    isContinuous,
                    isHole
                  });
                };
                reader.readAsDataURL(file);
              }
            }}
          />
          <label htmlFor="defect-cam" className="w-12 h-full bg-slate-200 text-slate-700 rounded flex items-center justify-center cursor-pointer hover:bg-slate-300 border border-slate-300">
            <Camera size={20} />
          </label>
        </div>
      </div>
    </div>
  );
};

export default InspectorView;