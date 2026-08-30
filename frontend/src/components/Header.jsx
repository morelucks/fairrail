import React from 'react';
import { Wallet, ExternalLink, Zap, LogOut } from 'lucide-react';
import { CONTRACT_ADDRESSES, CHAIN_CONFIG } from '../config/contracts';

export default function Header({ account, balance, isConnecting, onConnect, onLogout, chainId }) {
  const isCorrectNetwork = !account || chainId === CHAIN_CONFIG.chainIdDecimal;

  const truncateAddress = (addr) => {
    if (!addr) return '';
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  // Generate a deterministic color from address for avatar
  const getAvatarColor = (addr) => {
    if (!addr) return 'var(--accent-purple)';
    const hash = parseInt(addr.substring(2, 8), 16);
    const hue = hash % 360;
    return `hsl(${hue}, 65%, 55%)`;
  };

  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 50,
      backdropFilter: 'blur(24px) saturate(1.3)',
      WebkitBackdropFilter: 'blur(24px) saturate(1.3)',
      background: 'rgba(6, 7, 18, 0.8)',
      borderBottom: '1px solid var(--border-color)',
      marginBottom: '1.5rem',
    }}>
      {/* Animated gradient line at top */}
      <div style={{
        position: 'absolute',
        bottom: -1,
        left: 0,
        right: 0,
        height: '1px',
        background: 'linear-gradient(90deg, transparent 0%, rgba(139, 92, 246, 0.5) 25%, rgba(236, 72, 153, 0.5) 50%, rgba(6, 182, 212, 0.5) 75%, transparent 100%)',
      }} />

      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        padding: '0.85rem 1.5rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '1rem',
        flexWrap: 'wrap',
      }}>

        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--gradient-brand)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.4rem',
            boxShadow: '0 4px 20px rgba(139, 92, 246, 0.35)',
            animation: 'pulseGlow 4s ease-in-out infinite',
            flexShrink: 0,
          }}>
            🚆
          </div>
          <div>
            <h1 style={{
              fontSize: '1.25rem',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              lineHeight: 1.2,
            }}>
              <span className="gradient-text">FairRail</span>
              <span className="badge badge-purple" style={{ fontSize: '0.6rem' }}>v4 Hook</span>
            </h1>
            <p style={{
              fontSize: '0.72rem',
              color: 'var(--text-muted)',
              marginTop: '1px',
              letterSpacing: '0.02em',
            }}>
              Private Intent Matching & LP-Owned MEV Auctions
            </p>
          </div>
        </div>

        {/* Contract Chips */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          flexWrap: 'wrap',
        }}>
          <a
            href={`${CHAIN_CONFIG.explorerUrl}/address/${CONTRACT_ADDRESSES.FairRailHook}`}
            target="_blank"
            rel="noreferrer"
            className="chip"
            id="link-hook-contract"
          >
            <Zap size={12} style={{ color: 'var(--accent-cyan)' }} />
            Hook: {truncateAddress(CONTRACT_ADDRESSES.FairRailHook)}
            <ExternalLink size={10} style={{ opacity: 0.5 }} />
          </a>
          <a
            href={`${CHAIN_CONFIG.explorerUrl}/address/${CONTRACT_ADDRESSES.MevAuction}`}
            target="_blank"
            rel="noreferrer"
            className="chip"
            id="link-auction-contract"
          >
            <Zap size={12} style={{ color: 'var(--accent-pink)' }} />
            Auction: {truncateAddress(CONTRACT_ADDRESSES.MevAuction)}
            <ExternalLink size={10} style={{ opacity: 0.5 }} />
          </a>
        </div>

        {/* Network & Wallet */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>

          {/* Network Status */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            fontSize: '0.78rem',
            padding: '0.4rem 0.85rem',
            borderRadius: 'var(--radius-pill)',
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid var(--border-color)',
          }}>
            <span style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              backgroundColor: isCorrectNetwork ? 'var(--accent-emerald)' : 'var(--accent-amber)',
              boxShadow: isCorrectNetwork
                ? '0 0 8px rgba(16, 185, 129, 0.5)'
                : '0 0 8px rgba(245, 158, 11, 0.5)',
              animation: 'pulseDot 2s ease-in-out infinite',
            }} />
            <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
              {isCorrectNetwork ? 'Sepolia' : 'Wrong Network'}
            </span>
          </div>

          {/* Wallet */}
          {account ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                background: 'rgba(139, 92, 246, 0.06)',
                border: '1px solid rgba(139, 92, 246, 0.2)',
                padding: '0.4rem 0.85rem 0.4rem 0.5rem',
                borderRadius: 'var(--radius-pill)',
              }}>
                {/* Address avatar */}
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: `linear-gradient(135deg, ${getAvatarColor(account)}, ${getAvatarColor(account + '1')})`,
                  border: '2px solid rgba(255, 255, 255, 0.15)',
                  flexShrink: 0,
                }} />
                <div>
                  <div style={{
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    fontFamily: 'var(--font-mono)',
                    lineHeight: 1.2,
                  }}>
                    {truncateAddress(account)}
                  </div>
                  <div style={{
                    fontSize: '0.7rem',
                    color: 'var(--accent-cyan-light)',
                    fontWeight: 500,
                  }}>
                    {parseFloat(balance).toFixed(4)} ETH
                  </div>
                </div>
              </div>
              {onLogout && (
                <button
                  onClick={onLogout}
                  className="btn-icon"
                  title="Disconnect Privy Wallet"
                  style={{ width: '36px', height: '36px', borderRadius: 'var(--radius-pill)' }}
                  id="btn-disconnect-wallet"
                >
                  <LogOut size={14} />
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={onConnect}
              disabled={isConnecting}
              className="btn-primary"
              id="btn-connect-wallet"
              style={{ padding: '0.55rem 1.15rem', fontSize: '0.85rem' }}
            >
              <Wallet size={16} />
              {isConnecting ? 'Initializing...' : 'Connect Wallet (Privy)'}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
