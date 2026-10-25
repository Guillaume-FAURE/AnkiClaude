import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './styles.css';

registerSW({
  immediate: true,
  // An installed app can stay open for days: look for a new version whenever it
  // comes back to the foreground, and hourly. autoUpdate then reloads the page.
  onRegisteredSW(_url, registration) {
    if (!registration) return;
    const check = () => void registration.update();
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check());
    setInterval(check, 60 * 60 * 1000);
  },
});

// Ask the browser not to evict the local data under storage pressure.
void navigator.storage?.persist?.();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
