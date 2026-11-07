import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { runCalculationUnitTests } from './engine/centralMetrics.test';

const testRes = runCalculationUnitTests();
console.log(`[BritConnect Calculation Integrity] Passed ${testRes.passed}/${testRes.passed + testRes.failed} unit tests.`);

createRoot(document.getElementById('root')!).render(<App />);
