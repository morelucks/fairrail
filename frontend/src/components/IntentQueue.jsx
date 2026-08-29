import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { Layers, RefreshCw, Trash2, CheckCircle2 } from 'lucide-react';
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
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Layers size={20} style={{ color: 'var(--accent-cyan)' }} />
            Pending Intent Queue
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Live count of off-chain intents waiting for counter-matches before AMM swap execution.
          </p>
        </div>

        <button
          onClick={fetchQueueCount}
          disabled={isLoading}
          className="btn-secondary"
          style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
        >
          <RefreshCw size={14} className={isLoading ? 'spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid var(--border-color)',
          padding: '1.25rem',
          borderRadius: 'var(--radius-sm)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
            Queue Length (Pair)
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
            {pendingCount}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            Active Pending Intents
          </div>
        </div>

        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid var(--border-color)',
          padding: '1.25rem',
          borderRadius: 'var(--radius-sm)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
            Execution Routing
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent-emerald)', marginTop: '0.5rem' }}>
            `beforeSwap()` Active
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            Net Delta Offset
          </div>
        </div>

      </div>

      {/* Queue Compaction Action */}
      <div style={{
        display: 'flex',
        justify: 'space-between',
        alignItems: 'center',
        background: 'rgba(6, 182, 212, 0.08)',
        border: '1px solid rgba(6, 182, 212, 0.25)',
        padding: '1rem 1.25rem',
        borderRadius: 'var(--radius-sm)'
      }}>
        <div>
          <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#67e8f9' }}>
            Queue Compaction
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Compact array storage by purging zeroed-out or expired intents.
          </div>
        </div>

        <button
          onClick={handleCleanup}
          disabled={isCleaning}
          className="btn-secondary"
          style={{ borderColor: 'rgba(6, 182, 212, 0.4)', color: '#67e8f9' }}
        >
          <Trash2 size={16} />
          {isCleaning ? 'Cleaning...' : 'Compact Queue'}
        </button>
      </div>

      {statusMsg && (
        <div style={{ fontSize: '0.82rem', color: 'var(--accent-cyan)', marginTop: '0.75rem', textAlign: 'center' }}>
          {statusMsg}
        </div>
      )}

    </div>
  );
}
