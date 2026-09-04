import React, { useState, useEffect, useRef } from 'react';
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

const FEATURE_NAV_ITEMS = [
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

// 3 Public Nav Items shown on Landing Page when disconnected
const DISCONNECTED_NAV_ITEMS = [
  FEATURE_NAV_ITEMS[2], // Chainlink Keeper
  FEATURE_NAV_ITEMS[3], // MEV Auction
  FEATURE_NAV_ITEMS[4], // LP Dashboard
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
  const disconnectedRef = useRef(false);

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
      disconnectedRef.current = false;
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
      if (disconnectedRef.current) return;
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
        if (disconnectedRef.current) return;
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
        if (disconnectedRef.current) return;
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
    disconnectedRef.current = true;
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
    setActiveTab('overview');
  };

  // Progressive Access: Auto-transition to Trader Portal when wallet connects on overview
  useEffect(() => {
    if (account && activeTab === 'overview') {
      setActiveTab('trader');
    }
  }, [account]);

  const visibleNavItems = account ? FEATURE_NAV_ITEMS : DISCONNECTED_NAV_ITEMS;

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
          activeTab={activeTab}
          onSelectTab={(tabKey) => {
            if (!account && (tabKey === 'trader' || tabKey === 'queue' || tabKey === 'auction')) {
              handleConnectWallet();
            } else {
              setActiveTab(tabKey);
            }
          }}
          navItems={visibleNavItems}
        />

        {/* Main Content Area (Full Width, single navigation via Header) */}
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          padding: '0 1.5rem 3rem',
        }}>
          <main style={{ width: '100%' }} className="animate-in">
            {activeTab === 'overview' && (
              <LandingHero
                onLaunchApp={() => {
                  if (!account) {
                    handleConnectWallet();
                  } else {
                    setActiveTab('trader');
                  }
                }}
                onSelectTab={(tab) => {
                  if (!account && (tab === 'trader' || tab === 'queue' || tab === 'auction')) {
                    handleConnectWallet();
                  } else {
                    setActiveTab(tab);
                  }
                }}
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
