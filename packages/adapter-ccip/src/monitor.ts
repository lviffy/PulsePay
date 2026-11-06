import { CCIP_EXPLORER_BASE_URL } from './constants.js';

export interface BridgeMessageStatus {
  messageId: string;
  status: string;
  destinationTransactionHash: string | null;
  explorerUrl: string;
}

/** Read-only Chainlink indexer client. A source receipt alone is never delivery proof. */
export class CCIPMessageMonitor {
  constructor(private readonly fetcher: typeof fetch = fetch) {}

  async getStatus(messageId: string, signal?: AbortSignal): Promise<BridgeMessageStatus> {
    if (!/^0x[0-9a-fA-F]{64}$/.test(messageId)) throw new Error('CCIP message ID must be bytes32');
    const response = await this.fetcher(`https://api.ccip.chain.link/v2/messages/${messageId}`, {
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(12000)]) : AbortSignal.timeout(12000),
      headers: { Accept: 'application/json' },
    });
    if (response.status === 404) return { messageId, status: 'NOT_INDEXED', destinationTransactionHash: null, explorerUrl: `${CCIP_EXPLORER_BASE_URL}/${messageId}` };
    if (!response.ok) throw new Error(`CCIP status service returned ${response.status}`);
    const body = await response.json() as { status?: unknown; receiptTransactionHash?: unknown };
    if (typeof body.status !== 'string') throw new Error('Invalid CCIP status response');
    return {
      messageId, status: body.status,
      destinationTransactionHash: typeof body.receiptTransactionHash === 'string' ? body.receiptTransactionHash : null,
      explorerUrl: `${CCIP_EXPLORER_BASE_URL}/${messageId}`,
    };
  }

  /** Poll until destination success/failure. Indexing delays stay pending; outages throw. */
  async waitForDelivery(messageId: string, options: { signal?: AbortSignal; timeoutMs?: number; intervalMs?: number } = {}) {
    const timeoutMs = options.timeoutMs ?? 600000;
    const intervalMs = options.intervalMs ?? 10000;
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || !Number.isFinite(intervalMs) || intervalMs <= 0) throw new Error('Polling times must be positive');
    const timeout = AbortSignal.timeout(timeoutMs);
    const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
    while (true) {
      signal.throwIfAborted();
      const status = await this.getStatus(messageId, signal);
      if (status.status === 'SUCCESS' || status.status === 'FAILED') return status;
      await new Promise<void>((resolve, reject) => {
        const abort = () => { clearTimeout(timer); reject(signal.reason); };
        const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, intervalMs);
        signal.addEventListener('abort', abort, { once: true });
        if (signal.aborted) abort();
      });
    }
  }
}
