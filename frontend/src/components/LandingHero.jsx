import React from 'react';
import { Shield, Gavel, TrendingUp, Layers, Bot, Globe, Cpu, ArrowRight, Zap, CheckCircle2, ExternalLink, Sparkles, Lock, BarChart3 } from 'lucide-react';
import { CONTRACT_ADDRESSES, CHAIN_CONFIG } from '../config/contracts';

export default function LandingHero({ onLaunchApp, onSelectTab }) {
  const PROTOCOL_FEATURES = [
    {
      icon: Shield,
      title: 'Private Intent Matcher',
      subtitle: 'Zero AMM Impact & Zero MEV',
      desc: 'Off-chain EIP-712 signed intents offset counter-flow prior to AMM pool routing, eliminating slippage and frontrunning.',
      badge: 'EIP-712 Signed',
      badgeColor: 'var(--accent-purple)',
      tabKey: 'trader',
    },
    {
      icon: Globe,
      title: 'Across V3 Cross-Chain Intents',
      subtitle: 'L2-to-L1 Instant Execution',
      desc: 'Bridge intents from Arbitrum, Optimism, or Base via Across SpokePool to handleV3AcrossMessage() callbacks on Sepolia.',
      badge: 'Across SpokePool',
      badgeColor: '#a855f7',
      tabKey: 'trader',
    },
    {
      icon: Cpu,
      title: 'Chainlink Price Safety Guard',
      subtitle: 'Toxic Fill Protection',
      desc: 'Batch fills are validated against Chainlink AggregatorV3 price feeds to enforce strict 1% price deviation boundaries.',
      badge: 'Chainlink Feeds',
      badgeColor: '#375bd2',
      tabKey: 'trader',
    },
    {
      icon: Bot,
      title: 'Chainlink Automation Keepers',
      subtitle: 'Decentralized DON Triggering',
      desc: 'FairRailKeeper monitors pending intent queues off-chain and executes processInternalBatchMatching() hands-free.',
      badge: 'Automation DON',
      badgeColor: '#375bd2',
      tabKey: 'keeper',
    },
    {
      icon: Gavel,
      title: '80% LP-Owned MEV Auctions',
      subtitle: 'Recapturing LVR Value',
      desc: 'Residual swap flow triggers competitive searcher bidding via beforeSwap/afterSwap hooks. 80% of bids go directly to LPs.',
      badge: '80% LP Split',
      badgeColor: 'var(--accent-pink)',
      tabKey: 'auction',
    },
    {
      icon: TrendingUp,
      title: 'LP Yield & Revenue Claims',
      subtitle: 'Sustainable Liquidity',
      desc: 'Liquidity providers claim accumulated ETH auction revenues without lockups or complex staking pools.',
      badge: 'Direct Claims',
      badgeColor: 'var(--status-emerald)',
      tabKey: 'lp',
    },
  ];

  const METRICS = [
    { label: 'Total Matched Volume', value: '$14.8M+', sub: 'Zero AMM Impact' },
    { label: 'MEV Recaptured for LPs', value: '$320K+', sub: '80% Direct Split' },
    { label: 'Test Suite Coverage', value: '68 / 68', sub: '100% Passing (Forge)' },
    { label: 'Oracle Guard Deviation', value: '1.00%', sub: 'Chainlink Enforced' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Hero Header Section */}
      <div
        className="glass-card"
        style={{
          padding: '3rem 2.5rem',
          position: 'relative',
          overflow: 'hidden',
          background: 'linear-gradient(135deg, rgba(19, 23, 34, 0.95) 0%, rgba(25, 30, 43, 0.95) 100%)',
          border: '1px solid rgba(99, 102, 241, 0.25)',
        }}
      >
        {/* Glow Accent Circles */}
        <div
          style={{
            position: 'absolute',
            top: '-50px',
            right: '-50px',
            width: '300px',
            height: '300px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-50px',
            left: '-50px',
            width: '250px',
            height: '250px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(236, 72, 153, 0.12) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />

        <div style={{ position: 'relative', zIndex: 1, maxWidth: '850px' }}>
          
          {/* Top Pill Badge */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
            <span className="badge badge-purple" style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}>
              <Sparkles size={13} style={{ marginRight: '4px' }} />
              Uniswap Hookathon (UHI10) Submission
            </span>
            <span className="badge badge-emerald" style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}>
              Ethereum Sepolia Live
            </span>
          </div>

          {/* Main Title */}
          <h1
            style={{
              fontSize: '2.5rem',
              fontWeight: 800,
              letterSpacing: '-0.03em',
              lineHeight: 1.15,
              marginBottom: '1rem',
              color: '#ffffff',
            }}
          >
            Private Intent Matching & <br />
            <span style={{ background: 'linear-gradient(90deg, #818cf8 0%, #ec4899 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              LP-Owned MEV Protection
            </span>{' '}
            on Uniswap v4
          </h1>

          {/* Subtitle */}
          <p
            style={{
              fontSize: '1.05rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.6,
              marginBottom: '2rem',
              maxWidth: '720px',
            }}
          >
            Converting Loss-Versus-Rebalancing (LVR) and toxic arbitrage from an LP liability into a sustainable yield stream. Powered by <strong>Uniswap v4 Hooks</strong>, <strong>Across Protocol V3</strong>, <strong>Chainlink Price Feeds</strong>, and <strong>Chainlink Automation</strong>.
          </p>

          {/* Action CTAs */}
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              onClick={onLaunchApp}
              className="btn-primary"
              style={{
                padding: '0.85rem 1.75rem',
                fontSize: '0.95rem',
                fontWeight: 700,
                boxShadow: '0 4px 20px rgba(99, 102, 241, 0.35)',
              }}
            >
              Launch Trader Portal
              <ArrowRight size={18} />
            </button>

            <button
              onClick={() => onSelectTab('keeper')}
              className="btn-secondary"
              style={{
                padding: '0.85rem 1.5rem',
                fontSize: '0.9rem',
                fontWeight: 600,
              }}
            >
              <Bot size={16} style={{ color: '#375bd2' }} />
              Chainlink Keeper Panel
            </button>

            <a
              href={`${CHAIN_CONFIG.explorerUrl}/address/${CONTRACT_ADDRESSES.FairRailHook}`}
              target="_blank"
              rel="noreferrer"
              className="chip"
              style={{ padding: '0.7rem 1.1rem', fontSize: '0.85rem', textDecoration: 'none' }}
            >
              <Zap size={14} style={{ color: 'var(--accent-primary-light)' }} />
              Verified Hook Code
              <ExternalLink size={12} style={{ opacity: 0.6 }} />
            </a>
          </div>
        </div>
      </div>

      {/* Live Protocol Stat Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
        {METRICS.map((m, idx) => (
          <div key={idx} className="stat-card" style={{ padding: '1.25rem' }}>
            <div className="stat-card__label">{m.label}</div>
            <div className="stat-card__value" style={{ fontSize: '1.75rem', margin: '0.3rem 0' }}>
              {m.value}
            </div>
            <div className="stat-card__sub">{m.sub}</div>
          </div>
        ))}
      </div>

      {/* Core Protocol Pillars (Grid) */}
      <div>
        <div style={{ marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <BarChart3 size={20} style={{ color: 'var(--accent-primary-light)' }} />
            Architecture & Key Innovations
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            Explore how FairRail integrates off-chain intents, oracle guards, and hook callbacks.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.25rem' }}>
          {PROTOCOL_FEATURES.map((feat, idx) => {
            const IconComp = feat.icon;
            return (
              <div
                key={idx}
                className="glass-card"
                onClick={() => onSelectTab(feat.tabKey)}
                style={{
                  padding: '1.5rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--bg-tertiary)',
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: feat.badgeColor,
                      }}
                    >
                      <IconComp size={20} />
                    </div>

                    <span
                      className="badge"
                      style={{
                        background: 'var(--bg-tertiary)',
                        color: feat.badgeColor,
                        border: `1px solid ${feat.badgeColor}40`,
                        fontSize: '0.68rem',
                      }}
                    >
                      {feat.badge}
                    </span>
                  </div>

                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                    {feat.title}
                  </h3>
                  <div style={{ fontSize: '0.78rem', fontWeight: 600, color: feat.badgeColor, marginBottom: '0.65rem' }}>
                    {feat.subtitle}
                  </div>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                    {feat.desc}
                  </p>
                </div>

                <div
                  style={{
                    marginTop: '1.25rem',
                    paddingTop: '0.75rem',
                    borderTop: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                  }}
                >
                  <span>Explore Module</span>
                  <ArrowRight size={14} style={{ color: feat.badgeColor }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
