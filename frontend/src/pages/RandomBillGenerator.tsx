import React, { useState } from 'react';
import { Zap, Settings, RefreshCw, Download, ChevronDown, ChevronUp, AlertTriangle, Check } from 'lucide-react';
import { generationApi } from '../services/api';
import type { Bill, GenerationRequest } from '../types';
import StatusBadge from '../components/common/StatusBadge';

const fmtCurr = (s: string) => `₹${parseFloat(s).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

export default function RandomBillGenerator() {
  const [req, setReq] = useState<GenerationRequest>({ count: 5, seed: undefined, dose_ratio: 0.5 });
  const [useSeed, setUseSeed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ generated: number; skipped: number; bills: Bill[] } | null>(null);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);

  const generate = async () => {
    setLoading(true); setError(''); setResult(null); setExpanded(null);
    try {
      const payload: GenerationRequest = { count: req.count, dose_ratio: req.dose_ratio };
      if (useSeed && req.seed !== undefined) payload.seed = req.seed;
      const res = await generationApi.random(payload);
      setResult(res.data);
    } catch (e: any) {
      setError(e.response?.data?.detail ?? 'Generation failed. Ensure seed data exists (run seed.py).');
    } finally { setLoading(false); }
  };

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <div>
          <h1 className="page-title"><Zap size={26} />Random Bill Generator</h1>
          <p className="page-subtitle">Generate deterministic simulated bills using the rule engine — no AI, no internet</p>
        </div>
      </div>

      {/* Controls */}
      <div className="card mb-6">
        <div className="card-header">
          <span className="card-title"><Settings size={18} />Generation Parameters</span>
        </div>
        <div className="card-body">
          <div className="grid-3" style={{ gap: 20 }}>
            {/* Count */}
            <div className="form-group">
              <label className="form-label">Bill Count (1–100)</label>
              <input
                id="bill-count"
                className="form-input"
                type="number" min={1} max={100}
                value={req.count}
                onChange={e => setReq(r => ({ ...r, count: Math.min(100, Math.max(1, +e.target.value)) }))}
              />
            </div>

            {/* Dose ratio */}
            <div className="form-group">
              <label className="form-label">Dose Ratio: {Math.round(req.dose_ratio! * 100)}% Dose / {100 - Math.round(req.dose_ratio! * 100)}% Generic</label>
              <input
                id="dose-ratio"
                type="range" min={0} max={1} step={0.05}
                value={req.dose_ratio}
                onChange={e => setReq(r => ({ ...r, dose_ratio: parseFloat(e.target.value) }))}
                style={{ width: '100%', accentColor: 'var(--teal-600)', marginTop: 6 }}
              />
              <div className="flex justify-between text-xs text-muted" style={{ marginTop: 4 }}>
                <span>0% Dose</span><span>50/50</span><span>100% Dose</span>
              </div>
            </div>

            {/* Seed */}
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={useSeed} onChange={e => setUseSeed(e.target.checked)} />
                Use Fixed Seed (reproducible)
              </label>
              <input
                id="seed-input"
                className="form-input"
                type="number"
                disabled={!useSeed}
                value={req.seed ?? ''}
                onChange={e => setReq(r => ({ ...r, seed: e.target.value ? +e.target.value : undefined }))}
                placeholder="e.g. 42"
                style={{ opacity: useSeed ? 1 : 0.4 }}
              />
              {useSeed && <p className="text-xs text-muted" style={{ marginTop: 4 }}>Same seed + same data = identical output every time.</p>}
            </div>
          </div>

          <div style={{ marginTop: 20, display: 'flex', gap: 12 }}>
            <button
              id="generate-btn"
              className="btn btn-primary btn-lg"
              onClick={generate}
              disabled={loading}
              style={{ minWidth: 180 }}
            >
              {loading ? <><div className="spinner" style={{ width: 18, height: 18 }} />Generating…</> : <><Zap size={18} />Generate {req.count} Bill{req.count !== 1 ? 's' : ''}</>}
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="alert alert-error mb-4">
          <AlertTriangle size={18} />
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div>
          {/* Summary banner */}
          <div className="alert alert-success mb-4" style={{ alignItems: 'center' }}>
            <Check size={18} />
            <span>
              <strong>{result.generated} bills generated</strong>
              {result.skipped > 0 && ` · ${result.skipped} skipped (no eligible medicines)`}
              {` · `}
              <span className="text-xs">
                {result.bills.filter(b => b.generation_mode === 'DOSE').length} Dose-based,{' '}
                {result.bills.filter(b => b.generation_mode === 'GENERIC').length} Generic-based
              </span>
            </span>
          </div>

          {/* Bill cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {result.bills.map((bill, idx) => (
              <div key={bill.id} className="card">
                {/* Bill card header */}
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', cursor: 'pointer' }}
                  onClick={() => setExpanded(expanded === bill.id ? null : bill.id)}
                >
                  <div style={{ minWidth: 28, color: 'var(--color-text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>#{idx + 1}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--teal-300)', minWidth: 180 }}>{bill.bill_number}</div>
                  <StatusBadge billType={bill.bill_type} />
                  <StatusBadge mode={bill.generation_mode} />
                  <div style={{ flex: 1, fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                    {bill.patient_name} · Dr. {bill.doctor_name}
                  </div>
                  <div style={{ fontWeight: 700, color: 'var(--color-text-primary)', marginRight: 8 }}>
                    {fmtCurr(bill.total_amount)}
                  </div>
                  <a
                    href={`/api/bills/${bill.id}/pdf`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-secondary btn-sm"
                    onClick={e => e.stopPropagation()}
                    title="Download PDF"
                  >
                    <Download size={14} /> PDF
                  </a>
                  {expanded === bill.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>

                {/* Expanded items */}
                {expanded === bill.id && (
                  <div style={{ borderTop: '1px solid var(--color-border)', padding: '0 20px 16px', background: 'var(--color-surface-2)' }}>
                    <table className="data-table" style={{ marginTop: 12 }}>
                      <thead>
                        <tr>
                          <th>#</th><th>Medicine</th><th>Generic</th><th>Batch</th><th>Expiry</th><th>Qty</th><th>MRP</th><th>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bill.items.map((item, i) => (
                          <tr key={item.id}>
                            <td className="text-muted text-xs">{i + 1}</td>
                            <td className="font-semibold">{item.medicine_name}</td>
                            <td className="text-secondary text-xs">{item.generic_name}</td>
                            <td className="font-mono text-xs">{item.batch_number}</td>
                            <td className="text-xs">{item.expiry_date}</td>
                            <td>{item.quantity}</td>
                            <td>₹{parseFloat(item.mrp).toFixed(2)}</td>
                            <td className="font-semibold">{fmtCurr(item.line_total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div style={{ marginTop: 12, textAlign: 'right' }}>
                      <span className="text-secondary text-sm">Total: </span>
                      <strong style={{ fontSize: '1.1rem', color: 'var(--teal-300)' }}>{fmtCurr(bill.total_amount)}</strong>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tip when empty */}
      {!result && !loading && !error && (
        <div className="card">
          <div className="empty-state">
            <Zap size={48} />
            <h3>Ready to Generate</h3>
            <p>Configure the parameters above and click <strong>Generate Bills</strong>.</p>
            <p className="text-xs" style={{ marginTop: 8 }}>
              Bills are tagged SIMULATED. PDFs include a diagonal watermark. No AI is involved.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
