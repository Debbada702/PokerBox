import { useState, useCallback } from 'react';

const BOTTI_KEY = 'pokerbox_botti_balance';
export const BOTTI_TO_CHIPS_RATE = 100;

function loadBottiBalance(address) {
  if (!address) return 0;
  try {
    const all = JSON.parse(localStorage.getItem(BOTTI_KEY) ?? '{}');
    return Number(all[address]) || 0;
  } catch {
    return 0;
  }
}

function saveBottiBalance(address, balance) {
  const all = JSON.parse(localStorage.getItem(BOTTI_KEY) ?? '{}');
  all[address] = balance;
  localStorage.setItem(BOTTI_KEY, JSON.stringify(all));
}

/**
 * Wallet BottiCoin — mock, pronto per integrazione chain.
 */
export function useWallet() {
  const [address, setAddress] = useState(null);
  const [connected, setConnected] = useState(false);
  const [bottiBalance, setBottiBalance] = useState(0);

  const connectWallet = useCallback(async () => {
    const fakeAddress = `0x${Array.from({ length: 40 }, () =>
      Math.floor(Math.random() * 16).toString(16),
    ).join('')}`;
    setAddress(fakeAddress);
    setConnected(true);
    const existing = loadBottiBalance(fakeAddress);
    if (existing === 0) {
      saveBottiBalance(fakeAddress, 50);
      setBottiBalance(50);
    } else {
      setBottiBalance(existing);
    }
    return fakeAddress;
  }, []);

  const disconnectWallet = useCallback(() => {
    setAddress(null);
    setConnected(false);
    setBottiBalance(0);
  }, []);

  const getBalance = useCallback(async () => bottiBalance, [bottiBalance]);

  const placeBet = useCallback(async (amount) => {
    console.log('[BottiCoin] placeBet mock:', amount);
    return { success: true, mock: true };
  }, []);

  /** Converte BottiCoin → chips da gioco */
  const convertToChips = useCallback(
    async (amount, onConverted) => {
      if (!connected || !address) {
        return { ok: false, error: 'Collega prima il wallet BottiCoin' };
      }
      const n = Math.floor(Number(amount));
      if (!n || n <= 0) return { ok: false, error: 'Importo non valido' };
      if (n > bottiBalance) return { ok: false, error: 'Saldo BottiCoin insufficiente' };

      const chips = n * BOTTI_TO_CHIPS_RATE;
      const newBal = bottiBalance - n;
      saveBottiBalance(address, newBal);
      setBottiBalance(newBal);
      onConverted?.(chips);
      return { ok: true, chips, bottiSpent: n };
    },
    [connected, address, bottiBalance],
  );

  return {
    address,
    connected,
    bottiBalance,
    connectWallet,
    disconnectWallet,
    getBalance,
    placeBet,
    convertToChips,
    chipsPerBotti: BOTTI_TO_CHIPS_RATE,
  };
}
