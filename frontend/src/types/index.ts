// Shared TypeScript interfaces — mirror Pydantic schemas exactly

export type Gender = 'MALE' | 'FEMALE' | 'OTHER';
export type BillType = 'SIMULATED' | 'MANUAL';
export type GenerationMode = 'DOSE' | 'GENERIC';
export type MedicineUnit = 'TABLET' | 'CAPSULE' | 'SYRUP' | 'INJECTION' | 'CREAM' | 'DROPS' | 'INHALER' | 'SACHET' | 'OTHER';

// ── Patient ──────────────────────────────────────────────────────────
export interface Patient {
  id: number;
  patient_code: string;
  name: string;
  age: number | null;
  gender: Gender | null;
  phone: string | null;
  address: string | null;
  status: boolean;
  created_at: string;
}

export interface PatientCreate {
  patient_code: string;
  name: string;
  age?: number | null;
  gender?: Gender | null;
  phone?: string | null;
  address?: string | null;
  status?: boolean;
}

export interface PatientUpdate {
  name?: string;
  age?: number | null;
  gender?: Gender | null;
  phone?: string | null;
  address?: string | null;
  status?: boolean;
}

// ── Doctor ───────────────────────────────────────────────────────────
export interface Doctor {
  id: number;
  doctor_code: string;
  name: string;
  specialization: string | null;
  phone: string | null;
  status: boolean;
  created_at: string;
}

export interface DoctorCreate {
  doctor_code: string;
  name: string;
  specialization?: string | null;
  phone?: string | null;
  status?: boolean;
}

export interface DoctorUpdate {
  name?: string;
  specialization?: string | null;
  phone?: string | null;
  status?: boolean;
}

// ── Generic Drug ─────────────────────────────────────────────────────
export interface GenericDrug {
  id: number;
  generic_code: string;
  name: string;
  created_at: string;
}

export interface GenericDrugCreate {
  generic_code: string;
  name: string;
}

// ── Medicine ─────────────────────────────────────────────────────────
export interface Medicine {
  id: number;
  medicine_code: string;
  name: string;
  generic_drug_id: number;
  generic_name: string | null;
  batch_number: string;
  expiry_date: string;
  mrp: string;
  unit: MedicineUnit;
  stock_qty: number;
  status: boolean;
  is_expired: boolean;
  created_at: string;
}

export interface MedicineCreate {
  medicine_code: string;
  name: string;
  generic_drug_id: number;
  batch_number: string;
  expiry_date: string;
  mrp: number;
  unit?: MedicineUnit;
  stock_qty?: number;
  status?: boolean;
}

export interface MedicineUpdate {
  name?: string;
  batch_number?: string;
  expiry_date?: string;
  mrp?: number;
  unit?: MedicineUnit;
  stock_qty?: number;
  status?: boolean;
}

// ── Dose Pattern ─────────────────────────────────────────────────────
export interface DosePatternItem {
  id: number;
  medicine_id: number;
  medicine_name: string | null;
  quantity: number;
}

export interface DosePattern {
  id: number;
  name: string;
  illness_name: string;
  status: boolean;
  created_at: string;
  items: DosePatternItem[];
}

export interface DosePatternCreate {
  name: string;
  illness_name: string;
  status?: boolean;
  items: { medicine_id: number; quantity: number }[];
}

// ── Bill ─────────────────────────────────────────────────────────────
export interface BillItem {
  id: number;
  medicine_id: number | null;
  medicine_name: string;
  generic_name: string;
  batch_number: string;
  expiry_date: string;
  mrp: string;
  unit: string;
  quantity: number;
  line_total: string;
}

export interface Bill {
  id: number;
  bill_number: string;
  bill_type: BillType;
  generation_mode: GenerationMode | null;
  patient_id: number;
  patient_name: string | null;
  doctor_id: number;
  doctor_name: string | null;
  subtotal: string;
  discount: string;
  total_amount: string;
  notes: string | null;
  created_at: string;
  items: BillItem[];
}

export interface ManualBillItem {
  medicine_id: number;
  quantity: number;
}

export interface ManualBillCreate {
  patient_id: number;
  doctor_id: number;
  items: ManualBillItem[];
  discount?: number;
  notes?: string | null;
}

// ── Generation ────────────────────────────────────────────────────────
export interface GenerationRequest {
  count: number;
  seed?: number | null;
  dose_ratio?: number;
}

export interface GenerationResponse {
  generated: number;
  skipped: number;
  bills: Bill[];
}

// ── Import Result ─────────────────────────────────────────────────────
export interface ImportResult {
  inserted: number;
  skipped: number;
  errors: string[];
}

// ── Dashboard Stats ───────────────────────────────────────────────────
export interface DashboardStats {
  total_bills: number;
  simulated_bills: number;
  manual_bills: number;
  total_patients: number;
  total_doctors: number;
  total_medicines: number;
  expired_medicines: number;
}
