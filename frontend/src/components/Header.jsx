import React from 'react';
import { Wallet, ExternalLink, Zap, LogOut } from 'lucide-react';
import { CONTRACT_ADDRESSES, CHAIN_CONFIG } from '../config/contracts';

export default function Header({ account, balance, isConnecting, onConnect, onLogout, chainId, onSwitchNetwork }) {
  const isCorrectNetwork = !account || chainId === CHAIN_CONFIG.chainIdDecimal;

  const truncateAddress = (addr) => {
    if (!addr) return '';
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 50,
      background: 'rgba(13, 16, 23, 0.95)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--border-color)',
      marginBottom: '1.5rem',
    }}>
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        padding: '0.75rem 1.5rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '1rem',
        flexWrap: 'wrap',
      }}>

        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--accent-primary)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.2rem',
            flexShrink: 0,
          }}>
            🚆
          </div>
          <div>
            <h1 style={{
              fontSize: '1.15rem',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              lineHeight: 1.2,
              color: 'var(--text-primary)',
            }}>
              FairRail
              <span className="badge badge-purple" style={{ fontSize: '0.62rem' }}>v4 Hook</span>
            </h1>
            <p style={{
              fontSize: '0.72rem',
              color: 'var(--text-muted)',
              marginTop: '1px',
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
            <Zap size={12} style={{ color: 'var(--accent-primary-light)' }} />
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
          <button
            onClick={!isCorrectNetwork ? onSwitchNetwork : undefined}
            title={!isCorrectNetwork ? 'Click to switch to Ethereum Sepolia' : 'Connected to Sepolia'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.75rem',
              padding: '0.35rem 0.75rem',
              borderRadius: 'var(--radius-pill)',
              background: !isCorrectNetwork ? 'rgba(245, 158, 11, 0.15)' : 'var(--bg-tertiary)',
              border: !isCorrectNetwork ? '1px solid var(--status-amber)' : '1px solid var(--border-color)',
              color: !isCorrectNetwork ? 'var(--status-amber)' : 'var(--text-secondary)',
              cursor: !isCorrectNetwork ? 'pointer' : 'default',
              fontWeight: 500,
            }}
            id="btn-network-status"
          >
            <span style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: isCorrectNetwork ? 'var(--status-emerald)' : 'var(--status-amber)',
            }} />
            <span>
              {isCorrectNetwork ? 'Sepolia' : '⚡ Switch to Sepolia'}
            </span>
          </button>

          {/* Wallet */}
          {account ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                padding: '0.35rem 0.75rem',
                borderRadius: 'var(--radius-pill)',
              }}>
                <div style={{
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-primary)',
                }}>
                  {truncateAddress(account)}
                </div>
                <div style={{
                  fontSize: '0.72rem',
                  color: 'var(--accent-primary-light)',
                  fontWeight: 500,
                }}>
                  {parseFloat(balance).toFixed(4)} ETH
                </div>
              </div>
              {onLogout && (
                <button
                  onClick={onLogout}
                  className="btn-icon"
                  title="Disconnect Wallet"
                  style={{ width: '32px', height: '32px', borderRadius: 'var(--radius-pill)' }}
                  id="btn-disconnect-wallet"
                >
                  <LogOut size={13} />
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={onConnect}
              disabled={isConnecting}
              className="btn-primary"
              id="btn-connect-wallet"
              style={{ padding: '0.45rem 1rem', fontSize: '0.82rem' }}
            >
              <Wallet size={15} />
              {isConnecting ? 'Initializing...' : 'Connect Wallet'}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
