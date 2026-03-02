import React, { useState, useEffect } from 'react';
import { Booking, ClientProfile } from '../types';
import { Calendar, Package, ClipboardList, User, Loader2 } from 'lucide-react';
import { supabase } from '../services/supabase';

const ClientPortal: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'PROFILE' | 'BOOKING' | 'LIST'>('BOOKING');
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ClientProfile>({
    name: "Fashion Brand Inc.",
    contactPerson: "Alice Smith",
    phone: "+1 555-0123",
    bankInfo: "Chase Bank **** 1234"
  });

  const [bookings, setBookings] = useState<Booking[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // In a real app, we'd filter by the current user's client ID
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mappedBookings = (data || []).map(b => ({
        id: b.id,
        clientName: b.client_name,
        fabricInfo: b.fabric_info,
        inspectionDate: b.inspection_date,
        requirements: b.requirements,
        status: b.status,
        assignedInspectorId: b.assigned_inspector_id
      }));
      setBookings(mappedBookings);
    } catch (error) {
      console.error('Error fetching bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const [newBooking, setNewBooking] = useState<Partial<Booking>>({
    fabricInfo: '',
    inspectionDate: '',
    requirements: ''
  });

  const handleSubmitBooking = async () => {
    if(!newBooking.fabricInfo || !newBooking.inspectionDate) return;
    
    try {
      const { data, error } = await supabase
        .from('bookings')
        .insert([{
          client_name: profile.name,
          fabric_info: newBooking.fabricInfo,
          inspection_date: newBooking.inspectionDate,
          requirements: newBooking.requirements,
          status: 'PENDING'
        }])
        .select();

      if (error) throw error;

      if (data) {
        const mapped = {
          id: data[0].id,
          clientName: data[0].client_name,
          fabricInfo: data[0].fabric_info,
          inspectionDate: data[0].inspection_date,
          requirements: data[0].requirements,
          status: data[0].status
        };
        setBookings([mapped, ...bookings]);
        setNewBooking({ fabricInfo: '', inspectionDate: '', requirements: '' });
        setActiveTab('LIST');
        alert("Booking Request Submitted!");
      }
    } catch (error) {
      console.error('Error submitting booking:', error);
      alert('Failed to submit booking');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-brand-600" size={32} />
        <span className="ml-2 text-slate-500">Loading Portal...</span>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex border-b border-slate-200 mb-6">
        <button 
          onClick={() => setActiveTab('BOOKING')} 
          className={`px-4 py-2 font-medium ${activeTab === 'BOOKING' ? 'text-brand-600 border-b-2 border-brand-600' : 'text-slate-500'}`}
        >
          New Request
        </button>
        <button 
          onClick={() => setActiveTab('LIST')} 
          className={`px-4 py-2 font-medium ${activeTab === 'LIST' ? 'text-brand-600 border-b-2 border-brand-600' : 'text-slate-500'}`}
        >
          My Bookings
        </button>
        <button 
          onClick={() => setActiveTab('PROFILE')} 
          className={`px-4 py-2 font-medium ${activeTab === 'PROFILE' ? 'text-brand-600 border-b-2 border-brand-600' : 'text-slate-500'}`}
        >
          Profile
        </button>
      </div>

      {activeTab === 'BOOKING' && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 space-y-4">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <ClipboardList className="text-brand-600"/> Request Inspection
          </h2>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Fabric Information</label>
            <input 
              type="text" 
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none" 
              placeholder="e.g. 100% Cotton, 200 GSM, Red Color"
              value={newBooking.fabricInfo}
              onChange={e => setNewBooking({...newBooking, fabricInfo: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Requested Date</label>
            <input 
              type="date" 
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
              value={newBooking.inspectionDate}
              onChange={e => setNewBooking({...newBooking, inspectionDate: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Special Requirements / Remarks</label>
            <textarea 
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none h-24"
              placeholder="Any specific defects to look out for?"
              value={newBooking.requirements}
              onChange={e => setNewBooking({...newBooking, requirements: e.target.value})}
            />
          </div>
          
          <button 
            onClick={handleSubmitBooking}
            className="w-full bg-brand-600 text-white py-3 rounded-lg font-bold hover:bg-brand-700 transition"
          >
            Submit Request
          </button>
        </div>
      )}

      {activeTab === 'LIST' && (
        <div className="space-y-4">
           {bookings.map(b => (
             <div key={b.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center">
               <div>
                 <div className="font-bold text-slate-800">{b.fabricInfo}</div>
                 <div className="text-sm text-slate-500 flex items-center gap-2 mt-1">
                   <Calendar size={14}/> {b.inspectionDate}
                 </div>
               </div>
               <span className={`px-3 py-1 rounded-full text-xs font-bold 
                 ${b.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : 
                   b.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-600'}`}>
                 {b.status}
               </span>
             </div>
           ))}
        </div>
      )}

      {activeTab === 'PROFILE' && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 space-y-4">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 bg-brand-100 rounded-full flex items-center justify-center text-brand-600 font-bold text-2xl">
              {profile.name.charAt(0)}
            </div>
            <div>
              <h2 className="font-bold text-xl">{profile.name}</h2>
              <p className="text-slate-500">Client Account</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-500 uppercase">Contact Person</label>
              <div className="font-medium">{profile.contactPerson}</div>
            </div>
            <div>
              <label className="text-xs text-slate-500 uppercase">Phone</label>
              <div className="font-medium">{profile.phone}</div>
            </div>
             <div className="col-span-2">
              <label className="text-xs text-slate-500 uppercase">Billing / Bank Info</label>
              <div className="font-medium">{profile.bankInfo}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientPortal;