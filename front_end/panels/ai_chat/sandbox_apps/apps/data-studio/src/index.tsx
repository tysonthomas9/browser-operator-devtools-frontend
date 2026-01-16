import { createRoot } from 'react-dom/client';
import { App } from './App';
import { useDataStudioStore } from './store';
import './styles.css';

// Expose store on window for E2E testing
(window as any).__DATA_STUDIO_STORE__ = useDataStudioStore;

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
