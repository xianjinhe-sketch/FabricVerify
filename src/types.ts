// types.ts

export enum Role {
  CLIENT = 'CLIENT',
  CS = 'CS',
  INSPECTOR = 'INSPECTOR',
  REVIEWER = 'REVIEWER'
}

export enum FabricType {
  WOVEN = 'WOVEN',
  KNITTED = 'KNITTED',
  OTHER = 'OTHER'
}

export enum FabricGroup {
  GROUP_A = 'GROUP_A',
  GROUP_B = 'GROUP_B',
  GROUP_C = 'GROUP_C',
  GROUP_D = 'GROUP_D'
}

export interface Inspector {
  id: string;
  name: string;
  phone: string;
  email: string;
  skills: string[];
  equipment: string[];
}

export interface Booking {
  id: string;
  clientName: string;
  fabricInfo: string;
  fabricType?: FabricType;
  inspectionDate: string;
  shipmentDate?: string;
  orderQuantity?: string;
  factoryName?: string;
  factoryAddress?: string;
  contactPerson?: string;
  contactPhone?: string;
  contactEmail?: string;
  productImages?: string[];
  actualInspectionDate?: string;
  reportNumber?: string;
  requirements: string;
  status: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
  assignedInspectorId?: string;
}

export interface ClientProfile {
  name: string;
  contactPerson: string;
  phone: string;
  bankInfo: string;
}

export interface ClientStandard {
  id: string;
  clientId?: string;
  clientName: string;
  fabricType: FabricType;
  samplingStandard: string;
  weightTolerance: string;
  widthTolerance: string;
  colorTolerance: string;
  quantityTolerance: string;
  lengthTolerance: string;
  bowSkewSolid: string;
  bowSkewPrint: string;
  otherStandards: string;
  maxAcceptablePointPerRoll?: string;
  maxShipmentPointCount?: string;
}

export interface Defect {
  id: string;
  name: string;
  points: number;
  imageUrl?: string;
  isContinuous?: boolean;
  isHole?: boolean;
  defectLength?: number;
  lengthInches?: number;
  imagePath?: string;
}

export interface RollData {
  id: string;
  rollNo: string;
  dyeLot: string;
  length: number;
  weight: number;
  width: number;
  defects: Defect[];
  comments: string;
  status: 'PENDING' | 'INSPECTED';
  isSelected?: boolean;
  actualLength?: number;
  actualWidth?: number;
  actualWeight?: number;
  cuttableWidth?: number;
  overallWidth?: number;
  bowSkew?: number;
}

export interface InspectionJob {
  id: string;
  bookingId: string;
  clientName?: string;
  bookingDetails?: {
    fabricInfo?: string;
    fabricType?: FabricType;
    inspectionDate?: string;
    shipmentDate?: string;
    orderQuantity?: string;
    factoryName?: string;
    factoryAddress?: string;
    contactPerson?: string;
    contactPhone?: string;
    contactEmail?: string;
    productImages?: string[];
    actualInspectionDate?: string;
    reportNumber?: string;
  };
  fabricType: FabricType;
  fabricGroup?: FabricGroup;
  environmentPhotos: Record<string, string>;
  packingListPhotos?: string[];
  lightingLux?: number;
  rolls: RollData[];
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  passThreshold: number;
  samplingMethod?: 'MANUAL' | 'TEN_PERCENT' | 'SQUARE_ROOT';
  totalShipmentQuantity?: number;
  reviewerComments?: string;
  inspectorComments?: string;
}

export const DEFECT_TYPES: Record<'WARP' | 'WEFT', string[]> = {
  WARP: ['Slub', 'Broken Yarn', 'Thick Yarn', 'Thin Yarn', 'Missing Yarn', 'Float', 'Knot'],
  WEFT: ['Color Spot', 'Uneven Dyeing', 'Crease Mark', 'Stain', 'Oil Spot', 'Water Mark', 'Hole']
};
