import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { Gavel, DollarSign, Clock, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { CONTRACT_ADDRESSES, CHAIN_CONFIG, MEV_AUCTION_ABI } from '../config/contracts';

export default function MevAuctionPortal({ provider, signer, account }) {
  const [poolIdHex, setPoolIdHex] = useState('0x0000000000000000000000000000000000000000000000000000000000000001');
  const [bidAmountEth, setBidAmountEth] = useState('0.05');

  const [highestBid, setHighestBid] = useState({ searcher: '', amount: '0', blockNumber: '0' });
  const [pendingRefund, setPendingRefund] = useState('0');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });

  const fetchAuctionState = async () => {
    try {
      const readProvider = provider || new ethers.JsonRpcProvider(CHAIN_CONFIG.rpcUrl);
      const auctionContract = new ethers.Contract(CONTRACT_ADDRESSES.MevAuction, MEV_AUCTION_ABI, readProvider);

      const bidInfo = await auctionContract.highestBids(poolIdHex);
      setHighestBid({
        searcher: bidInfo.searcher,
        amount: ethers.formatEther(bidInfo.amount),
        blockNumber: bidInfo.blockNumber.toString()
      });

      if (account) {
        const refundWei = await auctionContract.pendingRefunds(account);
        setPendingRefund(ethers.formatEther(refundWei));
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchAuctionState();
  }, [account, poolIdHex]);

  // Submit Bid Handler
  const handleSubmitBid = async () => {
    if (!signer) {
      setStatusMsg({ type: 'error', text: 'Please connect wallet to submit MEV bid.' });
      return;
    }

    try {
      setIsSubmitting(true);
      setStatusMsg({ type: 'info', text: 'Submitting MEV backrunning bid to auction...' });

      const auctionContract = new ethers.Contract(CONTRACT_ADDRESSES.MevAuction, MEV_AUCTION_ABI, signer);
      const valWei = ethers.parseEther(bidAmountEth);

      const tx = await auctionContract.submitBid(poolIdHex, { value: valWei });
      setStatusMsg({ type: 'info', text: `Tx sent: ${tx.hash.substring(0, 10)}... Waiting for block inclusion...` });

      await tx.wait();
      setStatusMsg({ type: 'success', text: 'MEV bid submitted! 80% will credit to LP pool upon afterSwap.' });
      fetchAuctionState();
    } catch (err) {
      console.error(err);
      setStatusMsg({ type: 'error', text: err.reason || err.message || 'Bid submission failed.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Withdraw Outbid Refund Handler
  const handleWithdrawRefund = async () => {
    if (!signer) return;

    try {
      setIsWithdrawing(true);
      setStatusMsg({ type: 'info', text: 'Withdrawing outbid ETH refund...' });

      const auctionContract = new ethers.Contract(CONTRACT_ADDRESSES.MevAuction, MEV_AUCTION_ABI, signer);
      const tx = await auctionContract.withdrawRefund();
      await tx.wait();

      setStatusMsg({ type: 'success', text: 'Outbid ETH refund claimed to wallet!' });
      fetchAuctionState();
    } catch (err) {
      console.error(err);
      setStatusMsg({ type: 'error', text: err.reason || err.message || 'Refund withdrawal failed.' });
    } finally {
      setIsWithdrawing(false);
    }
  };

  return (
    <div className="glass-card" style={{ padding: '2rem' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Gavel size={20} style={{ color: 'var(--accent-pink)' }} />
            Searcher MEV & LVR Auction
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Searchers bid for block backrunning rights. 80% of winning proceeds are distributed to LPs.
          </p>
        </div>

        <button onClick={fetchAuctionState} className="btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Inputs */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
        
        <div>
          <label className="input-label">Pool ID (Bytes32)</label>
          <input
            type="text"
            value={poolIdHex}
            onChange={(e) => setPoolIdHex(e.target.value)}
            className="input-field"
            placeholder="0x..."
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label className="input-label">Bid Amount (ETH)</label>
            <input
              type="number"
              step="0.01"
              value={bidAmountEth}
              onChange={(e) => setBidAmountEth(e.target.value)}
              className="input-field"
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              onClick={handleSubmitBid}
              disabled={isSubmitting}
              className="btn-primary"
              style={{ width: '100%', justifyContent: 'center', background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)' }}
            >
              <Gavel size={18} />
              {isSubmitting ? 'Bidding...' : 'Submit MEV Bid'}
            </button>
          </div>
        </div>

        {/* Leaderboard Card */}
        <div style={{
          background: 'rgba(236, 72, 153, 0.06)',
          border: '1px solid rgba(236, 72, 153, 0.25)',
          padding: '1.25rem',
          borderRadius: 'var(--radius-sm)',
          marginTop: '0.5rem'
        }}>
          <div style={{ fontSize: '0.85rem', color: '#f472b6', fontWeight: 700, marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Current Block Leaderboard
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', textAlign: 'center' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Highest Searcher</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                {highestBid.searcher && highestBid.searcher !== '0x0000000000000000000000000000000000000000'
                  ? `${highestBid.searcher.substring(0, 6)}...`
                  : 'None'}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Winning Bid</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent-pink)', fontFamily: 'var(--font-mono)' }}>
                {highestBid.amount} ETH
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Block Number</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                {highestBid.blockNumber !== '0' ? `#${highestBid.blockNumber}` : '-'}
              </div>
            </div>
          </div>
        </div>

        {/* Pull Refund Control */}
        {parseFloat(pendingRefund) > 0 && (
          <div style={{
            display: 'flex',
            justify: 'space-between',
            alignItems: 'center',
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            padding: '1rem',
            borderRadius: 'var(--radius-sm)'
          }}>
            <div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#fcd34d' }}>
                Pending Outbid Refund: {pendingRefund} ETH
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Pull pattern: withdraw your refunded ETH bid safely.
              </div>
            </div>

            <button
              onClick={handleWithdrawRefund}
              disabled={isWithdrawing}
              className="btn-secondary"
              style={{ borderColor: 'rgba(245, 158, 11, 0.4)', color: '#fcd34d' }}
            >
              <DollarSign size={16} />
              {isWithdrawing ? 'Withdrawing...' : 'Withdraw Refund'}
            </button>
          </div>
        )}

        {statusMsg.text && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.85rem',
            background: statusMsg.type === 'error' ? 'rgba(239, 68, 68, 0.15)' : statusMsg.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(236, 72, 153, 0.15)',
            color: statusMsg.type === 'error' ? '#fca5a5' : statusMsg.type === 'success' ? '#6ee7b7' : '#f472b6',
          }}>
            {statusMsg.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
            <span>{statusMsg.text}</span>
          </div>
        )}

      </div>
    </div>
  );
}
