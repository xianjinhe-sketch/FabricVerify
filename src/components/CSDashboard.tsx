import React, { useState, useEffect } from 'react';
import { Inspector, Booking, ClientStandard } from '../types';
import { Users, Calendar, Mail, Phone, Wrench, BadgeCheck, Briefcase, Loader2, ShieldCheck, X } from 'lucide-react';
import { supabase } from '../services/supabase';
import { dataService } from '../services/dataService';

const CSDashboard: React.FC = () => {
  const [view, setView] = useState<'SCHEDULE' | 'INSPECTORS'>('SCHEDULE');
  const [loading, setLoading] = useState(true);
  const [selectedClientStandards, setSelectedClientStandards] = useState<{name: string, standards: ClientStandard[]} | null>(null);
  const [loadingStandards, setLoadingStandards] = useState(false);

  // Real Data from Supabase
  const [inspectors, setInspectors] = useState<Inspector[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: inspectorsData, error: inspectorsError } = await supabase
        .from('inspectors')
        .select('*');
      
      if (inspectorsError) throw inspectorsError;
      setInspectors(inspectorsData || []);

      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (bookingsError) throw bookingsError;
      
      // Map DB fields to component types if necessary
      const mappedBookings = (bookingsData || []).map(b => ({
        id: b.id,
        clientName: b.client_name,
        fabricInfo: b.fabric_info,
        fabricType: b.fabric_type,
        inspectionDate: b.inspection_date,
        shipmentDate: b.shipment_date,
        orderQuantity: b.order_quantity,
        factoryName: b.factory_name,
        factoryAddress: b.factory_address,
        contactPerson: b.contact_person,
        contactPhone: b.contact_phone,
        contactEmail: b.contact_email,
        productImages: b.product_images,
        actualInspectionDate: b.actual_inspection_date,
        reportNumber: b.report_number,
        requirements: b.requirements,
        status: b.status,
        assignedInspectorId: b.assigned_inspector_id
      }));
      setBookings(mappedBookings);
    } catch (error) {
      console.error('Error fetching data:', error);
      alert('Failed to load data from Supabase');
    } finally {
      setLoading(false);
    }
  };

  const [newInspector, setNewInspector] = useState<{name: string, phone: string, email: string, skills: string, equipment: string}>({ 
    name: '', phone: '', email: '', skills: '', equipment: '' 
  });

  const addInspector = async () => {
    if (newInspector.name) {
      const skillsArray = newInspector.skills.split(',').map(s => s.trim()).filter(s => s !== '');
      const equipmentArray = newInspector.equipment.split(',').map(s => s.trim()).filter(s => s !== '');

      try {
        const { data, error } = await supabase
          .from('inspectors')
          .insert([{
            name: newInspector.name,
            phone: newInspector.phone,
            email: newInspector.email,
            skills: skillsArray,
            equipment: equipmentArray
          }])
          .select();

        if (error) throw error;
        
        if (data) {
          setInspectors([...inspectors, data[0]]);
          setNewInspector({ name: '', phone: '', email: '', skills: '', equipment: '' });
        }
      } catch (error) {
        console.error('Error adding inspector:', error);
        alert('Failed to add inspector');
      }
    }
  };

  const updateBookingDetails = async (bookingId: string, field: string, value: any) => {
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ [field]: value })
        .eq('id', bookingId);

      if (error) throw error;

      setBookings(bookings.map(b => 
        b.id === bookingId ? { ...b, [field === 'actual_inspection_date' ? 'actualInspectionDate' : 'reportNumber']: value } : b
      ));
    } catch (error) {
      console.error('Error updating booking details:', error);
      alert('Failed to update booking details');
    }
  };

  const assignInspector = async (bookingId: string, inspectorId: string) => {
    try {
      // 1. Update booking assignment
      const { error: bookingError } = await supabase
        .from('bookings')
        .update({ 
          assigned_inspector_id: inspectorId || null,
          status: inspectorId ? 'CONFIRMED' : 'PENDING'
        })
        .eq('id', bookingId);

      if (bookingError) throw bookingError;

      // 2. If assigning an inspector, ensure an inspection job exists
      if (inspectorId) {
        const { data: existingJob } = await supabase
          .from('inspection_jobs')
          .select('id')
          .eq('booking_id', bookingId)
          .maybeSingle();

        if (!existingJob) {
          const booking = bookings.find(b => b.id === bookingId);
          const { error: jobError } = await supabase
            .from('inspection_jobs')
            .insert([{
              booking_id: bookingId,
              status: 'DRAFT',
              fabric_type: booking?.fabricType || 'WOVEN',
              pass_threshold: 20
            }]);
          
          if (jobError) {
            console.error('Error creating inspection job:', jobError);
          }
        }
      }
      
      setBookings(bookings.map(b => 
        b.id === bookingId 
          ? { ...b, assignedInspectorId: inspectorId, status: inspectorId ? 'CONFIRMED' : 'PENDING' } 
          : b
      ));
      
      if (inspectorId) {
        alert('Inspector assigned and job created successfully!');
      }
    } catch (error) {
      console.error('Error assigning inspector:', error);
      alert('Failed to assign inspector');
    }
  };

  const viewStandards = async (clientName: string) => {
    setLoadingStandards(true);
    try {
      const standards = await dataService.fetchClientStandards(clientName);
      setSelectedClientStandards({ name: clientName, standards });
    } catch (error) {
      console.error('Error fetching standards:', error);
      alert('Failed to load client standards');
    } finally {
      setLoadingStandards(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-brand-600" size={32} />
        <span className="ml-2 text-slate-500">Loading Dashboard...</span>
      </div>
    );
  }

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
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-700 border-b">
              <tr>
                <th className="p-4">Client</th>
                <th className="p-4">Req. Date</th>
                <th className="p-4">Actual Date</th>
                <th className="p-4">Report #</th>
                <th className="p-4">Fabric</th>
                <th className="p-4">Status</th>
                <th className="p-4">Standards</th>
                <th className="p-4">Assign To</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bookings.map(b => (
                <tr key={b.id}>
                  <td className="p-4">
                    <div className="font-medium truncate max-w-[120px]" title={b.clientName}>{b.clientName}</div>
                    <div className="text-[10px] text-slate-400 uppercase truncate max-w-[120px]" title={b.factoryName}>{b.factoryName}</div>
                  </td>
                  <td className="p-4">{b.inspectionDate}</td>
                  <td className="p-4">
                    <input 
                      type="date" 
                      className="border rounded p-1 text-xs bg-white"
                      value={b.actualInspectionDate || ''}
                      onChange={(e) => updateBookingDetails(b.id, 'actual_inspection_date', e.target.value)}
                    />
                  </td>
                  <td className="p-4">
                    <input 
                      type="text" 
                      placeholder="Report #"
                      className="border rounded p-1 text-xs bg-white w-24"
                      value={b.reportNumber || ''}
                      onChange={(e) => updateBookingDetails(b.id, 'report_number', e.target.value)}
                    />
                  </td>
                  <td className="p-4 text-slate-500">
                    <div className="truncate max-w-[100px]" title={b.fabricInfo}>{b.fabricInfo}</div>
                  </td>
                  <td className="p-4">
                     <span className={`px-2 py-1 rounded text-xs font-bold ${b.status === 'CONFIRMED' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                       {b.status}
                     </span>
                  </td>
                  <td className="p-4">
                    <button 
                      onClick={() => viewStandards(b.clientName)}
                      className="text-brand-600 hover:text-brand-700 font-bold text-xs flex items-center gap-1"
                    >
                      <ShieldCheck size={14} /> View
                    </button>
                  </td>
                  <td className="p-4">
                    <select 
                      className="border rounded p-1 text-sm bg-white"
                      value={b.assignedInspectorId || ''}
                      onChange={(e) => assignInspector(b.id, e.target.value)}
                    >
                      <option value="">Select Inspector</option>
                      {inspectors.map(i => (
                        <option key={i.id} value={i.id}>
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
      {/* Standards Modal */}
      {selectedClientStandards && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10">
              <div>
                <h2 className="text-xl font-bold text-slate-800">{selectedClientStandards.name}</h2>
                <p className="text-sm text-slate-500">Inspection Standards Protocol</p>
              </div>
              <button 
                onClick={() => setSelectedClientStandards(null)}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X size={24} className="text-slate-400" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              {selectedClientStandards.standards.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  No specific standards configured for this client.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {selectedClientStandards.standards.map(s => (
                    <div key={s.id} className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <h3 className="font-bold text-brand-700 border-b border-brand-100 pb-2 mb-4">
                        {s.fabricType} Standards
                      </h3>
                      <div className="space-y-3">
                        <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Sampling</label>
                          <div className="text-sm font-bold text-slate-700">{s.samplingStandard || 'N/A'}</div>
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Weight Tolerance</label>
                          <div className="text-sm font-bold text-slate-700">{s.weightTolerance || 'N/A'}</div>
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Width Tolerance</label>
                          <div className="text-sm font-bold text-slate-700">{s.widthTolerance || 'N/A'}</div>
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Color Tolerance</label>
                          <div className="text-sm font-bold text-slate-700">{s.colorTolerance || 'N/A'}</div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Qty Tol.</label>
                            <div className="text-sm font-bold text-slate-700">{s.quantityTolerance || 'N/A'}</div>
                          </div>
                          <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Length Tol.</label>
                            <div className="text-sm font-bold text-slate-700">{s.lengthTolerance || 'N/A'}</div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Bow/Skew Solid</label>
                            <div className="text-sm font-bold text-slate-700">{s.bowSkewSolid || 'N/A'}</div>
                          </div>
                          <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Bow/Skew Print</label>
                            <div className="text-sm font-bold text-slate-700">{s.bowSkewPrint || 'N/A'}</div>
                          </div>
                        </div>
                        {s.otherStandards && (
                          <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Other</label>
                            <div className="text-sm font-bold text-slate-700">{s.otherStandards}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button 
                onClick={() => setSelectedClientStandards(null)}
                className="px-6 py-2 bg-slate-800 text-white rounded-lg font-bold hover:bg-slate-700 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CSDashboard;