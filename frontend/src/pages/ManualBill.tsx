import React, { useEffect, useState } from 'react';
import { FileText, Plus, Trash2, X, Check, AlertTriangle, Download } from 'lucide-react';
import { billsApi, doctorsApi, medicinesApi, patientsApi } from '../services/api';
import type { Bill, Doctor, ManualBillCreate, ManualBillItem, Medicine, Patient } from '../types';
import StatusBadge from '../components/common/StatusBadge';

const fmtCurr = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

export default function ManualBill() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [patientId, setPatientId] = useState<number>(0);
  const [doctorId, setDoctorId] = useState<number>(0);
  const [items, setItems] = useState<ManualBillItem[]>([{ medicine_id: 0, quantity: 1 }]);
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [createdBill, setCreatedBill] = useState<Bill | null>(null);

  useEffect(() => {
    patientsApi.list({ status: true }).then(r => { setPatients(r.data); if (r.data[0]) setPatientId(r.data[0].id); });
    doctorsApi.list({ status: true }).then(r => { setDoctors(r.data); if (r.data[0]) setDoctorId(r.data[0].id); });
    medicinesApi.list({ status: true, expired: false }).then(r => { setMedicines(r.data); if (r.data[0]) setItems([{ medicine_id: r.data[0].id, quantity: 1 }]); });
  }, []);

  const addItem = () => setItems(prev => [...prev, { medicine_id: medicines[0]?.id ?? 0, quantity: 1 }]);
  const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: keyof ManualBillItem, val: number) =>
    setItems(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: val } : item));

  const getMed = (id: number) => medicines.find(m => m.id === id);

  const subtotal = items.reduce((sum, item) => {
    const med = getMed(item.medicine_id);
    return sum + (med ? parseFloat(med.mrp) * item.quantity : 0);
  }, 0);
  const total = Math.max(0, subtotal - discount);

  const submit = async () => {
    if (!patientId || !doctorId) { setError('Select a patient and doctor.'); return; }
    if (items.some(i => !i.medicine_id || i.quantity <= 0)) { setError('All items must have a medicine and quantity > 0.'); return; }
    setSubmitting(true); setError('');
    const body: ManualBillCreate = { patient_id: patientId, doctor_id: doctorId, items, discount, notes: notes || undefined };
    try {
      const res = await billsApi.manual(body);
      setCreatedBill(res.data);
    } catch (e: any) {
      setError(e.response?.data?.detail ?? 'Bill creation failed.');
    } finally { setSubmitting(false); }
  };

  const reset = () => {
    setCreatedBill(null); setError('');
    setItems([{ medicine_id: medicines[0]?.id ?? 0, quantity: 1 }]);
    setDiscount(0); setNotes('');
  };

  // ── Success state ────────────────────────────────────────────────────
  if (createdBill) {
    return (
      <div className="page-wrapper">
        <div className="page-header">
          <h1 className="page-title"><FileText size={26} />Manual Bill</h1>
        </div>
        <div className="card" style={{ maxWidth: 640, margin: '0 auto' }}>
          <div className="card-body" style={{ textAlign: 'center', padding: '40px 32px' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--color-success-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <Check size={32} color="var(--green-600)" />
            </div>
            <h2 style={{ fontSize: '1.25rem', marginBottom: 8 }}>Bill Created!</h2>
            <div className="font-mono text-xs" style={{ color: 'var(--teal-300)', fontSize: '1rem', marginBottom: 16 }}>{createdBill.bill_number}</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 24 }}>
              <StatusBadge billType={createdBill.bill_type} />
            </div>
            <p className="text-secondary" style={{ marginBottom: 24 }}>
              Patient: <strong>{createdBill.patient_name}</strong> · Dr. {createdBill.doctor_name}<br />
              Total: <strong style={{ color: 'var(--teal-300)', fontSize: '1.1rem' }}>₹{parseFloat(createdBill.total_amount).toFixed(2)}</strong>
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <a href={`/api/bills/${createdBill.id}/pdf`} target="_blank" rel="noreferrer" className="btn btn-primary">
                <Download size={16} /> Download PDF
              </a>
              <button className="btn btn-secondary" onClick={reset}><Plus size={16} />New Bill</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <div>
          <h1 className="page-title"><FileText size={26} />Manual Bill</h1>
          <p className="page-subtitle">Create a real prescription bill — no duplicate-generic restriction applies</p>
        </div>
      </div>

      {error && (
        <div className="alert alert-error mb-4"><AlertTriangle size={16} />{error}<button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setError('')}><X size={14} /></button></div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, alignItems: 'start' }}>
        {/* Left: form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Patient & Doctor */}
          <div className="card">
            <div className="card-header"><span className="card-title">Bill Details</span></div>
            <div className="card-body">
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Patient *</label>
                  <select id="patient-select" className="form-select" value={patientId} onChange={e => setPatientId(+e.target.value)}>
                    <option value={0}>Select patient…</option>
                    {patients.map(p => <option key={p.id} value={p.id}>{p.name} ({p.patient_code})</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Doctor *</label>
                  <select id="doctor-select" className="form-select" value={doctorId} onChange={e => setDoctorId(+e.target.value)}>
                    <option value={0}>Select doctor…</option>
                    {doctors.map(d => <option key={d.id} value={d.id}>Dr. {d.name} — {d.specialization ?? 'General'}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group" style={{ marginTop: 12 }}>
                <label className="form-label">Notes (optional)</label>
                <textarea className="form-textarea" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Prescription notes, remarks…" />
              </div>
            </div>
          </div>

          {/* Line items */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Medicines</span>
              <button className="btn btn-secondary btn-sm" onClick={addItem}><Plus size={14} />Add Row</button>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              <table className="data-table">
                <thead>
                  <tr><th>Medicine</th><th>Generic</th><th style={{ width: 90 }}>Qty</th><th>MRP</th><th>Amount</th><th></th></tr>
                </thead>
                <tbody>
                  {items.map((item, i) => {
                    const med = getMed(item.medicine_id);
                    return (
                      <tr key={i}>
                        <td style={{ minWidth: 200 }}>
                          <select
                            className="form-select"
                            value={item.medicine_id}
                            onChange={e => updateItem(i, 'medicine_id', +e.target.value)}
                            style={{ fontSize: '0.8rem', padding: '4px 8px' }}
                          >
                            {medicines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                          </select>
                        </td>
                        <td className="text-xs text-secondary">{med?.generic_name ?? '—'}</td>
                        <td>
                          <input
                            className="form-input"
                            type="number" min={1}
                            value={item.quantity}
                            onChange={e => updateItem(i, 'quantity', Math.max(1, +e.target.value))}
                            style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                          />
                        </td>
                        <td className="text-xs">₹{med ? parseFloat(med.mrp).toFixed(2) : '—'}</td>
                        <td className="font-semibold text-xs">
                          {med ? fmtCurr(parseFloat(med.mrp) * item.quantity) : '—'}
                        </td>
                        <td>
                          <button className="btn btn-danger btn-sm btn-icon" onClick={() => removeItem(i)} disabled={items.length === 1}>
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right: summary */}
        <div className="card" style={{ position: 'sticky', top: 24 }}>
          <div className="card-header"><span className="card-title">Summary</span></div>
          <div className="card-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span className="text-secondary">Subtotal</span>
                <span>{fmtCurr(subtotal)}</span>
              </div>
              <div className="form-group">
                <label className="form-label">Discount (₹)</label>
                <input className="form-input" type="number" min={0} step={0.5} value={discount} onChange={e => setDiscount(parseFloat(e.target.value) || 0)} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', fontWeight: 700, borderTop: '1px solid var(--color-border)', paddingTop: 12 }}>
                <span>Total</span>
                <span style={{ color: 'var(--teal-300)' }}>{fmtCurr(total)}</span>
              </div>
              <div style={{ marginTop: 4 }}>
                <span className="badge badge-manual" style={{ display: 'inline-flex' }}>MANUAL BILL</span>
              </div>
              <button
                id="create-bill-btn"
                className="btn btn-primary w-full"
                style={{ marginTop: 8, justifyContent: 'center' }}
                onClick={submit}
                disabled={submitting}
              >
                {submitting ? <><div className="spinner" style={{ width: 18, height: 18 }} />Creating…</> : <><Check size={16} />Create Bill</>}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
