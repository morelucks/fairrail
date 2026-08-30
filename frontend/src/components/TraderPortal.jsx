import React, { useState } from 'react';
import { ethers } from 'ethers';
import { Shield, Send, CheckCircle2, AlertCircle, ArrowDownUp, Eye, EyeOff, FileSignature, Loader2 } from 'lucide-react';
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
  const [showSig, setShowSig] = useState(false);

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

  const currentStep = signedIntent ? 2 : 1;

  return (
    <div className="glass-card" style={{ padding: '2rem' }}>

      {/* Section Header */}
      <div className="section-header">
        <div>
          <h2 className="section-header__title">
            <div className="section-header__title-icon section-header__title-icon--purple">
              <Shield size={20} />
            </div>
            Private Intent Matcher
          </h2>
          <p className="section-header__desc">
            Trade off-chain with EIP-712 signatures. Zero slippage, zero AMM price impact, zero MEV exposure.
          </p>
        </div>
        <span className="badge badge-emerald">0% Slippage</span>
      </div>

      {/* Step Progress */}
      <div className="step-progress">
        <div className={`step-progress__step ${currentStep === 1 ? 'step-progress__step--active' : ''} ${signedIntent ? 'step-progress__step--done' : ''}`}>
          <div className="step-progress__num">
            {signedIntent ? <CheckCircle2 size={14} /> : '1'}
          </div>
          <span>Sign Intent</span>
        </div>
        <div className="step-progress__connector" style={signedIntent ? { background: 'var(--accent-emerald)' } : {}} />
        <div className={`step-progress__step ${currentStep === 2 ? 'step-progress__step--active' : ''}`}>
          <div className="step-progress__num">2</div>
          <span>Submit to Queue</span>
        </div>
      </div>

      {/* Swap Card */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>

        {/* Token In */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          padding: '1.15rem 1.25rem',
          transition: 'all 0.3s ease',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
            <label className="input-label" style={{ margin: 0, fontSize: '0.75rem' }}>You Sell</label>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Token In</span>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <input
              type="number"
              step="0.01"
              value={amountIn}
              onChange={(e) => setAmountIn(e.target.value)}
              className="input-field input-field--lg"
              style={{ border: 'none', background: 'transparent', padding: '0', flex: 1 }}
              id="input-amount-in"
            />
            <div style={{
              padding: '0.5rem 0.85rem',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(139, 92, 246, 0.1)',
              border: '1px solid rgba(139, 92, 246, 0.2)',
              fontSize: '0.78rem',
              fontWeight: 600,
              fontFamily: 'var(--font-mono)',
              color: 'var(--accent-purple-light)',
              whiteSpace: 'nowrap',
              maxWidth: '160px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {tokenIn.substring(0, 6)}...{tokenIn.substring(tokenIn.length - 4)}
            </div>
          </div>
          <input
            type="text"
            value={tokenIn}
            onChange={(e) => setTokenIn(e.target.value)}
            className="input-field"
            placeholder="Token address 0x..."
            style={{ marginTop: '0.6rem', fontSize: '0.78rem', padding: '0.6rem 0.85rem' }}
            id="input-token-in"
          />
        </div>

        {/* Swap Button */}
        <div style={{ display: 'flex', justifyContent: 'center', margin: '-0.5rem 0', zIndex: 2 }}>
          <button
            onClick={handleSwapTokens}
            className="btn-icon"
            title="Swap tokens"
            id="btn-swap-tokens"
            style={{
              background: 'var(--bg-secondary)',
              border: '3px solid var(--bg-void)',
              borderRadius: '12px',
              width: '40px',
              height: '40px',
            }}
          >
            <ArrowDownUp size={16} />
          </button>
        </div>

        {/* Token Out */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          padding: '1.15rem 1.25rem',
          transition: 'all 0.3s ease',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
            <label className="input-label" style={{ margin: 0, fontSize: '0.75rem' }}>You Buy</label>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Token Out</span>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <input
              type="number"
              step="0.01"
              value={minAmountOut}
              onChange={(e) => setMinAmountOut(e.target.value)}
              className="input-field input-field--lg"
              style={{ border: 'none', background: 'transparent', padding: '0', flex: 1 }}
              id="input-min-amount-out"
            />
            <div style={{
              padding: '0.5rem 0.85rem',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(6, 182, 212, 0.1)',
              border: '1px solid rgba(6, 182, 212, 0.2)',
              fontSize: '0.78rem',
              fontWeight: 600,
              fontFamily: 'var(--font-mono)',
              color: 'var(--accent-cyan-light)',
              whiteSpace: 'nowrap',
              maxWidth: '160px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {tokenOut.substring(0, 6)}...{tokenOut.substring(tokenOut.length - 4)}
            </div>
          </div>
          <input
            type="text"
            value={tokenOut}
            onChange={(e) => setTokenOut(e.target.value)}
            className="input-field"
            placeholder="Token address 0x..."
            style={{ marginTop: '0.6rem', fontSize: '0.78rem', padding: '0.6rem 0.85rem' }}
            id="input-token-out"
          />
        </div>

        {/* Deadline */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.75rem 1.25rem',
          background: 'rgba(255, 255, 255, 0.02)',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-subtle)',
        }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Deadline</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="number"
              value={deadlineMinutes}
              onChange={(e) => setDeadlineMinutes(e.target.value)}
              style={{
                width: '60px',
                textAlign: 'right',
                background: 'transparent',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                padding: '0.3rem 0.5rem',
                borderRadius: '6px',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.85rem',
                fontWeight: 600,
                outline: 'none',
              }}
              id="input-deadline"
            />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>minutes</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem' }}>
          <button
            onClick={handleSignIntent}
            disabled={isSigning || isSubmitting}
            className="btn-primary"
            style={{ flex: 1 }}
            id="btn-sign-intent"
          >
            {isSigning ? (
              <><Loader2 size={18} className="spin" /> Signing EIP-712...</>
            ) : (
              <><FileSignature size={18} /> Sign EIP-712 Intent</>
            )}
          </button>

          {signedIntent && (
            <button
              onClick={handleSubmitIntent}
              disabled={isSubmitting}
              className="btn-primary"
              style={{
                flex: 1,
                background: 'var(--gradient-emerald)',
              }}
              id="btn-submit-intent"
            >
              {isSubmitting ? (
                <><Loader2 size={18} className="spin" /> Queueing...</>
              ) : (
                <><Send size={18} /> Submit to Queue</>
              )}
            </button>
          )}
        </div>

        {/* Signature Preview */}
        {signedIntent && (
          <div className="collapsible animate-in" style={{ marginTop: '0.5rem' }}>
            <button
              className="collapsible__trigger"
              onClick={() => setShowSig(!showSig)}
              id="btn-toggle-signature"
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileSignature size={16} style={{ color: 'var(--accent-purple)' }} />
                EIP-712 Signature
              </span>
              {showSig ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
            {showSig && (
              <div className="collapsible__content">
                {signedIntent.signature}
              </div>
            )}
          </div>
        )}

        {/* Status Message */}
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
