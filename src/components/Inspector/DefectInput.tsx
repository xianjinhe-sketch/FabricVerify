import React from 'react';
import { Plus } from 'lucide-react';
import { Defect } from '../../types';

interface DefectInputProps {
    onAddDefect: (defect: Omit<Defect, 'id'>) => void;
}

export const DefectInput: React.FC<DefectInputProps> = ({ onAddDefect }) => {
    const defectTypes = [
        { category: 'Weaving', name: 'Hole / Torn', defaultPts: 4, icon: '🕳️' },
        { category: 'Weaving', name: 'Missing Yarn', defaultPts: 2, icon: '🧵' },
        { category: 'Dyeing', name: 'Color Spot', defaultPts: 2, icon: '🎨' },
        { category: 'Dyeing', name: 'Barre / Banding', defaultPts: 4, icon: '🦓' },
        { category: 'Finishing', name: 'Crease Mark', defaultPts: 3, icon: '〰️' },
        { category: 'Finishing', name: 'Stain / Dirt', defaultPts: 2, icon: '💩' },
        { category: 'Other', name: 'Slub', defaultPts: 1, icon: '🪢' },
        { category: 'Weaving', name: 'Broken End/Pick', defaultPts: 2, icon: '✂️' },
        { category: 'Functional', name: 'Water Repellent Failure', defaultPts: 4, icon: '💧' },
    ];

    const handleAdd = (type: typeof defectTypes[0]) => {
        // Generate UUID string using crypto
        const defectId = crypto.randomUUID();
        onAddDefect({
            name: type.name,
            points: type.defaultPts as 1 | 2 | 3 | 4,
            isContinuous: false,
            isHole: type.name.includes('Hole'),
        });
    };

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {defectTypes.map((type) => (
                <button
                    key={type.name}
                    onClick={() => handleAdd(type)}
                    className="bg-white border border-slate-200 hover:border-brand-500 hover:shadow-md transition-all p-3 rounded-xl flex flex-col items-center justify-center gap-2 group active:scale-95"
                >
                    <span className="text-2xl group-hover:scale-110 transition-transform">{type.icon}</span>
                    <span className="text-xs font-bold text-slate-700 text-center">{type.name}</span>
                    <div className="flex items-center gap-1 text-[10px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">
                        <Plus size={10} /> {type.defaultPts} pts
                    </div>
                </button>
            ))}
        </div>
    );
};
