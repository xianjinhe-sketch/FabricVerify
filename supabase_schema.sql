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
  inspection_date DATE,
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

-- Enable Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rolls ENABLE ROW LEVEL SECURITY;
ALTER TABLE defects ENABLE ROW LEVEL SECURITY;

-- Basic Policies (Allow all for now, can be refined later)
CREATE POLICY "Allow public read access" ON profiles FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON inspectors FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON bookings FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON inspection_jobs FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON rolls FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON defects FOR SELECT USING (true);

CREATE POLICY "Allow all access for authenticated users" ON profiles FOR ALL USING (true);
CREATE POLICY "Allow all access for authenticated users" ON inspectors FOR ALL USING (true);
CREATE POLICY "Allow all access for authenticated users" ON bookings FOR ALL USING (true);
CREATE POLICY "Allow all access for authenticated users" ON inspection_jobs FOR ALL USING (true);
CREATE POLICY "Allow all access for authenticated users" ON rolls FOR ALL USING (true);
CREATE POLICY "Allow all access for authenticated users" ON defects FOR ALL USING (true);
