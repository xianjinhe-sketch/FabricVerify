export enum Role {
  CLIENT = 'CLIENT',
  CS = 'CS',
  INSPECTOR = 'INSPECTOR',
  REVIEWER = 'REVIEWER'
}

export enum FabricType {
  WOVEN = 'WOVEN',
  KNITTED = 'KNITTED'
}

export enum FabricGroup {
  GROUP_A = 'Group A (20 pts)',
  GROUP_B = 'Group B (25 pts)',
  GROUP_C = 'Group C (35 pts)',
  GROUP_D = 'Group D (40 pts)'
}

export interface Inspector {
  id: string;
  name: string;
  phone: string;
  email: string;
  skills: string[];
  equipment: string[];
}

export interface ClientProfile {
  name: string;
  contactPerson: string;
  phone: string;
  bankInfo: string;
}

export interface Booking {
  id: string;
  clientName: string;
  fabricInfo: string;
  inspectionDate: string;
  requirements: string;
  status: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'APPROVED';
  assignedInspectorId?: string;
  photos?: string[]; // Reference photos provided by client
}

export interface Defect {
  id: string;
  name: string;
  points: 1 | 2 | 3 | 4;
  defectLength?: number; // length in inches, for auto-suggesting points
  imageUrl?: string;
  isContinuous?: boolean; // Continuous defects are often handled specially
  isHole?: boolean; // Holes are always 4 points
}

export interface RollData {
  id: string;
  rollNo: string;
  dyeLot: string;
  weight: number;
  length: number;
  width: number; // in inches
  overallWidth?: number;
  cuttableWidth?: number;
  actualLength?: number;
  actualWeight?: number;
  bowSkew?: number; // in percentage
  defects: Defect[];
  comments: string;
  status: 'PENDING' | 'INSPECTED';
  isSelected?: boolean;
}

export interface InspectionJob {
  id: string;
  bookingId: string;
  environmentPhotos: {
    gate?: string;
    workshop?: string;
    machine?: string;
    lighting?: string; // Enhanced requirement: Lighting check
  };
  packingListPhotos?: string[];
  rolls: RollData[];
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  fabricType: FabricType;
  fabricGroup?: FabricGroup;
  totalShipmentQuantity?: number; // in yards
  passThreshold: number; // Configurable pass threshold
  reviewerComments?: string;
  lightingLux?: number;
  samplingMethod?: 'TEN_PERCENT' | 'SQRT_TEN' | 'MANUAL';
}

export const DEFECT_TYPES = {
  WARP: [
    'Coarse picks/ends', 'Fine picks/ends', 'Knots', 'Slubs', 'Compactor mark',
    'Crease marks', 'Mending/burl marks', 'Misprint', 'Thick place', 'Thin place',
    'Unprinted marks', 'Out of register', 'Seams marks', 'Color smear', 'Smash',
    'Shrinkage mark', 'Soil/dirty mark', 'Spliced', 'Stain', 'Streaks', 'Shade bar', 'Stop mark'
  ],
  WEFT: [
    'Barre', 'Broken picks/ends', 'Double picks/ends', 'End out', 'Filling bar',
    'Float', 'Fly', 'Holes', 'Jerk-in', 'Misdraw', 'Mispicks', 'Mixed/Foreign yarn',
    'Reed mark', 'Dropped stitches', 'Laddering', 'Needle lines', 'Press-off',
    'Runs', 'Tucking', 'Wrong pattern', 'Dirty print'
  ]
};