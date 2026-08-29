import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import Header from './components/Header';
import TraderPortal from './components/TraderPortal';
import IntentQueue from './components/IntentQueue';
import MevAuctionPortal from './components/MevAuctionPortal';
import LpDashboard from './components/LpDashboard';
import { CHAIN_CONFIG } from './config/contracts';
import { Shield, Gavel, TrendingUp, Layers, Info } from 'lucide-react';

export default function App() {
  const [account, setAccount] = useState('');
  const [balance, setBalance] = useState('0');
  const [chainId, setChainId] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [activeTab, setActiveTab] = useState('trader'); // 'trader', 'queue', 'auction', 'lp'

  // Connect Wallet Handler
  const connectWallet = async () => {
    if (!window.ethereum) {
      alert('Please install MetaMask or another EVM wallet to interact with FairRail.');
      return;
    }

    try {
      setIsConnecting(true);
      const browserProvider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await browserProvider.send('eth_requestAccounts', []);
      const userSigner = await browserProvider.getSigner();
      const network = await browserProvider.getNetwork();

      const userAccount = accounts[0];
      const userBalanceWei = await browserProvider.getBalance(userAccount);

      setProvider(browserProvider);
      setSigner(userSigner);
      setAccount(userAccount);
      setBalance(ethers.formatEther(userBalanceWei));
      setChainId(Number(network.chainId));
    } catch (err) {
      console.error('Wallet connection failed:', err);
    } finally {
      setIsConnecting(false);
    }
  };

  // EIP-1193 Account & Network Event Listeners
  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length > 0) {
          setAccount(accounts[0]);
        } else {
          setAccount('');
          setSigner(null);
        }
      });

      window.ethereum.on('chainChanged', () => {
        window.location.reload();
      });
    }
  }, []);

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem 1rem 3rem 1rem' }}>
      
      {/* Web3 Wallet Connection Header */}
      <Header
        account={account}
        balance={balance}
        isConnecting={isConnecting}
        onConnect={connectWallet}
        chainId={chainId}
      />

      {/* Hero Architecture Notice */}
      <div className="glass-card" style={{ padding: '1.25rem 1.5rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{ background: 'rgba(139, 92, 246, 0.2)', padding: '0.6rem', borderRadius: '12px', color: 'var(--accent-purple)' }}>
          <Info size={22} />
        </div>
        <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
          <strong style={{ color: 'var(--text-primary)' }}>FairRail Engine Active:</strong> Off-chain EIP-712 Intent Matcher pre-filters swap flow via <code style={{ color: 'var(--accent-cyan)' }}>beforeSwap()</code>. Unmatched flow is executed on-chain with 80% MEV backrunning yield auctioned back to LPs via <code style={{ color: 'var(--accent-pink)' }}>afterSwap()</code>.
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
        
        <button
          onClick={() => setActiveTab('trader')}
          className={activeTab === 'trader' ? 'btn-primary' : 'btn-secondary'}
          style={{ gap: '0.5rem' }}
        >
          <Shield size={16} />
          Trader Intent Portal
        </button>

        <button
          onClick={() => setActiveTab('queue')}
          className={activeTab === 'queue' ? 'btn-primary' : 'btn-secondary'}
          style={{ gap: '0.5rem' }}
        >
          <Layers size={16} />
          Pending Intent Queue
        </button>

        <button
          onClick={() => setActiveTab('auction')}
          className={activeTab === 'auction' ? 'btn-primary' : 'btn-secondary'}
          style={{ gap: '0.5rem' }}
        >
          <Gavel size={16} />
          Searcher MEV Auction
        </button>

        <button
          onClick={() => setActiveTab('lp')}
          className={activeTab === 'lp' ? 'btn-primary' : 'btn-secondary'}
          style={{ gap: '0.5rem' }}
        >
          <TrendingUp size={16} />
          LP Revenue & Claims
        </button>

      </div>

      {/* Main Tab Content */}
      <main>
        {activeTab === 'trader' && (
          <TraderPortal
            signer={signer}
            account={account}
            onIntentSubmitted={() => setActiveTab('queue')}
          />
        )}

        {activeTab === 'queue' && (
          <IntentQueue
            provider={provider}
            signer={signer}
          />
        )}

        {activeTab === 'auction' && (
          <MevAuctionPortal
            provider={provider}
            signer={signer}
            account={account}
          />
        )}

        {activeTab === 'lp' && (
          <LpDashboard
            provider={provider}
            signer={signer}
            account={account}
          />
        )}
      </main>

      {/* Footer */}
      <footer style={{ marginTop: '4rem', textAlign: 'center', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
        FairRail — Sustainable Liquidity & MEV Protection for Uniswap v4 (UHI10)
      </footer>

    </div>
  );
}
