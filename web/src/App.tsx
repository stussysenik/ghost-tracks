import { Route, Routes } from 'react-router';
import { Toaster } from './components/Toaster';
import { Landing } from './routes/Landing';
import { Share } from './routes/Share';
import { Studio } from './routes/Studio';

export function App() {
  return (
    <Toaster>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/studio" element={<Studio />} />
        <Route path="/r/:shareId" element={<Share />} />
        <Route path="*" element={<Landing />} />
      </Routes>
    </Toaster>
  );
}
