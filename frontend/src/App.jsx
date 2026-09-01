import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import Header from './components/Header';
import LandingHero from './components/LandingHero';
import TraderPortal from './components/TraderPortal';
import IntentQueue from './components/IntentQueue';
import MevAuctionPortal from './components/MevAuctionPortal';
import LpDashboard from './components/LpDashboard';
import KeeperPanel from './components/KeeperPanel';
import { CHAIN_CONFIG } from './config/contracts';
import { Shield, Gavel, TrendingUp, Layers, ChevronRight, Zap, ArrowRight, Github, Bot, Sparkles } from 'lucide-react';

const NAV_ITEMS = [
  {
    key: 'overview',
    label: 'Protocol Overview',
    sub: 'Hero Landing Page',
    icon: Sparkles,
    accentColor: 'var(--accent-primary-light)',
    badge: 'UHI10 Hero',
  },
  {
    key: 'trader',
    label: 'Trader Portal',
    sub: 'Private Intent Matching',
    icon: Shield,
    accentColor: 'var(--accent-purple)',
    badge: 'EIP-712',
  },
  {
    key: 'queue',
    label: 'Intent Queue',
    sub: 'Pending Batch Queue',
    icon: Layers,
    accentColor: 'var(--accent-cyan)',
    badge: 'Live Queue',
  },
  {
    key: 'keeper',
    label: 'Chainlink Keeper',
    sub: 'Automation DON',
    icon: Bot,
    accentColor: '#375bd2',
    badge: 'DON Active',
  },
  {
    key: 'auction',
    label: 'MEV Auction',
    sub: 'Searcher Bidding',
    icon: Gavel,
    accentColor: 'var(--accent-pink)',
    badge: 'Searcher Bids',
  },
  {
    key: 'lp',
    label: 'LP Dashboard',
    sub: 'Revenue & Claims',
    icon: TrendingUp,
    accentColor: 'var(--accent-emerald)',
    badge: '80% Yield',
  },
];

const PIPELINE_STEPS = [
  { key: 'overview', label: '0. Protocol Overview', icon: '✨' },
  { key: 'trader', label: '1. Private Intent', icon: '📝' },
  { key: 'queue', label: '2. Batch Match', icon: '🔗' },
  { key: 'keeper', label: '3. Chainlink DON', icon: '🤖' },
  { key: 'auction', label: '4. MEV Auction', icon: '🔨' },
  { key: 'lp', label: '5. LP Yield', icon: '💰' },
];

