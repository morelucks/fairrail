import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { Layers, RefreshCw, Trash2, CheckCircle2, Activity, ArrowRight, Loader2, Zap } from 'lucide-react';
import { CONTRACT_ADDRESSES, CHAIN_CONFIG, INTENT_MATCHER_ABI } from '../config/contracts';

export default function IntentQueue({ provider, signer }) {
  const [tokenIn, setTokenIn] = useState('0x1000000000000000000000000000000000000001');
  const [tokenOut, setTokenOut] = useState('0x2000000000000000000000000000000000000002');
  const [pendingCount, setPendingCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const fetchQueueCount = async () => {
    try {
      setIsLoading(true);
      const readProvider = provider || new ethers.JsonRpcProvider(CHAIN_CONFIG.rpcUrl);
      const matcherContract = new ethers.Contract(CONTRACT_ADDRESSES.IntentMatcher, INTENT_MATCHER_ABI, readProvider);
      
      const count = await matcherContract.pendingIntentCount(tokenIn, tokenOut);
      setPendingCount(Number(count));
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchQueueCount();
  }, [tokenIn, tokenOut]);

  const handleCleanup = async () => {
    if (!signer) {
      setStatusMsg('Please connect wallet to execute queue compaction.');
      return;
    }

    try {
      setIsCleaning(true);
      setStatusMsg('Compacting queue (removing consumed/expired entries)...');
      
      const matcherContract = new ethers.Contract(CONTRACT_ADDRESSES.IntentMatcher, INTENT_MATCHER_ABI, signer);
      const tx = await matcherContract.cleanupPendingIntents(tokenIn, tokenOut);
      await tx.wait();
      
      setStatusMsg('Queue compacted successfully!');
      fetchQueueCount();
    } catch (err) {
      console.error(err);
      setStatusMsg(err.reason || err.message || 'Cleanup failed.');
    } finally {
      setIsCleaning(false);
    }
  };

  return (
    <div className="glass-card" style={{ padding: '2rem' }}>
      
      {/* Section Header */}
      <div className="section-header">
        <div>
          <h2 className="section-header__title">
            <div className="section-header__title-icon section-header__title-icon--cyan">
              <Layers size={20} />
            </div>
            Pending Intent Queue
          </h2>
          <p className="section-header__desc">
            Live count of off-chain intents waiting for counter-matches before AMM swap execution.
          </p>
        </div>
        <button
          onClick={fetchQueueCount}
          disabled={isLoading}
          className="btn-secondary"
          style={{ padding: '0.5rem 1rem', fontSize: '0.82rem' }}
          id="btn-refresh-queue"
        >
          <RefreshCw size={14} className={isLoading ? 'spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.75rem' }}>
        
        <div className="stat-card stat-card--cyan animate-in">
          <div className="stat-card__label">Queue Length</div>
          <div className="stat-card__value" style={{ color: 'var(--accent-cyan-light)' }}>
            {pendingCount}
          </div>
          <div className="stat-card__sub">Active Pending Intents</div>
        </div>

        <div className="stat-card stat-card--emerald animate-in animate-in-delay-1">
          <div className="stat-card__label">Hook Routing</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.35rem', marginBottom: '0.35rem' }}>
            <span className="badge badge-live">Active</span>
          </div>
          <div className="stat-card__sub" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>
            beforeSwap() intercept
          </div>
        </div>

        <div className="stat-card stat-card--purple animate-in animate-in-delay-2">
          <div className="stat-card__label">Match Engine</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.35rem', marginBottom: '0.35rem' }}>
            <Zap size={18} style={{ color: 'var(--accent-purple-light)' }} />
            <span style={{ fontWeight: 700, color: 'var(--accent-purple-light)', fontSize: '0.95rem' }}>P2P + Batch</span>
          </div>
          <div className="stat-card__sub">Net Delta Offset</div>
        </div>
      </div>

      {/* Intent Flow Diagram */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '1rem 1.25rem',
        borderRadius: 'var(--radius-sm)',
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid var(--border-color)',
        marginBottom: '1.25rem',
        overflow: 'auto',
      }}>
        {[
          { label: 'Signed Intent', color: 'var(--accent-purple)', bg: 'var(--accent-purple-dim)' },
          { label: 'Queue Pool', color: 'var(--accent-cyan)', bg: 'var(--accent-cyan-dim)' },
          { label: 'Counter-Match', color: 'var(--accent-emerald)', bg: 'var(--accent-emerald-dim)' },
          { label: 'Settle or AMM', color: 'var(--accent-pink)', bg: 'var(--accent-pink-dim)' },
        ].map((step, i, arr) => (
          <React.Fragment key={step.label}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.4rem 0.75rem',
              borderRadius: 'var(--radius-xs)',
              background: step.bg,
              border: `1px solid ${step.color}22`,
              fontSize: '0.75rem',
              fontWeight: 600,
              color: step.color,
              whiteSpace: 'nowrap',
            }}>
              <Activity size={12} />
              {step.label}
            </div>
            {i < arr.length - 1 && (
              <ArrowRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0, opacity: 0.5 }} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Queue Compaction */}
      <div className="collapsible">
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '1rem 1.25rem',
        }}>
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--accent-cyan-light)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Trash2 size={16} />
              Queue Compaction
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
              Compact array storage by purging zeroed-out or expired intents.
            </div>
          </div>
          <button
            onClick={handleCleanup}
            disabled={isCleaning}
            className="btn-secondary"
            style={{ fontSize: '0.82rem', padding: '0.5rem 1rem' }}
            id="btn-compact-queue"
          >
            {isCleaning ? (
              <><Loader2 size={14} className="spin" /> Cleaning...</>
            ) : (
              <><Trash2 size={14} /> Compact</>
            )}
          </button>
        </div>
      </div>

      {/* Status */}
      {statusMsg && (
        <div className="status-alert status-alert--info" style={{ marginTop: '1rem' }}>
          <CheckCircle2 size={16} />
          <span>{statusMsg}</span>
        </div>
      )}
    </div>
  );
}
