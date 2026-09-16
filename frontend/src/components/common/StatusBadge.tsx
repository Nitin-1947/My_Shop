import React from 'react';
import type { BillType, GenerationMode } from '../../types';

interface StatusBadgeProps {
  active?: boolean;
  expired?: boolean;
  billType?: BillType;
  mode?: GenerationMode | null;
}

export default function StatusBadge({ active, expired, billType, mode }: StatusBadgeProps) {
  if (expired !== undefined) {
    return expired
      ? <span className="badge badge-expired">Expired</span>
      : <span className="badge badge-active">Valid</span>;
  }

  if (active !== undefined) {
    return active
      ? <span className="badge badge-active">Active</span>
      : <span className="badge badge-inactive">Inactive</span>;
  }

  if (billType) {
    return billType === 'SIMULATED'
      ? <span className="badge badge-sim">SIMULATED</span>
      : <span className="badge badge-manual">MANUAL</span>;
  }

  if (mode) {
    return mode === 'DOSE'
      ? <span className="badge badge-dose">Dose</span>
      : <span className="badge badge-generic">Generic</span>;
  }

  return null;
}
