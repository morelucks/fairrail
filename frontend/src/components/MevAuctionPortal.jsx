import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { Gavel, DollarSign, Clock, RefreshCw, AlertCircle, CheckCircle2, Trophy, Loader2, Flame, ArrowDownToLine } from 'lucide-react';
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

  const truncateAddr = (addr) => {
    if (!addr || addr === '0x0000000000000000000000000000000000000000') return 'None';
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  const hasActiveBid = highestBid.searcher && highestBid.searcher !== '0x0000000000000000000000000000000000000000';

  return (
    <div className="glass-card" style={{ padding: '2rem' }}>

      {/* Section Header */}
      <div className="section-header">
        <div>
          <h2 className="section-header__title">
            <div className="section-header__title-icon section-header__title-icon--pink">
              <Gavel size={20} />
            </div>
            Searcher MEV & LVR Auction
          </h2>
          <p className="section-header__desc">
            Searchers bid for block backrunning rights. 80% of winning proceeds are distributed to LPs via <code style={{ color: 'var(--accent-pink-light)', fontSize: '0.82rem' }}>afterSwap()</code>.
          </p>
        </div>
        <button
          onClick={fetchAuctionState}
          className="btn-secondary"
          style={{ padding: '0.5rem 1rem', fontSize: '0.82rem' }}
          id="btn-refresh-auction"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Bid Submission Card */}
      <div style={{
        background: 'rgba(236, 72, 153, 0.04)',
        border: '1px solid rgba(236, 72, 153, 0.15)',
        borderRadius: 'var(--radius-md)',
        padding: '1.5rem',
        marginBottom: '1.5rem',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: '1rem',
          fontSize: '0.85rem',
          fontWeight: 600,
          color: 'var(--accent-pink-light)',
        }}>
          <Flame size={16} />
          Place Backrunning Bid
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label className="input-label">Pool ID (Bytes32)</label>
          <input
            type="text"
            value={poolIdHex}
            onChange={(e) => setPoolIdHex(e.target.value)}
            className="input-field"
            placeholder="0x..."
            style={{ fontSize: '0.82rem' }}
            id="input-pool-id-auction"
          />
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label className="input-label">Bid Amount</label>
            <div className="input-group">
              <input
                type="number"
                step="0.01"
                value={bidAmountEth}
                onChange={(e) => setBidAmountEth(e.target.value)}
                className="input-field"
                style={{ paddingRight: '3.5rem', fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '1.1rem' }}
                id="input-bid-amount"
              />
              <span className="input-group__suffix" style={{ color: 'var(--accent-pink-light)' }}>ETH</span>
            </div>
          </div>

          <button
            onClick={handleSubmitBid}
            disabled={isSubmitting}
            className="btn-primary"
            style={{
              background: 'var(--gradient-pink)',
              padding: '0.85rem 1.5rem',
              whiteSpace: 'nowrap',
            }}
            id="btn-submit-bid"
          >
            {isSubmitting ? (
              <><Loader2 size={18} className="spin" /> Bidding...</>
            ) : (
              <><Gavel size={18} /> Submit Bid</>
            )}
          </button>
        </div>
      </div>

      {/* Leaderboard */}
      <div style={{ marginBottom: '1.25rem' }}>
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
          <Trophy size={14} style={{ color: 'var(--accent-amber)' }} />
          Current Block Leaderboard
        </div>

        <div className="leaderboard">
          <div className="leaderboard__header" style={{
            display: 'grid',
            gridTemplateColumns: '50px 1fr 1fr 1fr',
            gap: '1rem',
          }}>
            <span>Rank</span>
            <span>Searcher</span>
            <span>Bid Amount</span>
            <span>Block</span>
          </div>

          {hasActiveBid ? (
            <div className="leaderboard__row leaderboard__row--winner">
              <div className="leaderboard__rank leaderboard__rank--gold" style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
              }}>
                <Trophy size={16} />
                #1
              </div>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.85rem',
                fontWeight: 600,
              }}>
                {truncateAddr(highestBid.searcher)}
              </div>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '1.05rem',
                fontWeight: 800,
                color: 'var(--accent-pink-light)',
              }}>
                {highestBid.amount} ETH
              </div>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: 'var(--text-secondary)',
              }}>
                #{highestBid.blockNumber}
              </div>
            </div>
          ) : (
            <div className="leaderboard__row" style={{ justifyContent: 'center', gridTemplateColumns: '1fr' }}>
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', padding: '0.5rem 0' }}>
                No bids yet for this pool. Be the first searcher to bid.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Revenue Split Visual */}
      <div className="revenue-flow" style={{ marginBottom: '1.25rem' }}>
        <div className="revenue-flow__label" style={{ color: 'var(--accent-emerald-light)' }}>LP 80%</div>
        <div className="revenue-flow__bar">
          <div className="revenue-flow__segment revenue-flow__segment--lp" />
          <div className="revenue-flow__segment revenue-flow__segment--protocol" />
        </div>
        <div className="revenue-flow__label" style={{ color: 'var(--accent-purple-light)' }}>Protocol 20%</div>
      </div>

      {/* Refund Section */}
      {parseFloat(pendingRefund) > 0 && (
        <div className="animate-in" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--accent-amber-dim)',
          border: '1px solid rgba(245, 158, 11, 0.2)',
          padding: '1rem 1.25rem',
          borderRadius: 'var(--radius-sm)',
          marginBottom: '1rem',
        }}>
          <div>
            <div style={{
              fontSize: '0.9rem',
              fontWeight: 700,
              color: 'var(--accent-amber-light)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}>
              <DollarSign size={16} />
              Pending Outbid Refund: {pendingRefund} ETH
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
              Pull pattern — withdraw your refunded ETH bid safely.
            </div>
          </div>
          <button
            onClick={handleWithdrawRefund}
            disabled={isWithdrawing}
            className="btn-secondary"
            style={{
              borderColor: 'rgba(245, 158, 11, 0.3)',
              color: 'var(--accent-amber-light)',
              fontSize: '0.82rem',
            }}
            id="btn-withdraw-refund"
          >
            {isWithdrawing ? (
              <><Loader2 size={14} className="spin" /> Withdrawing...</>
            ) : (
              <><ArrowDownToLine size={14} /> Withdraw</>
            )}
          </button>
        </div>
      )}

      {/* Status */}
      {statusMsg.text && (
        <div className={`status-alert status-alert--${statusMsg.type}`}>
          {statusMsg.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
          <span>{statusMsg.text}</span>
        </div>
      )}
    </div>
  );
}
