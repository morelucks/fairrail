import React from 'react';
import ReactDOM from 'react-dom/client';
import { PrivyProvider } from '@privy-io/react-auth';
import { sepolia } from 'viem/chains';
import App from './App';
import './index.css';

const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID || 'cmtg90nk4018b0cjr3g10duec';

function MainRoot() {
  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ['wallet', 'email', 'google', 'twitter'],
        appearance: {
          theme: 'dark',
          accentColor: '#6366f1',
        },
        defaultChain: sepolia,
        supportedChains: [sepolia],
      }}
    >
      <App />
    </PrivyProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <MainRoot />
  </React.StrictMode>
);
