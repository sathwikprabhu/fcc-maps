import { Routes, Route } from 'react-router-dom';
import { GlobalProvider } from './context/GlobalContext';
import AppLayout from './components/AppLayout';

import MapsList from './pages/MapsList';
import MapEditor from './pages/MapEditor';
import PointerColors from './pages/PointerColors';
import Branding from './pages/Branding';
import Metrics from './pages/Metrics';
import SettingsPage from './pages/Settings';

export default function App() {
  return (
    <GlobalProvider>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<MapsList />} />
          <Route path="/maps/:id/edit" element={<MapEditor />} />
          <Route path="/colors" element={<PointerColors />} />
          <Route path="/branding" element={<Branding />} />
          <Route path="/metrics" element={<Metrics />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </GlobalProvider>
  );
}
