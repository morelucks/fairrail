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
    <div className="glass-card" style={{ padding: '1.75rem' }}>
      
      {/* Section Header */}
      <div className="section-header">
        <div>
          <h2 className="section-header__title">
            <div className="section-header__title-icon">
              <Layers size={18} />
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
          style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem' }}
          id="btn-refresh-queue"
        >
          <RefreshCw size={13} className={isLoading ? 'spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        
        <div className="stat-card">
          <div className="stat-card__label">Queue Length</div>
          <div className="stat-card__value">
            {pendingCount}
          </div>
          <div className="stat-card__sub">Active Pending Intents</div>
        </div>

        <div className="stat-card">
          <div className="stat-card__label">Hook Routing</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.2rem', marginBottom: '0.2rem' }}>
            <span className="badge badge-live">Active</span>
          </div>
          <div className="stat-card__sub" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>
            beforeSwap() Intercept
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card__label">Match Engine</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.2rem', marginBottom: '0.2rem' }}>
            <Zap size={16} style={{ color: 'var(--accent-primary-light)' }} />
            <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>P2P + Batch</span>
          </div>
          <div className="stat-card__sub">Net Delta Offset</div>
        </div>
      </div>

      {/* Intent Flow Diagram */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
        padding: '0.85rem 1rem',
        borderRadius: 'var(--radius-sm)',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        marginBottom: '1.25rem',
        overflow: 'auto',
      }}>
        {[
          { label: 'Signed Intent' },
          { label: 'Queue Pool' },
          { label: 'Counter-Match' },
          { label: 'Settle / AMM' },
        ].map((step, i, arr) => (
          <React.Fragment key={step.label}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.35rem 0.65rem',
              borderRadius: 'var(--radius-xs)',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              fontSize: '0.75rem',
              fontWeight: 500,
              color: 'var(--text-secondary)',
              whiteSpace: 'nowrap',
            }}>
              <Activity size={12} />
              {step.label}
            </div>
            {i < arr.length - 1 && (
              <ArrowRight size={13} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Queue Compaction */}
      <div className="collapsible">
        <div style={{
          display: 'flex',
          justify: 'space-between',
          alignItems: 'center',
          padding: '0.85rem 1rem',
        }}>
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Trash2 size={15} />
              Queue Compaction
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>
              Compact array storage by purging zeroed-out or expired intents.
            </div>
          </div>
          <button
            onClick={handleCleanup}
            disabled={isCleaning}
            className="btn-secondary"
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.85rem' }}
            id="btn-compact-queue"
          >
            {isCleaning ? (
              <><Loader2 size={13} className="spin" /> Cleaning...</>
            ) : (
              <><Trash2 size={13} /> Compact</>
            )}
          </button>
        </div>
      </div>

      {/* Status */}
      {statusMsg && (
        <div className="status-alert status-alert--info" style={{ marginTop: '1rem' }}>
          <CheckCircle2 size={15} />
          <span>{statusMsg}</span>
        </div>
      )}
    </div>
  );
}
