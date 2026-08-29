import React, { useState } from 'react';
import { ethers } from 'ethers';
import { Shield, Send, CheckCircle2, AlertCircle, ArrowRightLeft } from 'lucide-react';
import { CONTRACT_ADDRESSES, CHAIN_CONFIG, INTENT_MATCHER_ABI } from '../config/contracts';

export default function TraderPortal({ signer, account, onIntentSubmitted }) {
  const [tokenIn, setTokenIn] = useState('0x1000000000000000000000000000000000000001');
  const [tokenOut, setTokenOut] = useState('0x2000000000000000000000000000000000000002');
  const [amountIn, setAmountIn] = useState('10.0');
  const [minAmountOut, setMinAmountOut] = useState('9.9');
  const [deadlineMinutes, setDeadlineMinutes] = useState('60');

  const [signedIntent, setSignedIntent] = useState(null);
  const [isSigning, setIsSigning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });

  // Swap tokens helper
  const handleSwapTokens = () => {
    setTokenIn(tokenOut);
    setTokenOut(tokenIn);
  };

  // EIP-712 Signing Handler
  const handleSignIntent = async () => {
    if (!signer || !account) {
      setStatusMsg({ type: 'error', text: 'Please connect your wallet first.' });
      return;
    }

    try {
      setIsSigning(true);
      setStatusMsg({ type: 'info', text: 'Fetching current user nonce...' });

      const matcherContract = new ethers.Contract(CONTRACT_ADDRESSES.IntentMatcher, INTENT_MATCHER_ABI, signer);
      const currentNonce = await matcherContract.userNonces(account);
      const deadline = Math.floor(Date.now() / 1000) + (parseInt(deadlineMinutes) * 60);

      const parsedAmountIn = ethers.parseEther(amountIn);
      const parsedMinOut = ethers.parseEther(minAmountOut);

      // EIP-712 Domain & Types
      const domain = {
        name: 'FairRail IntentMatcher',
        version: '1',
        chainId: CHAIN_CONFIG.chainIdDecimal,
        verifyingContract: CONTRACT_ADDRESSES.IntentMatcher
      };

      const types = {
        TradeIntent: [
          { name: 'trader', type: 'address' },
          { name: 'tokenIn', type: 'address' },
          { name: 'tokenOut', type: 'address' },
          { name: 'amountIn', type: 'uint256' },
          { name: 'minAmountOut', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' }
        ]
      };

      const value = {
        trader: account,
        tokenIn: tokenIn,
        tokenOut: tokenOut,
        amountIn: parsedAmountIn.toString(),
        minAmountOut: parsedMinOut.toString(),
        nonce: currentNonce.toString(),
        deadline: deadline.toString()
      };

      setStatusMsg({ type: 'info', text: 'Please sign the EIP-712 typed intent in your wallet...' });

      // Sign EIP-712 intent
      const signature = await signer.signTypedData(domain, types, value);

      const intentObj = {
        trader: account,
        tokenIn: tokenIn,
        tokenOut: tokenOut,
        amountIn: parsedAmountIn,
        minAmountOut: parsedMinOut,
        nonce: currentNonce,
        deadline: deadline,
        signature: signature
      };

      setSignedIntent(intentObj);
      setStatusMsg({ type: 'success', text: 'Intent signed successfully with EIP-712!' });
    } catch (err) {
      console.error(err);
      setStatusMsg({ type: 'error', text: err.reason || err.message || 'Signing failed.' });
    } finally {
      setIsSigning(false);
    }
  };

  // Submit Signed Intent to Queue
  const handleSubmitIntent = async () => {
    if (!signedIntent || !signer) return;

    try {
      setIsSubmitting(true);
      setStatusMsg({ type: 'info', text: 'Submitting signed intent to IntentMatcher queue...' });

      const matcherContract = new ethers.Contract(CONTRACT_ADDRESSES.IntentMatcher, INTENT_MATCHER_ABI, signer);
      
      const intentStruct = {
        trader: signedIntent.trader,
        tokenIn: signedIntent.tokenIn,
        tokenOut: signedIntent.tokenOut,
        amountIn: signedIntent.amountIn,
        minAmountOut: signedIntent.minAmountOut,
        nonce: signedIntent.nonce,
        deadline: signedIntent.deadline,
        signature: signedIntent.signature
      };

      const tx = await matcherContract.submitPendingIntent(intentStruct);
      setStatusMsg({ type: 'info', text: `Transaction sent: ${tx.hash.substring(0, 10)}... Waiting for confirmation...` });

      await tx.wait();
      setStatusMsg({ type: 'success', text: 'Trade Intent queued on-chain! Zero AMM impact match ready.' });
      setSignedIntent(null);
      if (onIntentSubmitted) onIntentSubmitted();
    } catch (err) {
      console.error(err);
      setStatusMsg({ type: 'error', text: err.reason || err.message || 'Submission failed.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="glass-card" style={{ padding: '2rem' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Shield size={20} style={{ color: 'var(--accent-purple)' }} />
            Private Intent Matcher
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Trade off-chain with EIP-712 signatures. Zero slippage, zero AMM price impact.
          </p>
        </div>
        <span className="badge badge-emerald">0% AMM Slippage</span>
      </div>

      {/* Input Form */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
        
        {/* Token In & Out */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '0.75rem', alignItems: 'center' }}>
          <div>
            <label className="input-label">Token In (Sell)</label>
            <input
              type="text"
              value={tokenIn}
              onChange={(e) => setTokenIn(e.target.value)}
              className="input-field"
              placeholder="0x..."
            />
          </div>

          <button
            onClick={handleSwapTokens}
            className="btn-secondary"
            style={{ padding: '0.75rem', marginTop: '1.4rem' }}
            title="Swap tokens"
          >
            <ArrowRightLeft size={16} />
          </button>

          <div>
            <label className="input-label">Token Out (Buy)</label>
            <input
              type="text"
              value={tokenOut}
              onChange={(e) => setTokenOut(e.target.value)}
              className="input-field"
              placeholder="0x..."
            />
          </div>
        </div>

        {/* Amounts & Deadline */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
          <div>
            <label className="input-label">Amount In (Tokens)</label>
            <input
              type="number"
              step="0.01"
              value={amountIn}
              onChange={(e) => setAmountIn(e.target.value)}
              className="input-field"
            />
          </div>

          <div>
            <label className="input-label">Min Amount Out</label>
            <input
              type="number"
              step="0.01"
              value={minAmountOut}
              onChange={(e) => setMinAmountOut(e.target.value)}
              className="input-field"
            />
          </div>

          <div>
            <label className="input-label">Deadline (Minutes)</label>
            <input
              type="number"
              value={deadlineMinutes}
              onChange={(e) => setDeadlineMinutes(e.target.value)}
              className="input-field"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
          <button
            onClick={handleSignIntent}
            disabled={isSigning || isSubmitting}
            className="btn-primary"
            style={{ flex: 1, justifyContent: 'center' }}
          >
            <Shield size={18} />
            {isSigning ? 'Signing EIP-712...' : 'Step 1: Sign EIP-712 Intent'}
          </button>

          {signedIntent && (
            <button
              onClick={handleSubmitIntent}
              disabled={isSubmitting}
              className="btn-secondary"
              style={{ flex: 1, justifyContent: 'center', borderColor: 'var(--accent-emerald)', color: '#6ee7b7' }}
            >
              <Send size={18} />
              {isSubmitting ? 'Queueing...' : 'Step 2: Submit to Queue'}
            </button>
          )}
        </div>

        {/* Signature Preview */}
        {signedIntent && (
          <div style={{
            background: 'rgba(139, 92, 246, 0.08)',
            border: '1px solid rgba(139, 92, 246, 0.25)',
            padding: '1rem',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.82rem'
          }}>
            <div style={{ fontWeight: 600, color: '#c4b5fd', marginBottom: '0.3rem' }}>
              EIP-712 Signature Generated:
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', wordBreak: 'break-all', color: 'var(--text-secondary)' }}>
              {signedIntent.signature}
            </div>
          </div>
        )}

        {/* Status Message */}
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
            border: `1px solid ${statusMsg.type === 'error' ? 'rgba(239, 68, 68, 0.3)' : statusMsg.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(6, 182, 212, 0.3)'}`
          }}>
            {statusMsg.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
            <span>{statusMsg.text}</span>
          </div>
        )}

      </div>
    </div>
  );
}
