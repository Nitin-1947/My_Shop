import React, { useEffect, useRef, useState } from 'react';
import { Pill, Plus, Search, Upload, Pencil, Trash2, X, Check, AlertTriangle } from 'lucide-react';
import { medicinesApi, genericDrugsApi } from '../services/api';
import type { GenericDrug, Medicine, MedicineCreate, MedicineUnit } from '../types';
import StatusBadge from '../components/common/StatusBadge';

const UNITS: MedicineUnit[] = ['TABLET','CAPSULE','SYRUP','INJECTION','CREAM','DROPS','INHALER','SACHET','OTHER'];

export default function Medicines() {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [generics, setGenerics] = useState<GenericDrug[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterExpired, setFilterExpired] = useState<string>('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Medicine | null>(null);
  const [form, setForm] = useState<MedicineCreate>({ medicine_code:'', name:'', generic_drug_id:0, batch_number:'', expiry_date:'', mrp:0, unit:'TABLET', stock_qty:0, status:true });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [importResult, setImportResult] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async (q?: string, exp?: string) => {
    setLoading(true);
    const params: any = {};
    if (q) params.search = q;
    if (exp === 'true') params.expired = true;
    if (exp === 'false') params.expired = false;
    try { const res = await medicinesApi.list(params); setMedicines(res.data); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    genericDrugsApi.list().then(r => setGenerics(r.data));
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ medicine_code:'', name:'', generic_drug_id: generics[0]?.id ?? 0, batch_number:'', expiry_date:'', mrp:0, unit:'TABLET', stock_qty:0, status:true });
    setError(''); setShowModal(true);
  };

  const openEdit = (m: Medicine) => {
    setEditing(m);
    setForm({ medicine_code:m.medicine_code, name:m.name, generic_drug_id:m.generic_drug_id, batch_number:m.batch_number, expiry_date:m.expiry_date, mrp:parseFloat(m.mrp), unit:m.unit, stock_qty:m.stock_qty, status:m.status });
    setError(''); setShowModal(true);
  };

  const save = async () => {
    setSaving(true); setError('');
    try {
      if (editing) { await medicinesApi.update(editing.id, { name:form.name, batch_number:form.batch_number, expiry_date:form.expiry_date, mrp:form.mrp, unit:form.unit, stock_qty:form.stock_qty, status:form.status }); }
      else { await medicinesApi.create(form); }
      setShowModal(false); load(search, filterExpired);
    } catch (e: any) { setError(e.response?.data?.detail ?? 'Save failed'); }
    finally { setSaving(false); }
  };

  const remove = async (m: Medicine) => {
    if (!confirm(`Delete medicine "${m.name}"?`)) return;
    await medicinesApi.delete(m.id); load(search, filterExpired);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    try { const res = await medicinesApi.import(file); const d = res.data; setImportResult(`✓ Imported ${d.inserted} medicines, ${d.skipped} skipped${d.errors.length ? `. Errors: ${d.errors.slice(0,2).join('; ')}` : ''}`); load(search, filterExpired); }
    catch { setImportResult('Import failed'); }
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <div>
          <h1 className="page-title"><Pill size={26} />Medicines</h1>
          <p className="page-subtitle">{medicines.length} records</p>
        </div>
        <div className="page-actions">
          <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleImport} id="med-csv-input" />
          <label htmlFor="med-csv-input" className="btn btn-secondary" style={{ cursor: 'pointer' }}><Upload size={16} />Import CSV</label>
          <button className="btn btn-primary" onClick={openCreate}><Plus size={16} />Add Medicine</button>
        </div>
      </div>

      {importResult && (
        <div className="alert alert-success mb-4"><Check size={16} />{importResult}<button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setImportResult('')}><X size={14} /></button></div>
      )}

      <div className="card">
        <div className="card-header">
          <span className="card-title">All Medicines</span>
          <div className="flex gap-3 items-center">
            <select className="form-select" style={{ width: 'auto', padding: '6px 12px', fontSize: '0.8rem' }} value={filterExpired} onChange={e => { setFilterExpired(e.target.value); load(search, e.target.value); }}>
              <option value="">All</option>
              <option value="false">Valid only</option>
              <option value="true">Expired only</option>
            </select>
            <div className="search-bar">
              <Search size={16} />
              <input placeholder="Search name or code…" value={search} onChange={e => { setSearch(e.target.value); load(e.target.value, filterExpired); }} />
            </div>
          </div>
        </div>
        <div className="table-wrap">
          {loading ? <div className="loading-overlay"><div className="spinner" /></div>
          : medicines.length === 0 ? <div className="empty-state"><Pill size={40} /><h3>No medicines found</h3></div>
          : (
            <table className="data-table">
              <thead><tr><th>Code</th><th>Brand Name</th><th>Generic</th><th>Batch</th><th>Expiry</th><th>MRP</th><th>Unit</th><th>Stock</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {medicines.map(m => (
                  <tr key={m.id} style={m.is_expired ? { background: 'rgba(220,38,38,0.04)' } : undefined}>
                    <td className="font-mono text-xs" style={{ color: 'var(--teal-300)' }}>{m.medicine_code}</td>
                    <td className="font-semibold">{m.name}</td>
                    <td className="text-secondary text-xs">{m.generic_name ?? '—'}</td>
                    <td className="font-mono text-xs">{m.batch_number}</td>
                    <td>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {m.is_expired && <AlertTriangle size={12} color="var(--red-600)" />}
                        <StatusBadge expired={m.is_expired} />
                        <span className="text-xs text-muted" style={{ marginLeft: 4 }}>{m.expiry_date}</span>
                      </span>
                    </td>
                    <td className="font-semibold">₹{parseFloat(m.mrp).toFixed(2)}</td>
                    <td><span className="badge badge-inactive">{m.unit}</span></td>
                    <td>{m.stock_qty}</td>
                    <td><StatusBadge active={m.status} /></td>
                    <td>
                      <div className="flex gap-2">
                        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(m)}><Pencil size={14} /></button>
                        <button className="btn btn-danger btn-sm btn-icon" onClick={() => remove(m)}><Trash2 size={14} /></button>
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
          <div className="modal" style={{ maxWidth: 700 }}>
            <div className="modal-header">
              <h2><Pill size={18} />{editing ? 'Edit Medicine' : 'New Medicine'}</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-error"><X size={16} />{error}</div>}
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Medicine Code *</label>
                  <input className="form-input" value={form.medicine_code} onChange={e => setForm(f => ({ ...f, medicine_code: e.target.value }))} disabled={!!editing} placeholder="MED-051" />
                </div>
                <div className="form-group">
                  <label className="form-label">Brand Name *</label>
                  <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Crocin 500mg" />
                </div>
                <div className="form-group">
                  <label className="form-label">Generic Drug *</label>
                  <select className="form-select" value={form.generic_drug_id} onChange={e => setForm(f => ({ ...f, generic_drug_id: +e.target.value }))} disabled={!!editing}>
                    <option value={0}>Select generic…</option>
                    {generics.map(g => <option key={g.id} value={g.id}>{g.name} ({g.generic_code})</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Batch Number *</label>
                  <input className="form-input" value={form.batch_number} onChange={e => setForm(f => ({ ...f, batch_number: e.target.value }))} placeholder="BCH-2024-001" />
                </div>
                <div className="form-group">
                  <label className="form-label">Expiry Date *</label>
                  <input className="form-input" type="date" value={form.expiry_date} onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">MRP (₹) *</label>
                  <input className="form-input" type="number" step="0.01" value={form.mrp} onChange={e => setForm(f => ({ ...f, mrp: parseFloat(e.target.value) || 0 }))} placeholder="25.00" />
                </div>
                <div className="form-group">
                  <label className="form-label">Unit</label>
                  <select className="form-select" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value as MedicineUnit }))}>
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Stock Qty</label>
                  <input className="form-input" type="number" value={form.stock_qty} onChange={e => setForm(f => ({ ...f, stock_qty: +e.target.value }))} />
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
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Medicine'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
