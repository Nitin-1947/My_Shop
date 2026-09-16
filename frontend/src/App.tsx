import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import Patients from './pages/Patients';
import Doctors from './pages/Doctors';
import GenericDrugs from './pages/GenericDrugs';
import Medicines from './pages/Medicines';
import DosePatterns from './pages/DosePatterns';
import RandomBillGenerator from './pages/RandomBillGenerator';
import ManualBill from './pages/ManualBill';
import BillHistory from './pages/BillHistory';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="patients" element={<Patients />} />
          <Route path="doctors" element={<Doctors />} />
          <Route path="generic-drugs" element={<GenericDrugs />} />
          <Route path="medicines" element={<Medicines />} />
          <Route path="dose-patterns" element={<DosePatterns />} />
          <Route path="generate" element={<RandomBillGenerator />} />
          <Route path="manual-bill" element={<ManualBill />} />
          <Route path="bill-history" element={<BillHistory />} />
          <Route path="*" element={<Dashboard />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
