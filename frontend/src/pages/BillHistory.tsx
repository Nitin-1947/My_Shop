import React, { useCallback, useEffect, useState } from 'react';
import { History, Search, Download, ChevronDown, ChevronUp, Filter } from 'lucide-react';
import { billsApi } from '../services/api';
import type { Bill, BillType } from '../types';
import StatusBadge from '../components/common/StatusBadge';

const fmtCurr = (s: string) => `₹${parseFloat(s).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

export default function BillHistory() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<BillType | ''>('');
  const [expanded, setExpanded] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const load = useCallback(async (q: string, type: BillType | '', p: number) => {
    setLoading(true);
    try {
      const params: any = { limit: PAGE_SIZE, offset: p * PAGE_SIZE };
      if (q) params.search = q;
      if (type) params.bill_type = type;
      const res = await billsApi.list(params);
      setBills(res.data);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(search, filterType, page); }, []);

  const handleSearch = (q: string) => { setSearch(q); setPage(0); load(q, filterType, 0); };
  const handleType = (t: BillType | '') => { setFilterType(t); setPage(0); load(search, t, 0); };

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <div>
          <h1 className="page-title"><History size={26} />Bill History</h1>
          <p className="page-subtitle">{bills.length} bills shown (max 50 per page)</p>
        </div>
      </div>

      <div className="card">
        {/* Toolbar */}
        <div className="card-header" style={{ flexWrap: 'wrap', gap: 12 }}>
          <span className="card-title"><Filter size={16} />Filter & Search</span>
          <div className="flex gap-3 items-center" style={{ flexWrap: 'wrap' }}>
            {/* Type filter */}
            <div style={{ display: 'flex', gap: 6 }}>
              {(['', 'SIMULATED', 'MANUAL'] as const).map(t => (
                <button
                  key={t}
                  className={`btn btn-sm ${filterType === t ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => handleType(t)}
                >
                  {t === '' ? 'All' : t}
                </button>
              ))}
            </div>
            <div className="search-bar">
              <Search size={16} />
              <input
                placeholder="Search bill number…"
                value={search}
                onChange={e => handleSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="table-wrap">
          {loading ? (
            <div className="loading-overlay"><div className="spinner" /></div>
          ) : bills.length === 0 ? (
            <div className="empty-state">
              <History size={40} />
              <h3>No bills found</h3>
              <p>Generate some simulated bills or create a manual bill to see history.</p>
            </div>
          ) : (
            <div>
              {bills.map(bill => (
                <div key={bill.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  {/* Row */}
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', cursor: 'pointer' }}
                    onClick={() => setExpanded(expanded === bill.id ? null : bill.id)}
                  >
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--teal-300)', minWidth: 190 }}>
                      {bill.bill_number}
                    </div>
                    <StatusBadge billType={bill.bill_type} />
                    <StatusBadge mode={bill.generation_mode} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{bill.patient_name ?? '—'}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Dr. {bill.doctor_name ?? '—'}</div>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                      {new Date(bill.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </div>
                    <div style={{ fontWeight: 700, minWidth: 110, textAlign: 'right', color: 'var(--color-text-primary)' }}>
                      {fmtCurr(bill.total_amount)}
                    </div>
                    <a
                      href={`/api/bills/${bill.id}/pdf`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-ghost btn-sm"
                      onClick={e => e.stopPropagation()}
                      title="Download PDF"
                    >
                      <Download size={14} />
                    </a>
                    {expanded === bill.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>

                  {/* Expanded detail */}
                  {expanded === bill.id && (
                    <div style={{ background: 'var(--color-surface-2)', padding: '4px 20px 16px' }}>
                      <table className="data-table" style={{ marginTop: 8 }}>
                        <thead>
                          <tr><th>#</th><th>Medicine</th><th>Generic</th><th>Batch</th><th>Expiry</th><th>Unit</th><th>Qty</th><th>MRP</th><th>Amount</th></tr>
                        </thead>
                        <tbody>
                          {bill.items.map((item, i) => (
                            <tr key={item.id}>
                              <td className="text-muted text-xs">{i + 1}</td>
                              <td className="font-semibold">{item.medicine_name}</td>
                              <td className="text-secondary text-xs">{item.generic_name}</td>
                              <td className="font-mono text-xs">{item.batch_number}</td>
                              <td className="text-xs">{item.expiry_date}</td>
                              <td className="text-xs">{item.unit}</td>
                              <td>{item.quantity}</td>
                              <td>₹{parseFloat(item.mrp).toFixed(2)}</td>
                              <td className="font-semibold">{fmtCurr(item.line_total)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div style={{ marginTop: 10, textAlign: 'right', fontSize: '0.85rem', display: 'flex', gap: 16, justifyContent: 'flex-end' }}>
                        <span className="text-secondary">Subtotal: <strong>{fmtCurr(bill.subtotal)}</strong></span>
                        {parseFloat(bill.discount) > 0 && <span className="text-secondary">Discount: <strong>- {fmtCurr(bill.discount)}</strong></span>}
                        <span>Total: <strong style={{ color: 'var(--teal-300)', fontSize: '1rem' }}>{fmtCurr(bill.total_amount)}</strong></span>
                      </div>
                      {bill.notes && <p className="text-xs text-muted" style={{ marginTop: 8 }}>📝 {bill.notes}</p>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {bills.length === PAGE_SIZE && (
          <div style={{ padding: '12px 20px', borderTop: '1px solid var(--color-border)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary btn-sm" disabled={page === 0} onClick={() => { const p = page - 1; setPage(p); load(search, filterType, p); }}>← Previous</button>
            <span className="text-muted text-sm" style={{ alignSelf: 'center' }}>Page {page + 1}</span>
            <button className="btn btn-secondary btn-sm" onClick={() => { const p = page + 1; setPage(p); load(search, filterType, p); }}>Next →</button>
          </div>
        )}
      </div>
    </div>
  );
}
