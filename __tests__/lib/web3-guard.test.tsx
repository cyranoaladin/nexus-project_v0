import React from 'react';
import { render } from '@testing-library/react';
import { getSafeEthereum, hasWeb3Extension, useWeb3Guard } from '@/lib/web3-guard';

function GuardHarness() {
  useWeb3Guard();
  return <div>guard</div>;
}

describe('web3-guard', () => {
  beforeEach(() => {
    // Ensure a clean window state
    const win = window as Window & { ethereum?: unknown; web3?: unknown };
    delete win.ethereum;
    delete win.web3;
  });

  it('detects web3 extension presence', () => {
    expect(hasWeb3Extension()).toBe(false);
    (window as Window & { ethereum?: unknown }).ethereum = {};
    expect(hasWeb3Extension()).toBe(true);
  });

  it('returns ethereum safely', () => {
    expect(getSafeEthereum()).toBeNull();
    const eth = { isMetaMask: true };
    (window as Window & { ethereum?: unknown }).ethereum = eth;
    expect(getSafeEthereum()).toBe(eth);
  });

  it('filters noisy web3 console errors and restores on cleanup', () => {
    const spy = jest.fn();
    console.error = spy;

    const { unmount } = render(<GuardHarness />);

    console.error('MetaMask: Something went wrong');
    expect(spy).not.toHaveBeenCalled();

    console.error('Non web3 error');
    expect(spy).toHaveBeenCalledTimes(1);

    unmount();
    expect(console.error).toBe(spy);
  });
});
