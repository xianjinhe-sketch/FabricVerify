import { supabase } from './supabase';
import { InspectionJob, RollData, Defect, ClientStandard } from '../types';

export const dataService = {
  async fetchActiveJob(): Promise<InspectionJob | null> {
    const { data: jobData, error: jobError } = await supabase
      .from('inspection_jobs')
      .select(`
        *,
        bookings (
          client_name,
          fabric_info,
          fabric_type,
          inspection_date,
          shipment_date,
          order_quantity,
          factory_name,
          factory_address,
          contact_person,
          contact_phone,
          contact_email,
          product_images,
          actual_inspection_date,
          report_number
        ),
        rolls (
          *,
          defects (*)
        )
      `)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (jobError) {
      console.error('Error fetching active job:', jobError);
      throw jobError;
    }

    if (!jobData) return null;

    return this.mapJobFromDB(jobData);
  },

  async updateJobMetadata(jobId: string, updates: Partial<InspectionJob>) {
    const { error } = await supabase
      .from('inspection_jobs')
      .update({
        status: updates.status,
        reviewer_comments: updates.reviewerComments,
        environment_photos: updates.environmentPhotos,
        lighting_lux: updates.lightingLux,
        fabric_type: updates.fabricType,
        fabric_group: updates.fabricGroup,
        sampling_method: updates.samplingMethod,
        total_shipment_quantity: updates.totalShipmentQuantity,
        pass_threshold: updates.passThreshold
      })
      .eq('id', jobId);
    
    if (error) throw error;
  },

  async updateRoll(roll: RollData) {
    const { error } = await supabase
      .from('rolls')
      .update({
        roll_no: roll.rollNo,
        dye_lot: roll.dyeLot,
        length: roll.length,
        weight: roll.weight,
        width: roll.width,
        comments: roll.comments,
        status: roll.status,
        is_selected: roll.isSelected,
        actual_length: roll.actualLength,
        actual_width: roll.actualWidth,
        actual_weight: roll.actualWeight
      })
      .eq('id', roll.id);

    if (error) throw error;
  },

  async addDefect(rollId: string, defect: Defect) {
    const { data, error } = await supabase
      .from('defects')
      .insert([{
        roll_id: rollId,
        name: defect.name,
        points: defect.points,
        image_url: defect.imageUrl,
        is_continuous: defect.isContinuous,
        is_hole: defect.isHole
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async removeDefect(defectId: string) {
    const { error } = await supabase
      .from('defects')
      .delete()
      .eq('id', defectId);
    
    if (error) throw error;
  },

  async fetchClientStandards(clientName: string): Promise<ClientStandard[]> {
    const { data, error } = await supabase
      .from('client_standards')
      .select('*')
      .eq('client_name', clientName);
    
    if (error) throw error;
    
    return (data || []).map(s => ({
      id: s.id,
      clientId: s.client_id,
      clientName: s.client_name,
      fabricType: s.fabric_type,
      samplingStandard: s.sampling_standard,
      weightTolerance: s.weight_tolerance,
      widthTolerance: s.width_tolerance,
      colorTolerance: s.color_tolerance,
      quantityTolerance: s.quantity_tolerance,
      lengthTolerance: s.length_tolerance,
      bowSkewSolid: s.bow_skew_solid,
      bowSkewPrint: s.bow_skew_print,
      otherStandards: s.other_standards
    }));
  },

  async saveClientStandard(standard: Partial<ClientStandard>) {
    const { data, error } = await supabase
      .from('client_standards')
      .upsert({
        client_name: standard.clientName,
        fabric_type: standard.fabricType,
        sampling_standard: standard.samplingStandard,
        weight_tolerance: standard.weightTolerance,
        width_tolerance: standard.widthTolerance,
        color_tolerance: standard.colorTolerance,
        quantity_tolerance: standard.quantityTolerance,
        length_tolerance: standard.lengthTolerance,
        bow_skew_solid: standard.bowSkewSolid,
        bow_skew_print: standard.bowSkewPrint,
        other_standards: standard.otherStandards
      }, { onConflict: 'client_name,fabric_type' })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  mapJobFromDB(jobData: any): InspectionJob {
    const booking = jobData.bookings || {};
    return {
      id: jobData.id,
      bookingId: jobData.booking_id,
      clientName: booking.client_name,
      bookingDetails: {
        fabricInfo: booking.fabric_info,
        fabricType: booking.fabric_type,
        inspectionDate: booking.inspection_date,
        shipmentDate: booking.shipment_date,
        orderQuantity: booking.order_quantity,
        factoryName: booking.factory_name,
        factoryAddress: booking.factory_address,
        contactPerson: booking.contact_person,
        contactPhone: booking.contact_phone,
        contactEmail: booking.contact_email,
        productImages: booking.product_images || [],
        actualInspectionDate: booking.actual_inspection_date,
        reportNumber: booking.report_number
      },
      fabricType: jobData.fabric_type,
      fabricGroup: jobData.fabric_group,
      environmentPhotos: jobData.environment_photos || {},
      packingListPhotos: jobData.packing_list_photos || [],
      lightingLux: jobData.lighting_lux,
      status: jobData.status,
      passThreshold: jobData.pass_threshold,
      samplingMethod: jobData.sampling_method,
      totalShipmentQuantity: jobData.total_shipment_quantity,
      reviewerComments: jobData.reviewer_comments,
      rolls: (jobData.rolls || []).map((r: any) => ({
        id: r.id,
        rollNo: r.roll_no,
        dyeLot: r.dye_lot,
        length: Number(r.length),
        weight: Number(r.weight),
        width: Number(r.width),
        comments: r.comments || '',
        status: r.status,
        isSelected: r.is_selected,
        actualLength: r.actual_length ? Number(r.actual_length) : undefined,
        actualWidth: r.actual_width ? Number(r.actual_width) : undefined,
        actualWeight: r.actual_weight ? Number(r.actual_weight) : undefined,
        defects: (r.defects || []).map((d: any) => ({
          id: d.id,
          name: d.name,
          points: d.points,
          imageUrl: d.image_url,
          isContinuous: d.is_continuous,
          isHole: d.is_hole
        }))
      }))
    };
  }
};
