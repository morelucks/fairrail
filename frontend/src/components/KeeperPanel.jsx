import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { Bot, Zap, Play, CheckCircle2, AlertCircle, RefreshCw, Layers, ShieldCheck, Activity } from 'lucide-react';
import { CONTRACT_ADDRESSES, CHAIN_CONFIG, INTENT_MATCHER_ABI } from '../config/contracts';

export default function KeeperPanel({ provider, signer }) {
  const [minBatchSize, setMinBatchSize] = useState(2);
  const [upkeepNeeded, setUpkeepNeeded] = useState(false);
  const [performData, setPerformData] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });
  const [matchedCount, setMatchedCount] = useState(0);

  const mockPairs = [
    {
      tokenInSymbol: 'WETH',
      tokenOutSymbol: 'USDC',
      tokenIn: '0x1000000000000000000000000000000000000001',
      tokenOut: '0x2000000000000000000000000000000000000002',
      forwardPending: 3,
      reversePending: 2,
      totalPending: 5,
    },
    {
      tokenInSymbol: 'LINK',
      tokenOutSymbol: 'WETH',
      tokenIn: '0x3000000000000000000000000000000000000003',
      tokenOut: '0x1000000000000000000000000000000000000001',
      forwardPending: 1,
      reversePending: 1,
      totalPending: 2,
    },
  ];

  // Simulate Chainlink checkUpkeep call
  const handleCheckUpkeep = async () => {
    try {
      setIsChecking(true);
      setStatusMsg({ type: 'info', text: 'Chainlink DON node evaluating checkUpkeep() off-chain...' });

      // Simulate logic or contract call
      await new Promise((r) => setTimeout(r, 800));

      const hasReadyPair = mockPairs.some((p) => p.totalPending >= minBatchSize);
      setUpkeepNeeded(hasReadyPair);

      if (hasReadyPair) {
        const targetPair = mockPairs[0];
        const encodedData = ethers.AbiCoder.defaultAbiCoder().encode(
          ['address', 'address'],
          [targetPair.tokenIn, targetPair.tokenOut]
        );
        setPerformData(encodedData);
        setStatusMsg({
          type: 'success',
          text: `checkUpkeep() returned true! Pending batch count (${targetPair.totalPending}) >= threshold (${minBatchSize}). Ready for performUpkeep().`,
        });
      } else {
        setPerformData('');
        setStatusMsg({ type: 'info', text: 'checkUpkeep() returned false. Queue threshold not yet reached.' });
      }
    } catch (err) {
      console.error(err);
      setStatusMsg({ type: 'error', text: 'Failed to run checkUpkeep simulation.' });
    } finally {
      setIsChecking(false);
    }
  };

  // Trigger performUpkeep / internal batch matching
  const handlePerformUpkeep = async () => {
    if (!signer) {
      setStatusMsg({ type: 'error', text: 'Please connect wallet to execute performUpkeep.' });
      return;
    }

    try {
      setIsExecuting(true);
      setStatusMsg({ type: 'info', text: 'Executing performUpkeep() -> processInternalBatchMatching() on IntentMatcher...' });

      const matcherContract = new ethers.Contract(CONTRACT_ADDRESSES.IntentMatcher, INTENT_MATCHER_ABI, signer);
      
      const targetPair = mockPairs[0];
      const tx = await matcherContract.processInternalBatchMatching(targetPair.tokenIn, targetPair.tokenOut);
      
      setStatusMsg({ type: 'info', text: `Tx sent: ${tx.hash.substring(0, 12)}... Confirming...` });
      await tx.wait();

      setMatchedCount((prev) => prev + 10);
      setUpkeepNeeded(false);
      setStatusMsg({
        type: 'success',
        text: 'Chainlink Automation performUpkeep() successfully executed! Pending intents matched off-chain.',
      });
    } catch (err) {
      console.error(err);
      setStatusMsg({ type: 'error', text: err.reason || err.message || 'performUpkeep execution failed.' });
    } finally {
      setIsExecuting(false);
    }
  };

  useEffect(() => {
    handleCheckUpkeep();
  }, []);

  return (
    <div className="glass-card" style={{ padding: '1.75rem' }}>
      
      {/* Header */}
      <div className="section-header">
        <div>
          <h2 className="section-header__title">
            <div className="section-header__title-icon" style={{ background: 'rgba(55, 91, 210, 0.15)', color: '#375bd2' }}>
              <Bot size={18} />
            </div>
            Chainlink Automation Keepers
          </h2>
          <p className="section-header__desc">
            Decentralized hands-free batch execution. <code style={{ color: '#375bd2' }}>FairRailKeeper</code> continuously monitors pending intent queues off-chain via Chainlink DON.
          </p>
        </div>
        <span className="badge" style={{ background: 'rgba(55, 91, 210, 0.15)', color: '#375bd2', border: '1px solid rgba(55, 91, 210, 0.3)' }}>
          <Activity size={12} className="spin" style={{ marginRight: '4px' }} />
          Chainlink DON Active
        </span>
      </div>

      {/* Overview Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="stat-card">
          <div className="stat-card__label">Keeper Contract</div>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', marginTop: '0.4rem', marginBottom: '0.2rem' }}>
            FairRailKeeper.sol
          </div>
          <div className="stat-card__sub">Custom Upkeep v2.1</div>
        </div>

        <div className="stat-card">
          <div className="stat-card__label">Min Batch Threshold</div>
          <div className="stat-card__value" style={{ color: '#375bd2' }}>
            {minBatchSize} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>intents</span>
          </div>
          <div className="stat-card__sub">Trigger Condition</div>
        </div>

        <div className="stat-card">
          <div className="stat-card__label">Upkeep Status</div>
          <div style={{ marginTop: '0.3rem', marginBottom: '0.2rem' }}>
            {upkeepNeeded ? (
              <span className="badge badge-emerald">
                <CheckCircle2 size={12} style={{ marginRight: '4px' }} />
                Upkeep Needed
              </span>
            ) : (
              <span className="badge badge-tertiary">
                Idle — Waiting for Queue
              </span>
            )}
          </div>
          <div className="stat-card__sub">checkUpkeep() Result</div>
        </div>
      </div>

      {/* Monitored Token Pairs */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Layers size={15} style={{ color: '#375bd2' }} />
            Monitored Token Pairs ({mockPairs.length})
          </h3>
          <button
            onClick={handleCheckUpkeep}
            disabled={isChecking}
            className="btn-secondary"
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
          >
            <RefreshCw size={12} className={isChecking ? 'spin' : ''} />
            Run checkUpkeep()
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {mockPairs.map((pair, idx) => (
            <div
              key={idx}
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '0.9rem 1.15rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '0.92rem' }}>
                  <span>{pair.tokenInSymbol}</span>
                  <span style={{ color: 'var(--text-muted)' }}>/</span>
                  <span>{pair.tokenOutSymbol}</span>
                  <span className="badge badge-purple" style={{ fontSize: '0.7rem' }}>Pair #{idx + 1}</span>
                </div>
                <div style={{ fontSize: '0.73rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  Forward Queue: {pair.forwardPending} | Reverse Queue: {pair.reversePending}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: pair.totalPending >= minBatchSize ? 'var(--status-emerald)' : 'var(--text-primary)' }}>
                    {pair.totalPending} Pending
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Threshold: {minBatchSize}</div>
                </div>

                {pair.totalPending >= minBatchSize ? (
                  <span className="badge badge-emerald">Ready for Match</span>
                ) : (
                  <span className="badge badge-tertiary">Accumulating</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chainlink Automation Simulation Bar */}
      <div
        style={{
          background: 'rgba(55, 91, 210, 0.06)',
          border: '1px solid rgba(55, 91, 210, 0.25)',
          borderRadius: 'var(--radius-md)',
          padding: '1.15rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <ShieldCheck size={16} style={{ color: '#375bd2' }} />
              Chainlink DON Perform Upkeep Trigger
            </div>
            <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
              Simulates Chainlink node triggering <code style={{ color: '#375bd2' }}>performUpkeep()</code> to batch match pending queue on-chain.
            </div>
          </div>

          <button
            onClick={handlePerformUpkeep}
            disabled={isExecuting || !upkeepNeeded}
            className="btn-primary"
            style={{
              background: upkeepNeeded ? '#375bd2' : 'var(--bg-tertiary)',
              color: upkeepNeeded ? '#ffffff' : 'var(--text-muted)',
              cursor: upkeepNeeded ? 'pointer' : 'not-allowed',
              padding: '0.55rem 1.1rem',
              fontSize: '0.82rem',
            }}
          >
            {isExecuting ? (
              <><RefreshCw size={14} className="spin" /> Executing Upkeep...</>
            ) : (
              <><Play size={14} /> Trigger performUpkeep()</>
            )}
          </button>
        </div>

        {performData && (
          <div style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', background: 'var(--bg-tertiary)', padding: '0.5rem 0.75rem', borderRadius: '4px', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
            <strong>performData:</strong> {performData.substring(0, 60)}...
          </div>
        )}
      </div>

      {/* Status Message */}
      {statusMsg.text && (
        <div className={`status-alert status-alert--${statusMsg.type}`} style={{ marginTop: '1rem' }}>
          {statusMsg.type === 'error' ? <AlertCircle size={15} /> : <CheckCircle2 size={15} />}
          <span>{statusMsg.text}</span>
        </div>
      )}
    </div>
  );
}
