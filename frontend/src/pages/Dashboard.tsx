import React, { useEffect, useState } from 'react';
import {
  LayoutDashboard, FileText, Users, Pill, Activity,
  TrendingUp, AlertTriangle, Zap, Clock,
} from 'lucide-react';
import { dashboardApi } from '../services/api';
import type { Bill, DashboardStats } from '../types';
import StatusBadge from '../components/common/StatusBadge';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recent, setRecent] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [s, r] = await Promise.all([
          dashboardApi.stats(),
          dashboardApi.recentBills(8),
        ]);
        setStats(s.data);
        setRecent(r.data);
      } catch {
        setError('Could not connect to backend. Make sure the FastAPI server is running on port 8000.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const fmt = (n: number) => n.toLocaleString('en-IN');
  const fmtCurr = (s: string) => `₹${parseFloat(s).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <LayoutDashboard size={26} />
            Dashboard
          </h1>
          <p className="page-subtitle">Overview of your medical shop billing system</p>
        </div>
        <div className="page-actions">
          <Link to="/generate" className="btn btn-primary">
            <Zap size={16} /> Generate Bills
          </Link>
        </div>
      </div>

      {error && (
        <div className="alert alert-error mb-6">
          <AlertTriangle size={18} />
          {error}
        </div>
      )}

      {loading ? (
        <div className="loading-overlay"><div className="spinner" /><span>Loading stats…</span></div>
      ) : stats && (
        <>
          {/* Stat cards */}
          <div className="grid-4 mb-6">
            <div className="stat-card teal">
              <div className="stat-icon" style={{ background: 'rgba(10,126,126,0.2)' }}>
                <FileText size={22} color="var(--teal-400)" />
              </div>
              <div className="stat-value">{fmt(stats.total_bills)}</div>
              <div className="stat-label">Total Bills</div>
            </div>
            <div className="stat-card navy">
              <div className="stat-icon" style={{ background: 'rgba(13,27,62,0.5)' }}>
                <Activity size={22} color="var(--teal-300)" />
              </div>
              <div className="stat-value">{fmt(stats.simulated_bills)}</div>
              <div className="stat-label">Simulated Bills</div>
            </div>
            <div className="stat-card green">
              <div className="stat-icon" style={{ background: 'rgba(22,163,74,0.15)' }}>
                <TrendingUp size={22} color="#86efac" />
              </div>
              <div className="stat-value">{fmt(stats.manual_bills)}</div>
              <div className="stat-label">Manual Bills</div>
            </div>
            <div className="stat-card amber">
              <div className="stat-icon" style={{ background: 'rgba(217,119,6,0.15)' }}>
                <AlertTriangle size={22} color="#fcd34d" />
              </div>
              <div className="stat-value">{fmt(stats.expired_medicines)}</div>
              <div className="stat-label">Expired Medicines</div>
            </div>
          </div>

          <div className="grid-3 mb-6">
            <div className="stat-card teal">
              <div className="stat-icon" style={{ background: 'rgba(10,126,126,0.15)' }}>
                <Users size={22} color="var(--teal-400)" />
              </div>
              <div className="stat-value">{fmt(stats.total_patients)}</div>
              <div className="stat-label">Patients</div>
            </div>
            <div className="stat-card navy">
              <div className="stat-icon" style={{ background: 'rgba(13,27,62,0.5)' }}>
                <Activity size={22} color="var(--teal-300)" />
              </div>
              <div className="stat-value">{fmt(stats.total_doctors)}</div>
              <div className="stat-label">Doctors</div>
            </div>
            <div className="stat-card teal">
              <div className="stat-icon" style={{ background: 'rgba(10,126,126,0.15)' }}>
                <Pill size={22} color="var(--teal-400)" />
              </div>
              <div className="stat-value">{fmt(stats.total_medicines)}</div>
              <div className="stat-label">Medicines</div>
            </div>
          </div>

          {/* Recent bills */}
          <div className="card">
            <div className="card-header">
              <span className="card-title"><Clock size={18} />Recent Bills</span>
              <Link to="/bill-history" className="btn btn-ghost btn-sm">View all</Link>
            </div>
            <div className="table-wrap">
              {recent.length === 0 ? (
                <div className="empty-state">
                  <FileText size={40} />
                  <h3>No bills yet</h3>
                  <p>Generate your first batch of simulated bills to get started.</p>
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Bill No.</th>
                      <th>Type</th>
                      <th>Mode</th>
                      <th>Patient</th>
                      <th>Doctor</th>
                      <th>Total</th>
                      <th>Date</th>
                      <th>PDF</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map(b => (
                      <tr key={b.id}>
                        <td className="font-mono text-xs" style={{ color: 'var(--teal-300)' }}>{b.bill_number}</td>
                        <td><StatusBadge billType={b.bill_type} /></td>
                        <td><StatusBadge mode={b.generation_mode} /></td>
                        <td>{b.patient_name ?? '—'}</td>
                        <td>{b.doctor_name ? `Dr. ${b.doctor_name}` : '—'}</td>
                        <td className="font-semibold">{fmtCurr(b.total_amount)}</td>
                        <td className="text-muted text-xs">{new Date(b.created_at).toLocaleDateString('en-IN')}</td>
                        <td>
                          <a
                            href={`/api/bills/${b.id}/pdf`}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-ghost btn-sm"
                          >
                            PDF
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
