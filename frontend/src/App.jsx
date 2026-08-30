import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import Header from './components/Header';
import TraderPortal from './components/TraderPortal';
import IntentQueue from './components/IntentQueue';
import MevAuctionPortal from './components/MevAuctionPortal';
import LpDashboard from './components/LpDashboard';
import { CHAIN_CONFIG } from './config/contracts';
import { Shield, Gavel, TrendingUp, Layers, ChevronRight, Zap, ArrowRight, Github } from 'lucide-react';

const NAV_ITEMS = [
  {
    key: 'trader',
    label: 'Trader Portal',
    sub: 'Private Intent Matching',
    icon: Shield,
    accentColor: 'var(--accent-purple)',
  },
  {
    key: 'queue',
    label: 'Intent Queue',
    sub: 'Pending Batch Queue',
    icon: Layers,
    accentColor: 'var(--accent-cyan)',
  },
  {
    key: 'auction',
    label: 'MEV Auction',
    sub: 'Searcher Bidding',
    icon: Gavel,
    accentColor: 'var(--accent-pink)',
  },
  {
    key: 'lp',
    label: 'LP Dashboard',
    sub: 'Revenue & Claims',
    icon: TrendingUp,
    accentColor: 'var(--accent-emerald)',
  },
];

const PIPELINE_STEPS = [
  { label: 'Submit Intent', icon: '📝' },
  { label: 'Batch Match', icon: '🔗' },
  { label: 'AMM Swap', icon: '🔄' },
  { label: 'MEV Auction', icon: '🔨' },
  { label: 'LP Yield', icon: '💰' },
];

export default function App() {
  const [account, setAccount] = useState('');
  const [balance, setBalance] = useState('0');
  const [chainId, setChainId] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [activeTab, setActiveTab] = useState('trader');

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
    <div style={{ position: 'relative', minHeight: '100vh' }}>

      {/* Animated Background Mesh */}
      <div className="bg-mesh">
        <div className="bg-orb bg-orb--purple" />
        <div className="bg-orb bg-orb--pink" />
        <div className="bg-orb bg-orb--cyan" />
      </div>

      {/* Main Content */}
      <div style={{ position: 'relative', zIndex: 1 }}>

        {/* Header */}
        <Header
          account={account}
          balance={balance}
          isConnecting={isConnecting}
          onConnect={connectWallet}
          chainId={chainId}
        />

        {/* Architecture Pipeline Banner */}
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 1.5rem' }}>
          <div className="glass-card animate-in" style={{ marginBottom: '1.5rem' }}>
            <div className="pipeline">
              {PIPELINE_STEPS.map((step, i) => (
                <React.Fragment key={step.label}>
                  <div
                    className={`pipeline__step ${activeTab === NAV_ITEMS[Math.min(i, NAV_ITEMS.length - 1)]?.key ? 'pipeline__step--active' : ''}`}
                  >
                    <span>{step.icon}</span>
                    <span>{step.label}</span>
                  </div>
                  {i < PIPELINE_STEPS.length - 1 && (
                    <ChevronRight size={14} className="pipeline__arrow" />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>

        {/* App Layout: Sidebar + Content */}
        <div className="app-layout" style={{
          maxWidth: '1400px',
          margin: '0 auto',
          padding: '0 1.5rem',
          display: 'flex',
          gap: '1.5rem',
          alignItems: 'flex-start',
        }}>

          {/* Sidebar Navigation */}
          <nav className="sidebar glass-card animate-in animate-in-delay-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => setActiveTab(item.key)}
                  className={`sidebar__item ${isActive ? 'sidebar__item--active' : ''}`}
                  id={`nav-${item.key}`}
                >
                  <div className="sidebar__icon">
                    <Icon size={18} />
                  </div>
                  <div className="sidebar__label">
                    <span>{item.label}</span>
                    <span className="sidebar__label-sub">{item.sub}</span>
                  </div>
                </button>
              );
            })}

            {/* Sidebar Footer Info */}
            <div style={{
              marginTop: 'auto',
              padding: '1rem 0.75rem 0.5rem',
              borderTop: '1px solid var(--border-color)',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '0.5rem',
              }}>
                <span className="badge badge-live">Sepolia Live</span>
              </div>
              <p style={{
                fontSize: '0.72rem',
                color: 'var(--text-muted)',
                lineHeight: 1.5,
              }}>
                Uniswap v4 Hook • UHI10
                <br />
                Sustainable Liquidity & MEV Protection
              </p>
            </div>
          </nav>

          {/* Main Content Area */}
          <main style={{ flex: 1, minWidth: 0 }}>
            <div className="animate-in animate-in-delay-2" key={activeTab}>
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
            </div>
          </main>
        </div>

        {/* Footer */}
        <footer style={{
          maxWidth: '1400px',
          margin: '3rem auto 0',
          padding: '1.5rem',
          textAlign: 'center',
        }}>
          <div className="divider divider--gradient" style={{ marginBottom: '1.5rem' }} />
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '1.5rem',
            flexWrap: 'wrap',
          }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              FairRail — Sustainable Liquidity & MEV Protection
            </span>
            <span className="badge badge-purple">UHI10 Hookathon</span>
            <a
              href="https://github.com/morelucks/fairrail"
              target="_blank"
              rel="noreferrer"
              className="chip"
              style={{ textDecoration: 'none' }}
            >
              <Github size={14} />
              GitHub
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
}
