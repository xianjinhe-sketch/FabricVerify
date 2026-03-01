import React, { useState } from 'react';
import { Inspector, Booking } from '../types';
import { Users, Calendar, Mail, Phone, Wrench, BadgeCheck, Briefcase } from 'lucide-react';

const CSDashboard: React.FC = () => {
  const [view, setView] = useState<'SCHEDULE' | 'INSPECTORS'>('SCHEDULE');

  // Mock Data
  const [inspectors, setInspectors] = useState<Inspector[]>([
    { id: '1', name: 'John Doe', phone: '123-456', email: 'john@test.com', skills: ['Knits', 'Wovens'], equipment: ['Tape', 'Camera'] },
    { id: '2', name: 'Jane Smith', phone: '987-654', email: 'jane@test.com', skills: ['Denim'], equipment: ['Laptop'] }
  ]);
  
  const [bookings] = useState<Booking[]>([
    { id: '1', clientName: 'Zara Inc', fabricInfo: 'Cotton Poplin', inspectionDate: '2023-11-30', requirements: '', status: 'PENDING' },
    { id: '2', clientName: 'H&M', fabricInfo: 'Viscose Rayon', inspectionDate: '2023-12-05', requirements: '', status: 'CONFIRMED', assignedInspectorId: '1' }
  ]);

  const [newInspector, setNewInspector] = useState<{name: string, phone: string, email: string, skills: string, equipment: string}>({ 
    name: '', phone: '', email: '', skills: '', equipment: '' 
  });

  const addInspector = () => {
    if (newInspector.name) {
      const skillsArray = newInspector.skills.split(',').map(s => s.trim()).filter(s => s !== '');
      const equipmentArray = newInspector.equipment.split(',').map(s => s.trim()).filter(s => s !== '');

      setInspectors([
        ...inspectors, 
        { 
          id: Math.random().toString(), 
          name: newInspector.name,
          phone: newInspector.phone,
          email: newInspector.email,
          skills: skillsArray,
          equipment: equipmentArray
        }
      ]);
      setNewInspector({ name: '', phone: '', email: '', skills: '', equipment: '' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-4 border-b border-slate-200 pb-2">
        <button 
          onClick={() => setView('SCHEDULE')}
          className={`font-semibold ${view === 'SCHEDULE' ? 'text-brand-600' : 'text-slate-500'}`}
        >
          Schedule & Bookings
        </button>
        <button 
           onClick={() => setView('INSPECTORS')}
           className={`font-semibold ${view === 'INSPECTORS' ? 'text-brand-600' : 'text-slate-500'}`}
        >
          Inspectors Team
        </button>
      </div>

      {view === 'SCHEDULE' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-700 border-b">
              <tr>
                <th className="p-4">Client</th>
                <th className="p-4">Date</th>
                <th className="p-4">Fabric</th>
                <th className="p-4">Status</th>
                <th className="p-4">Assign To</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bookings.map(b => (
                <tr key={b.id}>
                  <td className="p-4 font-medium">{b.clientName}</td>
                  <td className="p-4">{b.inspectionDate}</td>
                  <td className="p-4 text-slate-500">{b.fabricInfo}</td>
                  <td className="p-4">
                     <span className={`px-2 py-1 rounded text-xs font-bold ${b.status === 'CONFIRMED' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                       {b.status}
                     </span>
                  </td>
                  <td className="p-4">
                    <select className="border rounded p-1 text-sm bg-white">
                      <option value="">Select Inspector</option>
                      {inspectors.map(i => (
                        <option key={i.id} value={i.id} selected={b.assignedInspectorId === i.id}>
                          {i.name}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {view === 'INSPECTORS' && (
        <div className="space-y-6">
           {/* Add Inspector Form */}
           <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
             <h3 className="text-sm font-bold text-slate-700 mb-3 uppercase">Register New Inspector</h3>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
               <div>
                 <label className="text-xs font-bold text-slate-500">Name</label>
                 <input 
                   type="text" 
                   value={newInspector.name}
                   onChange={e => setNewInspector({...newInspector, name: e.target.value})}
                   className="w-full p-2 border rounded"
                   placeholder="Full Name"
                 />
               </div>
               <div>
                 <label className="text-xs font-bold text-slate-500">Email</label>
                 <input 
                   type="email" 
                   value={newInspector.email}
                   onChange={e => setNewInspector({...newInspector, email: e.target.value})}
                   className="w-full p-2 border rounded"
                   placeholder="email@example.com"
                 />
               </div>
               <div>
                 <label className="text-xs font-bold text-slate-500">Phone</label>
                 <input 
                   type="text" 
                   value={newInspector.phone}
                   onChange={e => setNewInspector({...newInspector, phone: e.target.value})}
                   className="w-full p-2 border rounded"
                   placeholder="+1 ..."
                 />
               </div>
               <div>
                 <label className="text-xs font-bold text-slate-500">Skills (comma separated)</label>
                 <input 
                   type="text" 
                   value={newInspector.skills}
                   onChange={e => setNewInspector({...newInspector, skills: e.target.value})}
                   className="w-full p-2 border rounded"
                   placeholder="e.g. Knits, Silk, Denim"
                 />
               </div>
               <div>
                 <label className="text-xs font-bold text-slate-500">Equipment (comma separated)</label>
                 <input 
                   type="text" 
                   value={newInspector.equipment}
                   onChange={e => setNewInspector({...newInspector, equipment: e.target.value})}
                   className="w-full p-2 border rounded"
                   placeholder="e.g. Laptop, Camera, Tape"
                 />
               </div>
               <div className="flex items-end">
                 <button 
                   onClick={addInspector}
                   className="w-full bg-brand-600 text-white px-6 py-2 rounded font-bold hover:bg-brand-700"
                 >
                   Add Member
                 </button>
               </div>
             </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             {inspectors.map(inspector => (
               <div key={inspector.id} className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 flex items-start gap-4">
                 <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold flex-shrink-0">
                   {inspector.name.charAt(0)}
                 </div>
                 <div className="flex-1 min-w-0">
                   <h3 className="font-bold text-lg text-slate-800 truncate">{inspector.name}</h3>
                   <div className="text-sm text-slate-500 flex items-center gap-2 mt-1 truncate">
                     <Mail size={14} /> {inspector.email}
                   </div>
                   <div className="text-sm text-slate-500 flex items-center gap-2 mt-1 truncate">
                     <Phone size={14} /> {inspector.phone}
                   </div>
                   
                   <div className="mt-3">
                      <div className="flex items-center gap-1 text-xs text-slate-400 mb-1">
                        <BadgeCheck size={12} /> Skills
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {inspector.skills.map((s, i) => (
                          <span key={i} className="text-xs bg-brand-50 text-brand-700 px-2 py-0.5 rounded border border-brand-100">{s}</span>
                        ))}
                      </div>
                   </div>

                   <div className="mt-2">
                      <div className="flex items-center gap-1 text-xs text-slate-400 mb-1">
                        <Briefcase size={12} /> Equipment
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {inspector.equipment.map((e, i) => (
                          <span key={i} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{e}</span>
                        ))}
                      </div>
                   </div>

                 </div>
               </div>
             ))}
           </div>
        </div>
      )}
    </div>
  );
};

export default CSDashboard;