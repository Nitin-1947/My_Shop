import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, Stethoscope, Pill, FlaskConical,
  ClipboardList, Zap, FileText, History, ChevronLeft, ChevronRight,
  Activity,
} from 'lucide-react';
import './Sidebar.css';

const NAV_ITEMS = [
  { to: '/',               icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/patients',       icon: Users,           label: 'Patients' },
  { to: '/doctors',        icon: Stethoscope,     label: 'Doctors' },
  { to: '/generic-drugs',  icon: FlaskConical,    label: 'Generic Drugs' },
  { to: '/medicines',      icon: Pill,            label: 'Medicines' },
  { to: '/dose-patterns',  icon: ClipboardList,   label: 'Dose Patterns' },
  { to: '/generate',       icon: Zap,             label: 'Random Generator' },
  { to: '/manual-bill',    icon: FileText,        label: 'Manual Bill' },
  { to: '/bill-history',   icon: History,         label: 'Bill History' },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''}`}>
      {/* Brand */}
      <div className="sidebar__brand">
        <div className="sidebar__logo">
          <Activity size={22} strokeWidth={2.5} />
        </div>
        {!collapsed && (
          <div className="sidebar__brand-text">
            <span className="sidebar__name">My Shop</span>
            <span className="sidebar__tagline">Medical Billing</span>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="sidebar__nav">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`
            }
            title={collapsed ? label : undefined}
          >
            <Icon size={18} strokeWidth={2} className="sidebar__icon" />
            {!collapsed && <span className="sidebar__label">{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Collapse toggle */}
      <button
        className="sidebar__collapse-btn"
        onClick={() => setCollapsed(!collapsed)}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        {!collapsed && <span>Collapse</span>}
      </button>
    </aside>
  );
}