export default function App() {
  const privyState = usePrivy();
  const { wallets } = useWallets();

  const login = privyState?.login;
  const logout = privyState?.logout;
  const ready = privyState?.ready;

  const [account, setAccount] = useState('');
  const [balance, setBalance] = useState('0');
  const [chainId, setChainId] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const activePrivyWallet = wallets && wallets.length > 0 ? wallets[0] : null;

  // Switch to Sepolia network helper
  const handleSwitchNetwork = async () => {
    if (!window.ethereum) return;
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: CHAIN_CONFIG.chainId }],
      });
      setChainId(CHAIN_CONFIG.chainIdDecimal);
    } catch (switchError) {
      // 4902 error code indicates chain has not been added to wallet
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: CHAIN_CONFIG.chainId,
              chainName: CHAIN_CONFIG.chainName,
              rpcUrls: [CHAIN_CONFIG.rpcUrl],
              nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
              blockExplorerUrls: [CHAIN_CONFIG.explorerUrl],
            }],
          });
          setChainId(CHAIN_CONFIG.chainIdDecimal);
        } catch (addError) {
          console.error('Failed to add Sepolia network:', addError);
        }
      } else {
        console.error('Failed to switch to Sepolia network:', switchError);
      }
    }
  };

  // Direct EIP-1193 / Browser Wallet Connection Handler
  const connectDirectWallet = async () => {
    if (!window.ethereum) {
      alert('No EVM wallet detected. Please install MetaMask, Coinbase Wallet, or Rabby.');
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

      // Auto switch if wrong network
      if (Number(network.chainId) !== CHAIN_CONFIG.chainIdDecimal) {
        await handleSwitchNetwork();
      }
    } catch (err) {
      console.error('Browser wallet connection failed:', err);
    } finally {
      setIsConnecting(false);
    }
  };

  // Connect Handler (Direct EVM browser wallet priority + Privy fallback)
  const handleConnectWallet = async () => {
    if (window.ethereum) {
      await connectDirectWallet();
    } else if (ready && login) {
      try {
        setIsConnecting(true);
        await login();
      } catch (err) {
        console.warn('Privy login error:', err);
      } finally {
        setIsConnecting(false);
      }
    } else {
      alert('Please install MetaMask or an EVM wallet to interact with FairRail.');
    }
  };

  // Auto-connect on page load if browser wallet is already unlocked/authorized
  useEffect(() => {
    async function checkAutoConnect() {
      if (window.ethereum) {
        try {
          const browserProvider = new ethers.BrowserProvider(window.ethereum);
          const accounts = await browserProvider.send('eth_accounts', []);
          if (accounts.length > 0) {
            const userSigner = await browserProvider.getSigner();
            const network = await browserProvider.getNetwork();
            const userBalanceWei = await browserProvider.getBalance(accounts[0]);

            setProvider(browserProvider);
            setSigner(userSigner);
            setAccount(accounts[0]);
            setBalance(ethers.formatEther(userBalanceWei));
            setChainId(Number(network.chainId));
          }
        } catch (err) {
          console.warn('Auto-connect check quiet error:', err);
        }
      }
    }
    checkAutoConnect();
  }, []);

  // Sync Privy connected wallet when activePrivyWallet changes
  useEffect(() => {
    async function initPrivyWallet() {
      if (activePrivyWallet && !account) {
        try {
          const eip1193Provider = await activePrivyWallet.getEthereumProvider();
          const browserProvider = new ethers.BrowserProvider(eip1193Provider);
          const userSigner = await browserProvider.getSigner();
          const userAccount = activePrivyWallet.address;
          const userBalanceWei = await browserProvider.getBalance(userAccount);

          setProvider(browserProvider);
          setSigner(userSigner);
          setAccount(userAccount);
          setBalance(ethers.formatEther(userBalanceWei));

          let parsedChainId = CHAIN_CONFIG.chainIdDecimal;
          if (activePrivyWallet.chainId) {
            const rawChain = activePrivyWallet.chainId;
            if (typeof rawChain === 'string' && rawChain.startsWith('eip155:')) {
              parsedChainId = parseInt(rawChain.split(':')[1], 10);
            } else if (typeof rawChain === 'string' && rawChain.startsWith('0x')) {
              parsedChainId = parseInt(rawChain, 16);
            } else {
              parsedChainId = Number(rawChain);
            }
          } else {
            const network = await browserProvider.getNetwork();
            parsedChainId = Number(network.chainId);
          }
          setChainId(parsedChainId);
        } catch (err) {
          console.error('Failed to initialize Privy wallet provider:', err);
        }
      }
    }

    initPrivyWallet();
  }, [activePrivyWallet, account]);

  // Listen for direct window.ethereum account & chain changes
  useEffect(() => {
    if (window.ethereum) {
      const handleAccounts = (accounts) => {
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          if (provider) {
            provider.getSigner().then(setSigner).catch(console.error);
            provider.getBalance(accounts[0]).then((bal) => setBalance(ethers.formatEther(bal))).catch(console.error);
          }
        } else {
          setAccount('');
          setSigner(null);
          setBalance('0');
        }
      };

      const handleChain = (hexChainId) => {
        if (typeof hexChainId === 'string') {
          setChainId(parseInt(hexChainId, 16));
        } else {
          window.location.reload();
        }
      };

      window.ethereum.on('accountsChanged', handleAccounts);
      window.ethereum.on('chainChanged', handleChain);

      return () => {
        if (window.ethereum.removeListener) {
          window.ethereum.removeListener('accountsChanged', handleAccounts);
          window.ethereum.removeListener('chainChanged', handleChain);
        }
      };
    }
  }, [provider]);

  // Logout / Disconnect Handler
  const handleLogout = async () => {
    if (logout && activePrivyWallet) {
      try {
        await logout();
      } catch (err) {
        console.warn('Privy logout error:', err);
      }
    }
    setAccount('');
    setSigner(null);
    setBalance('0');
    setProvider(null);
    setChainId(null);
  };

  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>

      {/* Animated Background Mesh */}
      <div className="bg-mesh" />

      {/* Main Content */}
      <div style={{ position: 'relative', zIndex: 1 }}>

        {/* Header */}
        <Header
          account={account}
          balance={balance}
          isConnecting={isConnecting}
          onConnect={handleConnectWallet}
          onLogout={handleLogout}
          chainId={chainId}
          onSwitchNetwork={handleSwitchNetwork}
        />

        {/* Architecture Pipeline Banner */}
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 1.5rem' }}>
          <div className="glass-card animate-in" style={{ marginBottom: '1.25rem' }}>
            <div className="pipeline">
              {PIPELINE_STEPS.map((step, i) => (
                <React.Fragment key={step.key}>
                  <button
                    onClick={() => setActiveTab(step.key)}
                    className={`pipeline__step ${activeTab === step.key ? 'pipeline__step--active' : ''}`}
                    style={{ cursor: 'pointer', border: '1px solid var(--border-color)', outline: 'none' }}
                  >
                    <span>{step.icon}</span>
                    <span>{step.label}</span>
                  </button>
                  {i < PIPELINE_STEPS.length - 1 && (
                    <ChevronRight size={14} className="pipeline__arrow" />
                  )}
                </React.Fragment>
              ))}
            </div>

            {/* Protocol Summary Ribbon */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.65rem 1rem',
                marginTop: '0.75rem',
                borderTop: '1px solid var(--border-subtle)',
                flexWrap: 'wrap',
                gap: '0.75rem',
                fontSize: '0.75rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Target Pool:</span>
                <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>ETH / USDC (0.30%)</strong>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Uniswap v4 Hook:</span>
                <span className="badge badge-emerald" style={{ fontSize: '0.68rem' }}>Sepolia Verified</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Oracle Guard:</span>
                <span className="badge" style={{ background: 'rgba(55, 91, 210, 0.15)', color: '#375bd2', border: '1px solid rgba(55, 91, 210, 0.3)', fontSize: '0.68rem' }}>
                  Chainlink (100 bps)
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Cross-Chain Bridge:</span>
                <span className="badge badge-purple" style={{ fontSize: '0.68rem' }}>Across V3 SpokePool</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>LP Revenue Split:</span>
                <strong style={{ color: 'var(--status-emerald)' }}>80% to LPs</strong>
              </div>
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
                  <div className="sidebar__label" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div>{item.label}</div>
                      <div className="sidebar__label-sub">{item.sub}</div>
                    </div>
                    {item.badge && (
                      <span
                        style={{
                          fontSize: '0.62rem',
                          padding: '0.15rem 0.4rem',
                          borderRadius: 'var(--radius-pill)',
                          background: isActive ? item.accentColor : 'var(--bg-tertiary)',
                          color: isActive ? '#ffffff' : 'var(--text-muted)',
                          border: '1px solid var(--border-color)',
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {item.badge}
                      </span>
                    )}
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
                <span className="badge badge-purple" style={{ fontSize: '0.65rem' }}>EVM + Privy</span>
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
              {activeTab === 'overview' && (
                <LandingHero
                  onLaunchApp={() => setActiveTab('trader')}
                  onSelectTab={(tab) => setActiveTab(tab)}
                />
              )}

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

              {activeTab === 'keeper' && (
                <KeeperPanel
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
