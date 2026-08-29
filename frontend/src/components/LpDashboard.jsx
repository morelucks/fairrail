import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { DollarSign, TrendingUp, Award, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
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
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <TrendingUp size={20} style={{ color: 'var(--accent-emerald)' }} />
            LP Yield & MEV Recapture Dashboard
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Monitor recaptured LVR yield and claim 80% MEV auction revenue permissionlessly.
          </p>
        </div>

        <button onClick={fetchMetrics} className="btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Metrics Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        
        <div style={{
          background: 'rgba(16, 185, 129, 0.06)',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          padding: '1.25rem',
          borderRadius: 'var(--radius-sm)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '0.8rem', color: '#6ee7b7', fontWeight: 600, textTransform: 'uppercase' }}>
            Claimable LP Yield
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--accent-emerald)', fontFamily: 'var(--font-mono)', margin: '0.3rem 0' }}>
            {metrics.accruedAuctionLp} ETH
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Ready to Withdraw</div>
        </div>

        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid var(--border-color)',
          padding: '1.25rem',
          borderRadius: 'var(--radius-sm)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
            Total MEV Recaptured
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', margin: '0.3rem 0' }}>
            {metrics.totalLpMev} ETH
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Lifetime LVR Shield</div>
        </div>

        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid var(--border-color)',
          padding: '1.25rem',
          borderRadius: 'var(--radius-sm)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
            Off-Chain Matched Volume
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)', margin: '0.3rem 0' }}>
            {metrics.matchedVolume}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Zero AMM Volume Impact</div>
        </div>

      </div>

      {/* Claim Form */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        
        <div>
          <label className="input-label">Recipient Address (Receives ETH Yield)</label>
          <input
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            className="input-field"
            placeholder="0x..."
          />
        </div>

        <button
          onClick={handleClaimLpRevenue}
          disabled={isClaiming || parseFloat(metrics.accruedAuctionLp) === 0}
          className="btn-primary"
          style={{ width: '100%', justifyContent: 'center', background: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)' }}
        >
          <DollarSign size={18} />
          {isClaiming ? 'Claiming ETH...' : `Claim ${metrics.accruedAuctionLp} ETH LP Revenue`}
        </button>

        {statusMsg.text && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.85rem',
            background: statusMsg.type === 'error' ? 'rgba(239, 68, 68, 0.15)' : statusMsg.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(6, 182, 212, 0.15)',
            color: statusMsg.type === 'error' ? '#fca5a5' : statusMsg.type === 'success' ? '#6ee7b7' : '#67e8f9',
          }}>
            {statusMsg.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
            <span>{statusMsg.text}</span>
          </div>
        )}

      </div>
    </div>
  );
}
