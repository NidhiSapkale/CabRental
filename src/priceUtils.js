const FALLBACK_RATE_INR = 208000;
const CACHE_KEY = 'cabRentalEthInrRate';

let cachedRate = null;
let ratePromise = null;

function getStoredRate() {
  if (typeof window === 'undefined') {
    return null;
  }

  const value = Number(sessionStorage.getItem(CACHE_KEY));
  return Number.isFinite(value) && value > 0 ? value : null;
}

export async function fetchEthToInrRate() {
  if (cachedRate) {
    return cachedRate;
  }

  const storedRate = getStoredRate();
  if (storedRate) {
    cachedRate = storedRate;
    return cachedRate;
  }

  if (ratePromise) {
    return ratePromise;
  }

  ratePromise = (async () => {
    try {
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=inr');
      if (!response.ok) {
        throw new Error('Unable to fetch ETH price');
      }

      const payload = await response.json();
      const rate = Number(payload?.ethereum?.inr);

      if (!Number.isFinite(rate) || rate <= 0) {
        throw new Error('Invalid ETH rate received');
      }

      cachedRate = rate;
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(CACHE_KEY, String(rate));
      }
      return rate;
    } catch (error) {
      cachedRate = FALLBACK_RATE_INR;
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(CACHE_KEY, String(FALLBACK_RATE_INR));
      }
      return cachedRate;
    } finally {
      ratePromise = null;
    }
  })();

  return ratePromise;
}

export function getCachedEthInrRate() {
  if (cachedRate) {
    return cachedRate;
  }

  const storedRate = getStoredRate();
  if (storedRate) {
    cachedRate = storedRate;
    return cachedRate;
  }

  return FALLBACK_RATE_INR;
}

export function ethToInr(ethAmount) {
  const safeEthAmount = Number(ethAmount) || 0;
  const rate = getCachedEthInrRate();
  return Math.round(safeEthAmount * rate);
}

export function formatEthAmount(ethAmount) {
  const amount = Number(ethAmount) || 0;
  const formattedEth = amount >= 1 ? amount.toFixed(2) : amount.toFixed(4);
  return `${formattedEth} ETH`;
}

export function formatInrFromEth(ethAmount) {
  const inrValue = ethToInr(ethAmount);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(inrValue);
}

export function getEthPriceDisplay(ethAmount) {
  const safeEthAmount = Number(ethAmount) || 0;
  const inrValue = formatInrFromEth(safeEthAmount);
  const ethText = formatEthAmount(safeEthAmount);

  return {
    inrValue,
    ethText,
    display: `${inrValue} (≈ ${ethText})`,
  };
}

