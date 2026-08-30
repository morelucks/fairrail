import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { DollarSign, TrendingUp, Award, RefreshCw, CheckCircle2, AlertCircle, ArrowDownToLine, Loader2, ShieldCheck, BarChart3 } from 'lucide-react';
import { CONTRACT_ADDRESSES, CHAIN_CONFIG, FAIR_RAIL_HOOK_ABI, MEV_AUCTION_ABI } from '../config/contracts';

export default function LpDashboard({ provider, signer, account }) {
  const [poolIdHex, setPoolIdHex] = useState('0x0000000000000000000000000000000000000000000000000000000000000001');
  const [recipient, setRecipient] = useState(account || '');
  const [metrics, setMetrics] = useState({ matchedVolume: '0', totalLpMev: '0', accruedAuctionLp: '0' });
  const [isClaiming, setIsClaiming] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });

  useEffect(() => {
    if (account && !recipient) {
      setRecipient(account);
    }
  }, [account]);

  const fetchMetrics = async () => {
    try {
      const readProvider = provider || new ethers.JsonRpcProvider(CHAIN_CONFIG.rpcUrl);
      const hookContract = new ethers.Contract(CONTRACT_ADDRESSES.FairRailHook, FAIR_RAIL_HOOK_ABI, readProvider);
      const auctionContract = new ethers.Contract(CONTRACT_ADDRESSES.MevAuction, MEV_AUCTION_ABI, readProvider);

      const poolMetrics = await hookContract.getPoolMetrics(poolIdHex);
      const accruedLpEth = await auctionContract.getAccruedLpRevenue(poolIdHex);

      setMetrics({
        matchedVolume: ethers.formatEther(poolMetrics.matchedVolume),
        totalLpMev: ethers.formatEther(poolMetrics.totalLpMevAccrued),
        accruedAuctionLp: ethers.formatEther(accruedLpEth)
      });
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, [poolIdHex]);

  // Claim LP Revenue Handler
  const handleClaimLpRevenue = async () => {
    if (!signer) {
      setStatusMsg({ type: 'error', text: 'Please connect wallet to claim LP yield.' });
      return;
    }
    if (!recipient || !ethers.isAddress(recipient)) {
      setStatusMsg({ type: 'error', text: 'Please enter a valid recipient address.' });
      return;
    }

    try {
      setIsClaiming(true);
      setStatusMsg({ type: 'info', text: 'Claiming accumulated LP MEV revenue from FairRailHook...' });

      const hookContract = new ethers.Contract(CONTRACT_ADDRESSES.FairRailHook, FAIR_RAIL_HOOK_ABI, signer);
      const tx = await hookContract.claimLpRevenue(poolIdHex, recipient);

      setStatusMsg({ type: 'info', text: `Tx sent: ${tx.hash.substring(0, 10)}... Claiming ETH...` });
      await tx.wait();

      setStatusMsg({ type: 'success', text: 'LP MEV revenue claimed and ETH transferred to recipient!' });
      fetchMetrics();
    } catch (err) {
      console.error(err);
      setStatusMsg({ type: 'error', text: err.reason || err.message || 'Claim failed.' });
    } finally {
      setIsClaiming(false);
    }
  };

  return (
    <div className="glass-card" style={{ padding: '2rem' }}>

      {/* Section Header */}
      <div className="section-header">
        <div>
          <h2 className="section-header__title">
            <div className="section-header__title-icon section-header__title-icon--emerald">
              <TrendingUp size={20} />
            </div>
            LP Yield & MEV Recapture Dashboard
          </h2>
          <p className="section-header__desc">
            Monitor recaptured LVR yield and claim 80% MEV auction revenue permissionlessly.
          </p>
        </div>
        <button
          onClick={fetchMetrics}
          className="btn-secondary"
          style={{ padding: '0.5rem 1rem', fontSize: '0.82rem' }}
          id="btn-refresh-lp"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Hero Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.75rem' }}>
        
        {/* Claimable Yield */}
        <div className="stat-card stat-card--emerald animate-in" style={{
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(6, 182, 212, 0.04) 100%)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <div className="stat-card__label" style={{ margin: 0 }}>Claimable Yield</div>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: 'var(--radius-xs)',
              background: 'var(--accent-emerald-dim)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <DollarSign size={16} style={{ color: 'var(--accent-emerald)' }} />
            </div>
          </div>
          <div className="stat-card__value" style={{ color: 'var(--accent-emerald-light)' }}>
            {metrics.accruedAuctionLp}
          </div>
          <div className="stat-card__sub" style={{ color: 'var(--accent-emerald)' }}>
            ETH — Ready to Withdraw
          </div>
        </div>

        {/* Total MEV Recaptured */}
        <div className="stat-card stat-card--purple animate-in animate-in-delay-1">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <div className="stat-card__label" style={{ margin: 0 }}>Total MEV Recaptured</div>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: 'var(--radius-xs)',
              background: 'var(--accent-purple-dim)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <ShieldCheck size={16} style={{ color: 'var(--accent-purple)' }} />
            </div>
          </div>
          <div className="stat-card__value" style={{ color: 'var(--text-primary)' }}>
            {metrics.totalLpMev}
          </div>
          <div className="stat-card__sub">
            ETH — Lifetime LVR Shield
          </div>
        </div>

        {/* Off-Chain Matched Volume */}
        <div className="stat-card stat-card--cyan animate-in animate-in-delay-2">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <div className="stat-card__label" style={{ margin: 0 }}>Matched Volume</div>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: 'var(--radius-xs)',
              background: 'var(--accent-cyan-dim)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <BarChart3 size={16} style={{ color: 'var(--accent-cyan)' }} />
            </div>
          </div>
          <div className="stat-card__value" style={{ color: 'var(--accent-cyan-light)' }}>
            {metrics.matchedVolume}
          </div>
          <div className="stat-card__sub">
            Zero AMM Volume Impact
          </div>
        </div>
      </div>

      {/* Revenue Flow */}
      <div style={{ marginBottom: '1.75rem' }}>
        <div style={{
          fontSize: '0.78rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--text-muted)',
          marginBottom: '0.75rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}>
          <Award size={14} style={{ color: 'var(--accent-emerald)' }} />
          Revenue Distribution
        </div>

        <div className="revenue-flow">
          <div style={{ textAlign: 'center', minWidth: '60px' }}>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--accent-emerald-light)' }}>80%</div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>LP Pool</div>
          </div>
          <div className="revenue-flow__bar" style={{ height: '16px' }}>
            <div className="revenue-flow__segment revenue-flow__segment--lp" />
            <div className="revenue-flow__segment revenue-flow__segment--protocol" />
          </div>
          <div style={{ textAlign: 'center', minWidth: '60px' }}>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--accent-purple-light)' }}>20%</div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Protocol</div>
          </div>
        </div>
      </div>

      <div className="divider divider--gradient" />

      {/* Claim Form */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

        <div style={{
          fontSize: '0.85rem',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}>
          <ArrowDownToLine size={16} style={{ color: 'var(--accent-emerald)' }} />
          Claim LP Revenue
        </div>

        <div>
          <label className="input-label">Pool ID</label>
          <input
            type="text"
            value={poolIdHex}
            onChange={(e) => setPoolIdHex(e.target.value)}
            className="input-field"
            placeholder="0x..."
            style={{ fontSize: '0.82rem' }}
            id="input-pool-id-lp"
          />
        </div>

        <div>
          <label className="input-label">Recipient Address (Receives ETH Yield)</label>
          <input
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            className="input-field"
            placeholder="0x..."
            id="input-recipient"
          />
        </div>

        <button
          onClick={handleClaimLpRevenue}
          disabled={isClaiming || parseFloat(metrics.accruedAuctionLp) === 0}
          className="btn-primary"
          style={{
            width: '100%',
            background: 'var(--gradient-emerald)',
            padding: '1rem',
            fontSize: '0.95rem',
          }}
          id="btn-claim-lp-revenue"
        >
          {isClaiming ? (
            <><Loader2 size={18} className="spin" /> Claiming ETH...</>
          ) : (
            <><DollarSign size={18} /> Claim {metrics.accruedAuctionLp} ETH LP Revenue</>
          )}
        </button>

        {/* Status */}
        {statusMsg.text && (
          <div className={`status-alert status-alert--${statusMsg.type}`}>
            {statusMsg.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
            <span>{statusMsg.text}</span>
          </div>
        )}
      </div>
    </div>
  );
}
