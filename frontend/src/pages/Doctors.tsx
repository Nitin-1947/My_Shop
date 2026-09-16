import React, { useEffect, useRef, useState } from 'react';
import { Stethoscope, Plus, Search, Upload, Pencil, Trash2, X, Check } from 'lucide-react';
import { doctorsApi } from '../services/api';
import type { Doctor, DoctorCreate, DoctorUpdate } from '../types';
import StatusBadge from '../components/common/StatusBadge';

export default function Doctors() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Doctor | null>(null);
  const [form, setForm] = useState<DoctorCreate>({ doctor_code: '', name: '', status: true });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [importResult, setImportResult] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async (q?: string) => {
    setLoading(true);
    try { const res = await doctorsApi.list(q ? { search: q } : undefined); setDoctors(res.data); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm({ doctor_code: '', name: '', status: true }); setError(''); setShowModal(true); };
  const openEdit = (d: Doctor) => { setEditing(d); setForm({ doctor_code: d.doctor_code, name: d.name, specialization: d.specialization ?? undefined, phone: d.phone ?? undefined, status: d.status }); setError(''); setShowModal(true); };

  const save = async () => {
    setSaving(true); setError('');
    try {
      if (editing) { await doctorsApi.update(editing.id, { name: form.name, specialization: form.specialization, phone: form.phone, status: form.status } as DoctorUpdate); }
      else { await doctorsApi.create(form); }
      setShowModal(false); load(search);
    } catch (e: any) { setError(e.response?.data?.detail ?? 'Save failed'); }
    finally { setSaving(false); }
  };

  const remove = async (d: Doctor) => {
    if (!confirm(`Delete doctor "${d.name}"?`)) return;
    await doctorsApi.delete(d.id); load(search);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    try { const res = await doctorsApi.import(file); const d = res.data; setImportResult(`✓ Imported ${d.inserted} doctors, ${d.skipped} skipped`); load(search); }
    catch { setImportResult('Import failed'); }
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <div>
          <h1 className="page-title"><Stethoscope size={26} />Doctors</h1>
          <p className="page-subtitle">{doctors.length} records</p>
        </div>
        <div className="page-actions">
          <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleImport} id="doctor-csv-input" />
          <label htmlFor="doctor-csv-input" className="btn btn-secondary" style={{ cursor: 'pointer' }}><Upload size={16} />Import CSV</label>
          <button className="btn btn-primary" onClick={openCreate}><Plus size={16} />Add Doctor</button>
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
          <span className="card-title">All Doctors</span>
          <div className="search-bar">
            <Search size={16} />
            <input placeholder="Search name or code…" value={search} onChange={e => { setSearch(e.target.value); load(e.target.value); }} />
          </div>
        </div>
        <div className="table-wrap">
          {loading ? <div className="loading-overlay"><div className="spinner" /></div>
          : doctors.length === 0 ? <div className="empty-state"><Stethoscope size={40} /><h3>No doctors found</h3><p>Add or import doctors.</p></div>
          : (
            <table className="data-table">
              <thead><tr><th>Code</th><th>Name</th><th>Specialization</th><th>Phone</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {doctors.map(d => (
                  <tr key={d.id}>
                    <td className="font-mono text-xs" style={{ color: 'var(--teal-300)' }}>{d.doctor_code}</td>
                    <td className="font-semibold">Dr. {d.name}</td>
                    <td>{d.specialization ?? '—'}</td>
                    <td>{d.phone ?? '—'}</td>
                    <td><StatusBadge active={d.status} /></td>
                    <td>
                      <div className="flex gap-2">
                        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(d)}><Pencil size={14} /></button>
                        <button className="btn btn-danger btn-sm btn-icon" onClick={() => remove(d)}><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2><Stethoscope size={18} />{editing ? 'Edit Doctor' : 'New Doctor'}</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-error"><X size={16} />{error}</div>}
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Doctor Code *</label>
                  <input className="form-input" value={form.doctor_code} onChange={e => setForm(f => ({ ...f, doctor_code: e.target.value }))} disabled={!!editing} placeholder="DOC-001" />
                </div>
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Anil Kapoor" />
                </div>
                <div className="form-group">
                  <label className="form-label">Specialization</label>
                  <input className="form-input" value={form.specialization ?? ''} onChange={e => setForm(f => ({ ...f, specialization: e.target.value || undefined }))} placeholder="General Physician" />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input className="form-input" value={form.phone ?? ''} onChange={e => setForm(f => ({ ...f, phone: e.target.value || undefined }))} placeholder="+91 98765 43210" />
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-select" value={form.status ? 'true' : 'false'} onChange={e => setForm(f => ({ ...f, status: e.target.value === 'true' }))}>
                    <option value="true">Active</option><option value="false">Inactive</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Doctor'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
