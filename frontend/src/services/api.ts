/**
 * api.ts — single axios instance; all backend calls organized by resource.
 * Every call goes through /api (proxied to localhost:8000 by Vite).
 */
import axios from 'axios';
import type {
  Bill, BillType, DashboardStats, Doctor, DoctorCreate, DoctorUpdate,
  DosePattern, DosePatternCreate, GenericDrug, GenericDrugCreate,
  GenerationRequest, GenerationResponse, ImportResult, ManualBillCreate,
  Medicine, MedicineCreate, MedicineUpdate, Patient, PatientCreate, PatientUpdate,
} from '../types';

const http = axios.create({ baseURL: '/api', timeout: 30_000 });

// ── Health ────────────────────────────────────────────────────────────
export const healthApi = {
  check: () => http.get<{ status: string; app: string; version: string }>('/health'),
};

// ── Dashboard ─────────────────────────────────────────────────────────
export const dashboardApi = {
  stats: () => http.get<DashboardStats>('/bills/stats'),
  recentBills: (limit = 10) => http.get<Bill[]>('/bills', { params: { limit } }),
};

// ── Patients ──────────────────────────────────────────────────────────
export const patientsApi = {
  list:   (params?: { search?: string; status?: boolean }) => http.get<Patient[]>('/patients', { params }),
  get:    (id: number) => http.get<Patient>(`/patients/${id}`),
  create: (body: PatientCreate) => http.post<Patient>('/patients', body),
  update: (id: number, body: PatientUpdate) => http.put<Patient>(`/patients/${id}`, body),
  delete: (id: number) => http.delete(`/patients/${id}`),
  import: (file: File) => {
    const fd = new FormData(); fd.append('file', file);
    return http.post<ImportResult>('/patients/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
};

// ── Doctors ───────────────────────────────────────────────────────────
export const doctorsApi = {
  list:   (params?: { search?: string; status?: boolean }) => http.get<Doctor[]>('/doctors', { params }),
  get:    (id: number) => http.get<Doctor>(`/doctors/${id}`),
  create: (body: DoctorCreate) => http.post<Doctor>('/doctors', body),
  update: (id: number, body: DoctorUpdate) => http.put<Doctor>(`/doctors/${id}`, body),
  delete: (id: number) => http.delete(`/doctors/${id}`),
  import: (file: File) => {
    const fd = new FormData(); fd.append('file', file);
    return http.post<ImportResult>('/doctors/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
};

// ── Generic Drugs ─────────────────────────────────────────────────────
export const genericDrugsApi = {
  list:   (params?: { search?: string }) => http.get<GenericDrug[]>('/generic-drugs', { params }),
  get:    (id: number) => http.get<GenericDrug>(`/generic-drugs/${id}`),
  create: (body: GenericDrugCreate) => http.post<GenericDrug>('/generic-drugs', body),
  delete: (id: number) => http.delete(`/generic-drugs/${id}`),
  import: (file: File) => {
    const fd = new FormData(); fd.append('file', file);
    return http.post<ImportResult>('/generic-drugs/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
};

// ── Medicines ─────────────────────────────────────────────────────────
export const medicinesApi = {
  list:   (params?: { search?: string; generic_id?: number; expired?: boolean; status?: boolean }) =>
            http.get<Medicine[]>('/medicines', { params }),
  get:    (id: number) => http.get<Medicine>(`/medicines/${id}`),
  create: (body: MedicineCreate) => http.post<Medicine>('/medicines', body),
  update: (id: number, body: MedicineUpdate) => http.put<Medicine>(`/medicines/${id}`, body),
  delete: (id: number) => http.delete(`/medicines/${id}`),
  import: (file: File) => {
    const fd = new FormData(); fd.append('file', file);
    return http.post<ImportResult>('/medicines/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
};

// ── Dose Patterns ─────────────────────────────────────────────────────
export const dosePatternsApi = {
  list:   (params?: { search?: string; status?: boolean }) => http.get<DosePattern[]>('/dose-patterns', { params }),
  get:    (id: number) => http.get<DosePattern>(`/dose-patterns/${id}`),
  create: (body: DosePatternCreate) => http.post<DosePattern>('/dose-patterns', body),
  update: (id: number, body: DosePatternCreate) => http.put<DosePattern>(`/dose-patterns/${id}`, body),
  delete: (id: number) => http.delete(`/dose-patterns/${id}`),
};

// ── Generation ────────────────────────────────────────────────────────
export const generationApi = {
  random: (body: GenerationRequest) => http.post<GenerationResponse>('/generation/random', body),
};

// ── Bills ─────────────────────────────────────────────────────────────
export const billsApi = {
  list:   (params?: { bill_type?: BillType; search?: string; limit?: number; offset?: number }) =>
            http.get<Bill[]>('/bills', { params }),
  get:    (id: number) => http.get<Bill>(`/bills/${id}`),
  pdfUrl: (id: number) => `/api/bills/${id}/pdf`,
  manual: (body: ManualBillCreate) => http.post<Bill>('/bills/manual', body),
};
