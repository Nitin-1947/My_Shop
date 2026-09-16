import React, { useEffect, useState } from 'react';
import { ClipboardList, Plus, Search, Trash2, X, ChevronDown, ChevronUp, Pencil } from 'lucide-react';
import { dosePatternsApi, medicinesApi } from '../services/api';
import type { DosePattern, DosePatternCreate, Medicine } from '../types';
import StatusBadge from '../components/common/StatusBadge';

export default function DosePatterns() {
  const [patterns, setPatterns] = useState<DosePattern[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<DosePattern | null>(null);
  const [form, setForm] = useState<DosePatternCreate>({ name: '', illness_name: '', status: true, items: [] });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async (q?: string) => {
    setLoading(true);
    try { const res = await dosePatternsApi.list(q ? { search: q } : undefined); setPatterns(res.data); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    medicinesApi.list({ status: true, expired: false }).then(r => setMedicines(r.data));
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', illness_name: '', status: true, items: [] });
    setError(''); setShowModal(true);
  };

  const openEdit = (dp: DosePattern) => {
    setEditing(dp);
    setForm({ name: dp.name, illness_name: dp.illness_name, status: dp.status, items: dp.items.map(i => ({ medicine_id: i.medicine_id, quantity: i.quantity })) });
    setError(''); setShowModal(true);
  };

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { medicine_id: medicines[0]?.id ?? 0, quantity: 1 }] }));
  const removeItem = (i: number) => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));
  const updateItem = (i: number, field: 'medicine_id' | 'quantity', val: number) =>
    setForm(f => ({ ...f, items: f.items.map((item, idx) => idx === i ? { ...item, [field]: val } : item) }));

  const save = async () => {
    setSaving(true); setError('');
    try {
      if (editing) { await dosePatternsApi.update(editing.id, form); }
      else { await dosePatternsApi.create(form); }
      setShowModal(false); load(search);
    } catch (e: any) { setError(e.response?.data?.detail ?? 'Save failed'); }
    finally { setSaving(false); }
  };

  const remove = async (dp: DosePattern) => {
    if (!confirm(`Delete dose pattern "${dp.name}"?`)) return;
    await dosePatternsApi.delete(dp.id); load(search);
  };

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <div>
          <h1 className="page-title"><ClipboardList size={26} />Dose Patterns</h1>
          <p className="page-subtitle">{patterns.length} patterns — illness → medicine → quantity mappings</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={openCreate}><Plus size={16} />New Pattern</button>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">All Dose Patterns</span>
          <div className="search-bar">
            <Search size={16} />
            <input placeholder="Search illness or name…" value={search} onChange={e => { setSearch(e.target.value); load(e.target.value); }} />
          </div>
        </div>
        {loading ? <div className="loading-overlay"><div className="spinner" /></div>
        : patterns.length === 0 ? <div className="empty-state"><ClipboardList size={40} /><h3>No dose patterns</h3><p>Create patterns linking illnesses to medicines.</p></div>
        : (
          <div>
            {patterns.map(dp => (
              <div key={dp.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', cursor: 'pointer' }}
                  onClick={() => setExpanded(expanded === dp.id ? null : dp.id)}
                >
                  <div style={{ flex: 1 }}>
                    <div className="font-semibold">{dp.name}</div>
                    <div className="text-xs text-muted">{dp.illness_name} · {dp.items.length} medicines</div>
                  </div>
                  <StatusBadge active={dp.status} />
                  <button className="btn btn-ghost btn-sm btn-icon" onClick={e => { e.stopPropagation(); openEdit(dp); }}><Pencil size={14} /></button>
                  <button className="btn btn-danger btn-sm btn-icon" onClick={e => { e.stopPropagation(); remove(dp); }}><Trash2 size={14} /></button>
                  {expanded === dp.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
                {expanded === dp.id && (
                  <div style={{ padding: '0 20px 16px', background: 'var(--color-surface-2)' }}>
                    <table className="data-table" style={{ marginTop: 8 }}>
                      <thead><tr><th>#</th><th>Medicine</th><th>Quantity</th></tr></thead>
                      <tbody>
                        {dp.items.map((item, i) => (
                          <tr key={item.id}>
                            <td className="text-muted text-xs">{i + 1}</td>
                            <td>{item.medicine_name ?? `ID: ${item.medicine_id}`}</td>
                            <td>{item.quantity}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 700 }}>
            <div className="modal-header">
              <h2><ClipboardList size={18} />{editing ? 'Edit Pattern' : 'New Dose Pattern'}</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-error"><X size={16} />{error}</div>}
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Pattern Name *</label>
                  <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Fever & Pain Relief" />
                </div>
                <div className="form-group">
                  <label className="form-label">Illness Name *</label>
                  <input className="form-input" value={form.illness_name} onChange={e => setForm(f => ({ ...f, illness_name: e.target.value }))} placeholder="Fever" />
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-select" value={form.status ? 'true' : 'false'} onChange={e => setForm(f => ({ ...f, status: e.target.value === 'true' }))}>
                    <option value="true">Active</option><option value="false">Inactive</option>
                  </select>
                </div>
              </div>

              <div style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span className="form-label" style={{ margin: 0 }}>Medicines ({form.items.length})</span>
                  <button className="btn btn-secondary btn-sm" onClick={addItem}><Plus size={14} />Add Medicine</button>
                </div>
                {form.items.map((item, i) => (
                  <div key={i} className="flex gap-3 items-center" style={{ marginBottom: 8 }}>
                    <select className="form-select" style={{ flex: 1 }} value={item.medicine_id} onChange={e => updateItem(i, 'medicine_id', +e.target.value)}>
                      {medicines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                    <input className="form-input" type="number" min={1} value={item.quantity} onChange={e => updateItem(i, 'quantity', +e.target.value)} style={{ width: 80 }} placeholder="Qty" />
                    <button className="btn btn-danger btn-sm btn-icon" onClick={() => removeItem(i)}><X size={14} /></button>
                  </div>
                ))}
                {form.items.length === 0 && <p className="text-muted text-sm">No medicines added yet.</p>}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Pattern'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
