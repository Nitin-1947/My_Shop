import React, { useEffect, useRef, useState } from 'react';
import { Users, Plus, Search, Upload, Pencil, Trash2, X, Check } from 'lucide-react';
import { patientsApi } from '../services/api';
import type { Patient, PatientCreate, PatientUpdate } from '../types';
import StatusBadge from '../components/common/StatusBadge';

const GENDER_LABELS: Record<string, string> = { MALE: 'Male', FEMALE: 'Female', OTHER: 'Other' };

export default function Patients() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Patient | null>(null);
  const [form, setForm] = useState<PatientCreate>({ patient_code: '', name: '', status: true });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [importResult, setImportResult] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async (q?: string) => {
    setLoading(true);
    try {
      const res = await patientsApi.list(q ? { search: q } : undefined);
      setPatients(res.data);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ patient_code: '', name: '', status: true });
    setError('');
    setShowModal(true);
  };

  const openEdit = (p: Patient) => {
    setEditing(p);
    setForm({ patient_code: p.patient_code, name: p.name, age: p.age ?? undefined, gender: p.gender ?? undefined, phone: p.phone ?? undefined, address: p.address ?? undefined, status: p.status });
    setError('');
    setShowModal(true);
  };

  const save = async () => {
    setSaving(true); setError('');
    try {
      if (editing) {
        const u: PatientUpdate = { name: form.name, age: form.age, gender: form.gender, phone: form.phone, address: form.address, status: form.status };
        await patientsApi.update(editing.id, u);
      } else {
        await patientsApi.create(form);
      }
      setShowModal(false);
      load(search);
    } catch (e: any) {
      setError(e.response?.data?.detail ?? 'Save failed');
    } finally { setSaving(false); }
  };

  const remove = async (p: Patient) => {
    if (!confirm(`Delete patient "${p.name}"?`)) return;
    await patientsApi.delete(p.id);
    load(search);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await patientsApi.import(file);
      const d = res.data;
      setImportResult(`✓ Imported ${d.inserted} patients, ${d.skipped} skipped${d.errors.length ? `. Errors: ${d.errors.slice(0,3).join('; ')}` : ''}`);
      load(search);
    } catch { setImportResult('Import failed'); }
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <div>
          <h1 className="page-title"><Users size={26} />Patients</h1>
          <p className="page-subtitle">{patients.length} records</p>
        </div>
        <div className="page-actions">
          <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleImport} id="patient-csv-input" />
          <label htmlFor="patient-csv-input" className="btn btn-secondary" style={{ cursor: 'pointer' }}>
            <Upload size={16} /> Import CSV
          </label>
          <button className="btn btn-primary" onClick={openCreate}><Plus size={16} />Add Patient</button>
        </div>
      </div>

      {importResult && (
        <div className="alert alert-success mb-4">
          <Check size={16} />{importResult}
          <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setImportResult('')}><X size={14} /></button>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <span className="card-title">All Patients</span>
          <div className="search-bar">
            <Search size={16} />
            <input
              placeholder="Search name or code…"
              value={search}
              onChange={e => { setSearch(e.target.value); load(e.target.value); }}
            />
          </div>
        </div>
        <div className="table-wrap">
          {loading ? (
            <div className="loading-overlay"><div className="spinner" /></div>
          ) : patients.length === 0 ? (
            <div className="empty-state"><Users size={40} /><h3>No patients found</h3><p>Add patients manually or import a CSV file.</p></div>
          ) : (
            <table className="data-table">
              <thead><tr>
                <th>Code</th><th>Name</th><th>Age</th><th>Gender</th><th>Phone</th><th>Status</th><th>Actions</th>
              </tr></thead>
              <tbody>
                {patients.map(p => (
                  <tr key={p.id}>
                    <td className="font-mono text-xs" style={{ color: 'var(--teal-300)' }}>{p.patient_code}</td>
                    <td className="font-semibold">{p.name}</td>
                    <td>{p.age ?? '—'}</td>
                    <td>{p.gender ? GENDER_LABELS[p.gender] : '—'}</td>
                    <td>{p.phone ?? '—'}</td>
                    <td><StatusBadge active={p.status} /></td>
                    <td>
                      <div className="flex gap-2">
                        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(p)} title="Edit"><Pencil size={14} /></button>
                        <button className="btn btn-danger btn-sm btn-icon" onClick={() => remove(p)} title="Delete"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2><Users size={18} />{editing ? 'Edit Patient' : 'New Patient'}</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-error"><X size={16} />{error}</div>}
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Patient Code *</label>
                  <input className="form-input" value={form.patient_code} onChange={e => setForm(f => ({ ...f, patient_code: e.target.value }))} disabled={!!editing} placeholder="PAT-001" />
                </div>
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="John Doe" />
                </div>
                <div className="form-group">
                  <label className="form-label">Age</label>
                  <input className="form-input" type="number" value={form.age ?? ''} onChange={e => setForm(f => ({ ...f, age: e.target.value ? +e.target.value : undefined }))} placeholder="35" />
                </div>
                <div className="form-group">
                  <label className="form-label">Gender</label>
                  <select className="form-select" value={form.gender ?? ''} onChange={e => setForm(f => ({ ...f, gender: e.target.value as any || undefined }))}>
                    <option value="">Select…</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input className="form-input" value={form.phone ?? ''} onChange={e => setForm(f => ({ ...f, phone: e.target.value || undefined }))} placeholder="+91 98765 43210" />
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-select" value={form.status ? 'true' : 'false'} onChange={e => setForm(f => ({ ...f, status: e.target.value === 'true' }))}>
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Address</label>
                <textarea className="form-textarea" rows={2} value={form.address ?? ''} onChange={e => setForm(f => ({ ...f, address: e.target.value || undefined }))} placeholder="Full address…" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Patient'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
