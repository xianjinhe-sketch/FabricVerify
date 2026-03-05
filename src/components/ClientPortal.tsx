import React, { useState, useEffect } from 'react';
import { Booking, ClientProfile, ClientStandard, FabricType } from '../types';
import { Calendar, Package, ClipboardList, User, Loader2, Settings, ShieldCheck, Trash2 } from 'lucide-react';
import { supabase } from '../services/supabase';
import { dataService } from '../services/dataService';
import toast from 'react-hot-toast';

const ClientPortal: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'PROFILE' | 'BOOKING' | 'LIST' | 'STANDARDS'>('BOOKING');
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ClientProfile>({
    name: "Fashion Brand Inc.",
    contactPerson: "Alice Smith",
    phone: "+1 555-0123",
    bankInfo: "Chase Bank **** 1234"
  });

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [standards, setStandards] = useState<ClientStandard[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [selectedStandardType, setSelectedStandardType] = useState<FabricType>(FabricType.WOVEN);
  const [bookingToDelete, setBookingToDelete] = useState<string | null>(null);

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

      const clientStandards = await dataService.fetchClientStandards(profile.name);
      setStandards(clientStandards);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const [newBooking, setNewBooking] = useState<Partial<Booking>>({
    fabricInfo: '',
    inspectionDate: '',
    shipmentDate: '',
    orderQuantity: '',
    factoryName: '',
    factoryAddress: '',
    contactPerson: '',
    contactPhone: '',
    contactEmail: '',
    requirements: '',
    fabricType: FabricType.WOVEN,
    productImages: []
  });

  const handleSubmitBooking = async () => {
    if (!newBooking.fabricInfo || !newBooking.inspectionDate || !newBooking.factoryName) {
      toast.error("Please fill in Fabric Information, Requested Date, and Factory Name");
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('bookings')
        .insert([{
          client_name: profile.name,
          fabric_info: newBooking.fabricInfo,
          fabric_type: newBooking.fabricType,
          inspection_date: newBooking.inspectionDate,
          shipment_date: newBooking.shipmentDate || null,
          order_quantity: newBooking.orderQuantity,
          factory_name: newBooking.factoryName,
          factory_address: newBooking.factoryAddress,
          contact_person: newBooking.contactPerson,
          contact_phone: newBooking.contactPhone,
          contact_email: newBooking.contactEmail,
          product_images: newBooking.productImages,
          requirements: newBooking.requirements,
          status: 'PENDING'
        }])
        .select();

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      console.log('Booking submitted successfully:', data);

      if (data && data.length > 0) {
        const mapped: Booking = {
          id: data[0].id,
          clientName: data[0].client_name,
          fabricInfo: data[0].fabric_info,
          fabricType: data[0].fabric_type,
          inspectionDate: data[0].inspection_date,
          shipmentDate: data[0].shipment_date,
          orderQuantity: data[0].order_quantity,
          factoryName: data[0].factory_name,
          factoryAddress: data[0].factory_address,
          contactPerson: data[0].contact_person,
          contactPhone: data[0].contact_phone,
          contactEmail: data[0].contact_email,
          productImages: data[0].product_images,
          requirements: data[0].requirements,
          status: data[0].status
        };
        setBookings([mapped, ...bookings]);
        setNewBooking({
          fabricInfo: '',
          inspectionDate: '',
          shipmentDate: '',
          orderQuantity: '',
          factoryName: '',
          factoryAddress: '',
          contactPerson: '',
          contactPhone: '',
          contactEmail: '',
          requirements: '',
          fabricType: FabricType.WOVEN,
          productImages: []
        });
        setActiveTab('LIST');
        toast.success("Booking Request Submitted Successfully!");
      } else {
        throw new Error("No data returned from server after submission");
      }
    } catch (error: any) {
      console.error('Error submitting booking:', error);
      toast.error(`Failed to submit booking: ${error.message || 'Unknown error'}. Please ensure you have run the SQL schema in your Supabase SQL Editor.`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteBooking = async (id: string) => {
    try {
      const { error } = await supabase
        .from('bookings')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setBookings(bookings.filter(b => b.id !== id));
      setBookingToDelete(null);
      toast.success('Booking deleted');
    } catch (error) {
      console.error('Error deleting booking:', error);
      toast.error('Failed to delete booking');
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
          onClick={() => setActiveTab('STANDARDS')}
          className={`px-4 py-2 font-medium ${activeTab === 'STANDARDS' ? 'text-brand-600 border-b-2 border-brand-600' : 'text-slate-500'}`}
        >
          Inspection Standards
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
            <ClipboardList className="text-brand-600" /> Request Inspection
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Fabric Type (面料类型)</label>
              <select
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none bg-white"
                value={newBooking.fabricType}
                title="Fabric Type"
                onChange={e => setNewBooking({ ...newBooking, fabricType: e.target.value as FabricType })}
              >
                <option value={FabricType.WOVEN}>Woven (梭织)</option>
                <option value={FabricType.KNITTED}>Knitted (针织)</option>
                <option value={FabricType.OTHER}>Other (其他)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Order/Shipment Qty (订单/出货数量)</label>
              <input
                type="text"
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                placeholder="e.g. 5000 meters"
                value={newBooking.orderQuantity}
                onChange={e => setNewBooking({ ...newBooking, orderQuantity: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Fabric Information (面料详细信息)</label>
            <input
              type="text"
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
              placeholder="e.g. 100% Cotton, 200 GSM, Red Color"
              value={newBooking.fabricInfo}
              onChange={e => setNewBooking({ ...newBooking, fabricInfo: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Requested Inspection Date (申请验货日期)</label>
              <input
                type="date"
                title="Requested Inspection Date"
                placeholder="Select Date"
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                value={newBooking.inspectionDate}
                onChange={e => setNewBooking({ ...newBooking, inspectionDate: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Shipment Date (出货日期)</label>
              <input
                type="date"
                title="Shipment Date"
                placeholder="Select Date"
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                value={newBooking.shipmentDate}
                onChange={e => setNewBooking({ ...newBooking, shipmentDate: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-slate-100">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Factory Information (工厂信息)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Factory Name (工厂名称)</label>
                <input
                  type="text"
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                  placeholder="Enter factory name"
                  value={newBooking.factoryName}
                  onChange={e => setNewBooking({ ...newBooking, factoryName: e.target.value })}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Factory Address (工厂地址)</label>
                <input
                  type="text"
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                  placeholder="Enter full address"
                  value={newBooking.factoryAddress}
                  onChange={e => setNewBooking({ ...newBooking, factoryAddress: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Contact Person (联系人)</label>
                <input
                  type="text"
                  title="Contact Person"
                  placeholder="Contact Person Name"
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                  value={newBooking.contactPerson}
                  onChange={e => setNewBooking({ ...newBooking, contactPerson: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Phone (电话)</label>
                <input
                  type="text"
                  title="Contact Phone"
                  placeholder="Phone Number"
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                  value={newBooking.contactPhone}
                  onChange={e => setNewBooking({ ...newBooking, contactPhone: e.target.value })}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Email (邮件)</label>
                <input
                  type="email"
                  title="Contact Email"
                  placeholder="Email Address"
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                  value={newBooking.contactEmail}
                  onChange={e => setNewBooking({ ...newBooking, contactEmail: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Product Images (产品图片)</label>
            <div className="flex items-center gap-4">
              <input
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                id="product-images"
                onChange={(e) => {
                  // Simulation of image upload
                  const files = e.target.files;
                  if (files) {
                    const newImages = [...(newBooking.productImages || [])];
                    for (let i = 0; i < files.length; i++) {
                      newImages.push(URL.createObjectURL(files[i]));
                    }
                    setNewBooking({ ...newBooking, productImages: newImages });
                  }
                }}
              />
              <label
                htmlFor="product-images"
                className="cursor-pointer bg-slate-100 border-2 border-dashed border-slate-300 rounded-lg p-4 flex flex-col items-center justify-center w-32 h-32 hover:bg-slate-200 transition"
              >
                <Package className="text-slate-400 mb-2" />
                <span className="text-xs text-slate-500 font-medium">Add Images</span>
              </label>
              <div className="flex gap-2 overflow-x-auto">
                {newBooking.productImages?.map((img, idx) => (
                  <div key={idx} className="relative w-32 h-32 rounded-lg overflow-hidden border">
                    <img src={img} alt="Product" className="w-full h-full object-cover" />
                    <button
                      title="Remove Image"
                      onClick={() => {
                        const imgs = [...(newBooking.productImages || [])];
                        imgs.splice(idx, 1);
                        setNewBooking({ ...newBooking, productImages: imgs });
                      }}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1"
                    >
                      <Loader2 size={12} className="rotate-45" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Special Requirements / Remarks</label>
            <textarea
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none h-24"
              placeholder="Any specific defects to look out for?"
              value={newBooking.requirements}
              onChange={e => setNewBooking({ ...newBooking, requirements: e.target.value })}
            />
          </div>

          <button
            onClick={handleSubmitBooking}
            disabled={submitting}
            className="w-full bg-brand-600 text-white py-3 rounded-lg font-bold hover:bg-brand-700 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                Submitting...
              </>
            ) : (
              'Submit Request'
            )}
          </button>
        </div>
      )}

      {activeTab === 'LIST' && (
        <div className="space-y-4">
          {bookings.map(b => (
            <div key={b.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center group">
              <div>
                <div className="font-bold text-slate-800">{b.fabricInfo}</div>
                <div className="text-sm text-slate-500 flex items-center gap-2 mt-1">
                  <Calendar size={14} /> {b.inspectionDate}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className={`px-3 py-1 rounded-full text-xs font-bold 
                   ${b.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                    b.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-600'}`}>
                  {b.status}
                </span>
                <button
                  onClick={() => setBookingToDelete(b.id)}
                  className="text-slate-300 hover:text-red-500 transition-colors p-2 rounded-full hover:bg-red-50 opacity-0 group-hover:opacity-100"
                  title="Delete Booking"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
          {bookings.length === 0 && (
            <div className="text-center p-8 text-slate-500 bg-white rounded-xl border border-slate-100">
              No bookings found.
            </div>
          )}
        </div>
      )}

      {activeTab === 'STANDARDS' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <ShieldCheck className="text-brand-600" /> Inspection Standards Configuration
              </h2>
              <div className="flex items-center gap-2">
                <label className="text-sm font-bold text-slate-600">Fabric Type:</label>
                <select
                  className="p-2 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none bg-white font-medium"
                  value={selectedStandardType}
                  title="Fabric Type"
                  onChange={(e) => setSelectedStandardType(e.target.value as FabricType)}
                >
                  <option value={FabricType.WOVEN}>Woven (梭织)</option>
                  <option value={FabricType.KNITTED}>Knitted (针织)</option>
                  <option value={FabricType.OTHER}>Other (其他)</option>
                </select>
              </div>
            </div>

            <div className="max-w-2xl">
              {(() => {
                const type = selectedStandardType;
                const existing = standards.find(s => s.fabricType === type);
                const standard = existing || {
                  clientName: profile.name,
                  fabricType: type,
                  samplingStandard: '10%',
                  weightTolerance: '5%',
                  widthTolerance: '',
                  colorTolerance: '4-5',
                  quantityTolerance: '5%',
                  lengthTolerance: type === FabricType.WOVEN ? '2%' : '',
                  bowSkewSolid: type === FabricType.WOVEN ? '3%' : '5%',
                  bowSkewPrint: '2%',
                  otherStandards: '',
                  maxAcceptablePointPerRoll: '28',
                  maxShipmentPointCount: '20'
                };

                const updateStandard = (field: keyof ClientStandard, value: string) => {
                  const newStandards = [...standards];
                  const idx = newStandards.findIndex(s => s.fabricType === type);
                  if (idx > -1) {
                    (newStandards[idx] as any)[field] = value;
                  } else {
                    newStandards.push({ ...standard, [field]: value } as ClientStandard);
                  }
                  setStandards(newStandards);
                };

                return (
                  <div key={type} className="space-y-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <h3 className="font-bold text-lg text-slate-800 border-b pb-2 flex items-center justify-between">
                      {type === FabricType.WOVEN ? 'Woven (梭织)' : type === FabricType.KNITTED ? 'Knitted (针织)' : 'Other (其他)'}
                      <span className="text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded">Protocol Active</span>
                    </h3>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Sampling Standard (抽样标准)</label>
                        <select
                          className="w-full p-2 text-sm border rounded bg-white"
                          value={standard.samplingStandard}
                          title="Sampling Standard"
                          onChange={e => updateStandard('samplingStandard', e.target.value)}
                        >
                          <option value="10%">10%</option>
                          <option value="√n * 10">√n * 10</option>
                          <option value="Other">Other</option>
                        </select>
                        {standard.samplingStandard === 'Other' && (
                          <input
                            type="text"
                            className="w-full mt-2 p-2 text-sm border rounded bg-white"
                            placeholder="Specify other sampling standard"
                            onChange={e => updateStandard('samplingStandard', e.target.value)}
                          />
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Weight Tol. (克重允差)</label>
                          <input
                            type="text"
                            className="w-full p-2 text-sm border rounded bg-white"
                            value={standard.weightTolerance}
                            onChange={e => updateStandard('weightTolerance', e.target.value)}
                            placeholder="+/- 5%"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Width Tol. (门幅允差)</label>
                          <input
                            type="text"
                            className="w-full p-2 text-sm border rounded bg-white"
                            value={standard.widthTolerance}
                            onChange={e => updateStandard('widthTolerance', e.target.value)}
                            placeholder="-0 / +2 inch"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Qty Tol. (数量偏差)</label>
                          <input
                            type="text"
                            className="w-full p-2 text-sm border rounded bg-white"
                            value={standard.quantityTolerance}
                            onChange={e => updateStandard('quantityTolerance', e.target.value)}
                            placeholder="5%"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Length Tol. (长度偏差)</label>
                          <input
                            type="text"
                            className="w-full p-2 text-sm border rounded bg-white"
                            value={standard.lengthTolerance}
                            onChange={e => updateStandard('lengthTolerance', e.target.value)}
                            placeholder="2%"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Color Tolerance (色差允差)</label>
                        <input
                          type="text"
                          className="w-full p-2 text-sm border rounded bg-white"
                          value={standard.colorTolerance}
                          onChange={e => updateStandard('colorTolerance', e.target.value)}
                          placeholder="Grade 4-5"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Bow/Skew Solid (弓纬-净色)</label>
                          <input
                            type="text"
                            className="w-full p-2 text-sm border rounded bg-white"
                            value={standard.bowSkewSolid}
                            onChange={e => updateStandard('bowSkewSolid', e.target.value)}
                            placeholder="3%"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Bow/Skew Print (弓纬-印花)</label>
                          <input
                            type="text"
                            className="w-full p-2 text-sm border rounded bg-white"
                            value={standard.bowSkewPrint}
                            onChange={e => updateStandard('bowSkewPrint', e.target.value)}
                            placeholder="2%"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Max Pts/Roll (单卷最高分数)</label>
                          <input
                            type="text"
                            className="w-full p-2 text-sm border rounded bg-white"
                            value={standard.maxAcceptablePointPerRoll || '28'}
                            onChange={e => updateStandard('maxAcceptablePointPerRoll', e.target.value)}
                            placeholder="28"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Max Pts/Shipment (整批最高分数)</label>
                          <input
                            type="text"
                            className="w-full p-2 text-sm border rounded bg-white"
                            value={standard.maxShipmentPointCount || '20'}
                            onChange={e => updateStandard('maxShipmentPointCount', e.target.value)}
                            placeholder="20"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Other Standards (其他)</label>
                        <textarea
                          className="w-full p-2 text-sm border rounded bg-white h-16"
                          value={standard.otherStandards}
                          title="Other Standards"
                          placeholder="Other standards..."
                          onChange={e => updateStandard('otherStandards', e.target.value)}
                        />
                      </div>
                    </div>

                    <button
                      onClick={async () => {
                        try {
                          await dataService.saveClientStandard(standard);
                          toast.success(`${type} standards saved successfully!`);
                        } catch (err) {
                          console.error(err);
                          toast.error('Failed to save standards');
                        }
                      }}
                      className="w-full py-2 bg-brand-600 text-white rounded font-bold text-sm hover:bg-brand-700 transition"
                    >
                      Save {type} Standards
                    </button>
                  </div>
                );
              })()}
            </div>
          </div>
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

      {/* Delete Confirmation Modal */}
      {bookingToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Delete Booking</h3>
            <p className="text-slate-600 mb-6">Are you sure you want to delete this booking? This action cannot be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setBookingToDelete(null)}
                className="flex-1 py-2.5 px-4 rounded-lg font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteBooking(bookingToDelete)}
                className="flex-1 py-2.5 px-4 rounded-lg font-bold text-white bg-red-500 hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientPortal;