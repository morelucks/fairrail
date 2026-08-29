import React from 'react';
import { Wallet, ExternalLink, ShieldCheck, Zap } from 'lucide-react';
import { CONTRACT_ADDRESSES, CHAIN_CONFIG } from '../config/contracts';

export default function Header({ account, balance, isConnecting, onConnect, chainId }) {
  const isCorrectNetwork = chainId === CHAIN_CONFIG.chainIdDecimal;

  const truncateAddress = (addr) => {
    if (!addr) return '';
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  return (
    <header className="glass-card" style={{ padding: '1.25rem 2rem', marginBottom: '2rem', borderRadius: 'var(--radius-lg)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        
        {/* Brand Logo & Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            background: 'var(--gradient-brand)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.6rem',
            boxShadow: '0 4px 16px rgba(139, 92, 246, 0.4)'
          }}>
            🚆
          </div>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              FairRail <span className="badge badge-purple">Uniswap v4 Hook</span>
            </h1>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              Private Intent Matching & LP-Owned MEV Auctions
            </p>
          </div>
        </div>

        {/* Contract Quick Links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.82rem' }}>
          <a
            href={`${CHAIN_CONFIG.explorerUrl}/address/${CONTRACT_ADDRESSES.FairRailHook}`}
            target="_blank"
            rel="noreferrer"
            className="badge badge-cyan"
            style={{ textDecoration: 'none', cursor: 'pointer' }}
          >
            Hook: {truncateAddress(CONTRACT_ADDRESSES.FairRailHook)} <ExternalLink size={12} />
          </a>
          <a
            href={`${CHAIN_CONFIG.explorerUrl}/address/${CONTRACT_ADDRESSES.MevAuction}`}
            target="_blank"
            rel="noreferrer"
            className="badge badge-purple"
            style={{ textDecoration: 'none', cursor: 'pointer' }}
          >
            Auction: {truncateAddress(CONTRACT_ADDRESSES.MevAuction)} <ExternalLink size={12} />
          </a>
        </div>

        {/* Network & Wallet Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          
          {/* Network Indicator */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            fontSize: '0.85rem',
            background: 'rgba(255,255,255,0.05)',
            padding: '0.4rem 0.85rem',
            borderRadius: '9999px',
            border: '1px solid var(--border-color)'
          }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: isCorrectNetwork ? 'var(--accent-emerald)' : 'var(--accent-amber)'
            }} />
            <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
              {isCorrectNetwork ? 'Sepolia Testnet' : 'Wrong Network'}
            </span>
          </div>

          {/* Wallet Button */}
          {account ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                background: 'rgba(139, 92, 246, 0.1)',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                padding: '0.45rem 1rem',
                borderRadius: 'var(--radius-sm)',
                textAlign: 'right'
              }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                  {truncateAddress(account)}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)' }}>
                  {parseFloat(balance).toFixed(4)} ETH
                </div>
              </div>
            </div>
          ) : (
            <button
              onClick={onConnect}
              disabled={isConnecting}
              className="btn-primary"
            >
              <Wallet size={18} />
              {isConnecting ? 'Connecting...' : 'Connect Wallet'}
            </button>
          )}
        </div>

      </div>
    </header>
  );
}
