import React from 'react';
import { Camera, ScanLine } from 'lucide-react';
import { InspectionJob } from '../../types';
import toast from 'react-hot-toast';

interface EnvironmentStepProps {
    job: InspectionJob;
    onUpdateJob: (job: InspectionJob) => void;
    runLightingAnalysis: () => Promise<void>;
    onNext: () => void;
}

export const EnvironmentStep: React.FC<EnvironmentStepProps> = ({ job, onUpdateJob, runLightingAnalysis, onNext }) => {

    const handleFileUpload = async (
        e: React.ChangeEvent<HTMLInputElement>,
        field: 'gate' | 'workshop' | 'machine' | 'lighting'
    ) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = async () => {
                let result = reader.result as string;

                // Compress large images
                if (field === 'machine') {
                    try {
                        const { compressImage } = await import('../../utils/image');
                        result = await compressImage(result);
                    } catch (err) {
                        console.error('Image compression failed', err);
                        toast.error('Image compression failed, using original.');
                    }
                }

                onUpdateJob({
                    ...job,
                    environmentPhotos: { ...job.environmentPhotos, [field]: result }
                });
            };
            reader.readAsDataURL(file);
        }
    };

    return (
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
                onClick={onNext}
                className="w-full py-3 bg-green-600 text-white rounded-lg font-bold text-lg hover:bg-green-500 shadow-md mt-4"
            >
                Next Step
            </button>
        </div>
    );
};
