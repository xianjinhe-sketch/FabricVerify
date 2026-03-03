-- FabricVerify Supabase Schema
-- Copy and paste this into the Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Profiles (for users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role TEXT CHECK (role IN ('CLIENT', 'CS', 'INSPECTOR', 'REVIEWER')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Inspectors
CREATE TABLE IF NOT EXISTS inspectors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT UNIQUE,
  skills TEXT[],
  equipment TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Bookings
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_name TEXT NOT NULL,
  fabric_info TEXT,
  fabric_type TEXT CHECK (fabric_type IN ('WOVEN', 'KNITTED')),
  inspection_date DATE,
  shipment_date DATE,
  order_quantity TEXT,
  factory_name TEXT,
  factory_address TEXT,
  contact_person TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  product_images TEXT[] DEFAULT '{}',
  actual_inspection_date DATE,
  report_number TEXT,
  requirements TEXT,
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED')),
  assigned_inspector_id UUID REFERENCES inspectors(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Inspection Jobs
CREATE TABLE IF NOT EXISTS inspection_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  fabric_type TEXT CHECK (fabric_type IN ('WOVEN', 'KNITTED')),
  fabric_group TEXT CHECK (fabric_group IN ('GROUP_A', 'GROUP_B', 'GROUP_C', 'GROUP_D')),
  environment_photos JSONB DEFAULT '{}'::jsonb,
  packing_list_photos TEXT[] DEFAULT '{}',
  lighting_lux INTEGER,
  status TEXT DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED')),
  pass_threshold NUMERIC DEFAULT 20,
  sampling_method TEXT CHECK (sampling_method IN ('MANUAL', 'TEN_PERCENT', 'SQUARE_ROOT')),
  total_shipment_quantity NUMERIC,
  reviewer_comments TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Rolls
CREATE TABLE IF NOT EXISTS rolls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES inspection_jobs(id) ON DELETE CASCADE,
  roll_no TEXT NOT NULL,
  dye_lot TEXT,
  length NUMERIC NOT NULL,
  weight NUMERIC,
  width NUMERIC,
  comments TEXT,
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'INSPECTED')),
  is_selected BOOLEAN DEFAULT false,
  actual_length NUMERIC,
  actual_width NUMERIC,
  actual_weight NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Defects
CREATE TABLE IF NOT EXISTS defects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  roll_id UUID REFERENCES rolls(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  points INTEGER NOT NULL,
  image_url TEXT,
  is_continuous BOOLEAN DEFAULT false,
  is_hole BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Client Standards
CREATE TABLE IF NOT EXISTS client_standards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES profiles(id),
  client_name TEXT, -- Fallback if not using profiles yet
  fabric_type TEXT CHECK (fabric_type IN ('WOVEN', 'KNITTED')),
  sampling_standard TEXT,
  weight_tolerance TEXT,
  width_tolerance TEXT,
  color_tolerance TEXT,
  quantity_tolerance TEXT,
  length_tolerance TEXT,
  bow_skew_solid TEXT,
  bow_skew_print TEXT,
  other_standards TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(client_name, fabric_type)
);

-- Enable Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rolls ENABLE ROW LEVEL SECURITY;
ALTER TABLE defects ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_standards ENABLE ROW LEVEL SECURITY;

-- Basic Policies (Allow all for development)
CREATE POLICY "Allow all access" ON profiles FOR ALL USING (true);
CREATE POLICY "Allow all access" ON inspectors FOR ALL USING (true);
CREATE POLICY "Allow all access" ON bookings FOR ALL USING (true);
CREATE POLICY "Allow all access" ON inspection_jobs FOR ALL USING (true);
CREATE POLICY "Allow all access" ON rolls FOR ALL USING (true);
CREATE POLICY "Allow all access" ON defects FOR ALL USING (true);
CREATE POLICY "Allow all access" ON client_standards FOR ALL USING (true);
