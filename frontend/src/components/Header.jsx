import React, { useState } from 'react';
import { Wallet, ExternalLink, Zap, LogOut, Menu, X } from 'lucide-react';
import { CONTRACT_ADDRESSES, CHAIN_CONFIG } from '../config/contracts';

export default function Header({
  account,
  balance,
  isConnecting,
  onConnect,
  onLogout,
  chainId,
  onSwitchNetwork,
  activeTab,
  onSelectTab,
  navItems = [],
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isCorrectNetwork = !account || chainId === CHAIN_CONFIG.chainIdDecimal;

  const truncateAddress = (addr) => {
    if (!addr) return '';
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  const handleNavClick = (tabKey) => {
    if (onSelectTab) onSelectTab(tabKey);
    setMobileMenuOpen(false);
  };

  return (
    <header className="main-header" style={{
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
      }}>

        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }} onClick={() => handleNavClick('overview')}>
          <img
            src="/logo.png"
            alt="FairRail Logo"
            style={{
              width: '38px',
              height: '38px',
              borderRadius: 'var(--radius-sm)',
              objectFit: 'contain',
              flexShrink: 0,
            }}
          />
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

        {/* Desktop Horizontal Navigation */}
        {navItems && navItems.length > 0 && (
          <nav className="header-nav-desktop" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => handleNavClick(item.key)}
                  className={`nav-pill ${isActive ? 'nav-pill--active' : ''}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.45rem 0.85rem',
                    borderRadius: 'var(--radius-pill)',
                    fontSize: '0.78rem',
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                    background: isActive ? 'rgba(99, 102, 241, 0.18)' : 'transparent',
                    border: isActive ? '1px solid var(--accent-primary-border)' : '1px solid transparent',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <Icon size={14} style={{ color: isActive ? 'var(--accent-primary-light)' : 'var(--text-muted)' }} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        )}

        {/* Network & Wallet Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>

          {/* Contract Chips (Hidden on small mobile) */}
          <div className="header-contract-chips" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}>
            <a
              href={`${CHAIN_CONFIG.explorerUrl}/address/${CONTRACT_ADDRESSES.FairRailHook}`}
              target="_blank"
              rel="noreferrer"
              className="chip"
              id="link-hook-contract"
              style={{ fontSize: '0.7rem' }}
            >
              <Zap size={11} style={{ color: 'var(--accent-primary-light)' }} />
              Hook
            </a>
          </div>

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
              {isCorrectNetwork ? 'Sepolia' : '⚡ Switch'}
            </span>
          </button>

          {/* Wallet Button */}
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

          {/* Mobile Hamburger Toggle Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="hamburger-btn"
            aria-label="Toggle navigation menu"
            style={{
              display: 'none',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              padding: '0.45rem',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
            }}
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Slide-Down Drawer */}
      {mobileMenuOpen && (
        <div className="mobile-nav-drawer" style={{
          padding: '1rem 1.5rem 1.25rem',
          background: 'rgba(13, 16, 23, 0.98)',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
        }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.key;
            return (
              <button
                key={item.key}
                onClick={() => handleNavClick(item.key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.9rem',
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                  background: isActive ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-tertiary)',
                  border: isActive ? '1px solid var(--accent-primary-border)' : '1px solid var(--border-color)',
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <Icon size={18} style={{ color: isActive ? 'var(--accent-primary-light)' : 'var(--text-muted)' }} />
                <div style={{ flex: 1 }}>
                  <div>{item.label}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{item.sub}</div>
                </div>
                {item.badge && (
                  <span style={{
                    fontSize: '0.65rem',
                    padding: '0.15rem 0.45rem',
                    borderRadius: 'var(--radius-pill)',
                    background: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--accent-primary-light)',
                  }}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </header>
  );
}
