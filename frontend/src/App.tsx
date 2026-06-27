import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { MapPage } from './pages/MapPage';
import { SupportPage } from './pages/SupportPage';
import { BillingSuccess } from './pages/BillingSuccess';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MapPage />} />
        <Route path="/support" element={<SupportPage />} />
        <Route path="/billing/success" element={<BillingSuccess />} />
      </Routes>
    </BrowserRouter>
  );
}
