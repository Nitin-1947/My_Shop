import React, { useEffect, useRef, useState } from 'react';
import { FlaskConical, Plus, Search, Upload, Trash2, X, Check } from 'lucide-react';
import { genericDrugsApi } from '../services/api';
import type { GenericDrug, GenericDrugCreate } from '../types';

export default function GenericDrugs() {
  const [generics, setGenerics] = useState<GenericDrug[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<GenericDrugCreate>({ generic_code: '', name: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [importResult, setImportResult] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async (q?: string) => {
    setLoading(true);
    try { const res = await genericDrugsApi.list(q ? { search: q } : undefined); setGenerics(res.data); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true); setError('');
    try { await genericDrugsApi.create(form); setShowModal(false); load(search); }
    catch (e: any) { setError(e.response?.data?.detail ?? 'Save failed'); }
    finally { setSaving(false); }
  };

  const remove = async (g: GenericDrug) => {
    if (!confirm(`Delete generic drug "${g.name}"? This may affect linked medicines.`)) return;
    try { await genericDrugsApi.delete(g.id); load(search); }
    catch (e: any) { alert(e.response?.data?.detail ?? 'Delete failed'); }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    try { const res = await genericDrugsApi.import(file); const d = res.data; setImportResult(`✓ Imported ${d.inserted} generics, ${d.skipped} skipped`); load(search); }
    catch { setImportResult('Import failed'); }
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <div>
          <h1 className="page-title"><FlaskConical size={26} />Generic Drugs</h1>
          <p className="page-subtitle">{generics.length} records — used for duplicate-drug detection</p>
        </div>
        <div className="page-actions">
          <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleImport} id="generic-csv-input" />
          <label htmlFor="generic-csv-input" className="btn btn-secondary" style={{ cursor: 'pointer' }}><Upload size={16} />Import CSV</label>
          <button className="btn btn-primary" onClick={() => { setForm({ generic_code: '', name: '' }); setError(''); setShowModal(true); }}><Plus size={16} />Add Generic</button>
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
          <span className="card-title">All Generic Drugs</span>
          <div className="search-bar">
            <Search size={16} />
            <input placeholder="Search name or code…" value={search} onChange={e => { setSearch(e.target.value); load(e.target.value); }} />
          </div>
        </div>
        <div className="table-wrap">
          {loading ? <div className="loading-overlay"><div className="spinner" /></div>
          : generics.length === 0 ? <div className="empty-state"><FlaskConical size={40} /><h3>No generic drugs</h3><p>Add generics or import the sample CSV.</p></div>
          : (
            <table className="data-table">
              <thead><tr><th>#</th><th>Code</th><th>Generic Drug Name</th><th>Added</th><th>Actions</th></tr></thead>
              <tbody>
                {generics.map((g, i) => (
                  <tr key={g.id}>
                    <td className="text-muted text-xs">{i + 1}</td>
                    <td className="font-mono text-xs" style={{ color: 'var(--teal-300)' }}>{g.generic_code}</td>
                    <td className="font-semibold">{g.name}</td>
                    <td className="text-muted text-xs">{new Date(g.created_at).toLocaleDateString('en-IN')}</td>
                    <td>
                      <button className="btn btn-danger btn-sm btn-icon" onClick={() => remove(g)} title="Delete"><Trash2 size={14} /></button>
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
              <h2><FlaskConical size={18} />New Generic Drug</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-error"><X size={16} />{error}</div>}
              <div className="form-group">
                <label className="form-label">Generic Code *</label>
                <input className="form-input" value={form.generic_code} onChange={e => setForm(f => ({ ...f, generic_code: e.target.value }))} placeholder="GEN-031" />
              </div>
              <div className="form-group">
                <label className="form-label">Generic Drug Name *</label>
                <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Paracetamol" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
