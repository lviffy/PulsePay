# Live merchant-console test — 2026-11-06

Completed through the actual web console on `http://localhost:3100`, using the configured Whitechain Sepolia deployment. This run supersedes the earlier read-only check with an empty environment.

- Hub: `0xC81399e6344f9264830ecB6DF46a5e9458f4f2C3`.
- Merchant and payer: `0x6105F7D9807998014ca12bF1D67849de7B1094Ac`; the same testnet account filled both roles.
- Signing: a real EIP-1193 test-wallet bridge forwarded UI requests to a funded signer in the local test process. The private key was read from `.env` and was never injected into the browser. This verifies the app’s wallet-provider path, not the MetaMask extension’s own UI.
- Every submitted write was constrained to the configured Whitechain hub or its USDT token. No mainnet or Unichain write was submitted.

## Actions exercised

| Action | Result |
| --- | --- |
| Select/connect merchant | Address saved through Settings; funded signer owns the configured hub. |
| Reject an invalid amount | Negative invoice amount rejected before signing. |
| Create and find invoice | Created a 0.01 USDT invoice through the console and matched it with the invoice filter. |
| Pay invoice | Real 0.01 USDT approval and payment through customer checkout; settlement verified. |
| Receipt | Confirmed transaction evidence displayed; final receipt reflects full refund. |
| Fund reserve | Deposited 0.01 USDT through the treasury console. |
| Partial/full refunds | Refunded 0.004 USDT, verified PARTIALLY_REFUNDED, then refunded the remaining 0.006 USDT and verified FULLY_REFUNDED. |
| Withdraw | Withdrew 0.005 USDT to the same merchant wallet. |
| Cancel invoice | Created a separate unpaid 0.001 USDT invoice, cancelled it through the console and verified CANCELLED. |
| Create plan | Created a 0.001 USDT/day plan with two maximum cycles through the console. |
| Early renewal | Rejected during gas estimation, before broadcast; cycles stayed at one. |
| Due renewal | Successfully charged cycle two through the console using a real five-second plan prepared with the SDK. |
| Cancel subscriptions | Cancelled both test subscriptions through the console and verified active=false onchain and CANCELLED in the table. |
| Download CSV | Downloaded the console CSV; all six test settlement/refund events are present with matching transaction hashes and raw amounts. |
| Hedera audit/discovery | Configured topic messages and actual paid-service discovery rendered. Authenticated API state returned verified activity; an unpaid protected request returned HTTP 402. |
| Treasury policy | Actual hook policy rendered; an attempted policy update was rejected because the connected signer is not the hook owner. No Unichain transaction was broadcast. |
| Phone layout | Invoices, subscriptions, agents, exports and settings rendered at 390×844 without page overflow. These phone checks did not repeat signed writes. |

## SDK setup and limits

The console has no subscriber-enrollment screen. The SDK encoder was used to authorize subscriptions onchain. A second, real plan with a five-second interval was also created with the SDK, allowing a due renewal to be exercised immediately through the console instead of waiting a day. Those setup transactions are labelled separately below. Both subscriptions were cancelled after testing.

The configured Unichain hook owner differs from the funded test signer, which also has no Unichain gas. Policy mutation was therefore not completed. No fresh HBAR transfer, HCS submission, distinct-customer wallet flow, or browser-extension approval interaction was tested in this run.

## Defect found and fixed

The payment settled successfully, but its receipt initially failed to load. `WhitechainAdapter.getPayment` requested event logs from block zero; the public RPC rejected that range with `query exceeds max block range 10000`, and the SDK previously swallowed the error and returned `0x` as the transaction hash.

The shared lookup now queries at most 2,000 blocks at a time. Recent settlements use a bounded window; older settlements are located by the stored onchain `paidAt` timestamp, including blocks sharing the same timestamp. Missing evidence or RPC failure raises an error. The already-paid invoice was resumed after the fix; it was not paid twice.

Three regression tests cover recent bounded reads, historical equal-timestamp blocks, and missing/unavailable evidence. The Whitechain adapter suite now has six tests.

## Final state and cost

- Confirmed transactions: **19**, including SDK setup and approval cleanup.
- Observed native-balance decrease: **0.009363392304057798 WBT** on Whitechain Sepolia. This includes the test transactions and allowance cleanup; it is not a performance/fee guarantee.
- Wallet USDT changed from 146.792375 to 146.784375 USDT.
- **0.008 USDT remains in the merchant hub:** 0.0026 USDT reserve and 0.0054 USDT available. These are real test funds, not fabricated balances.
- Token allowance was restored to its original value of zero. Both test subscriptions are cancelled. The test plans and transaction history remain onchain.

## Evidence

- Fully refunded invoice: `0x00ca64338aec24bf0ee4944c195ae64c1e17a05431f8b9c292bcda413451cc00`.
- Cancelled invoice: `0x5b73582856b1d2ba511d301612c55438a521896cc0d9e068fab27538c70ea10c`.
- [Structured results and transaction receipts](../artifacts/console-live-2026-11-06/results.json).
- [Downloaded accounting CSV](../artifacts/console-live-2026-11-06/ledger.csv).
- [Confirmed paid receipt](../artifacts/console-live-2026-11-06/04-receipt-paid.png).
- [Fully refunded receipt](../artifacts/console-live-2026-11-06/13-receipt-refunded.png).
- [Cancelled subscription ledger](../artifacts/console-live-2026-11-06/09-renewal-confirmed-and-cancelled.png).
- [Hedera console](../artifacts/console-live-2026-11-06/11-hedera-audit.png).

| Transaction | Origin | Explorer |
| --- | --- | --- |
| `createInvoice` | browser | [Confirmed transaction](https://explorer.testnet.whitechain.io/tx/0x7109c98fee799dae9688293bbb07d9b12f10b5bb17609a4c01d7b5a1d612905a) |
| `approve` | browser | [Confirmed transaction](https://explorer.testnet.whitechain.io/tx/0x4e51ceb7e322ed5aebed45b9dcdf548a9aec0c243e529709c4e75ff5c3a47c2c) |
| `payInvoice` | browser | [Confirmed transaction](https://explorer.testnet.whitechain.io/tx/0x3628afe653ef3bda982ac54fad64547eeeea2463c12b03c5a97f30958554c5df) |
| `approve` | browser | [Confirmed transaction](https://explorer.testnet.whitechain.io/tx/0x5ebccf7e3de6051bf421df9ed36d086493f6b4c0ed3adaeacaa0acbd4221087a) |
| `fundRefundReserve` | browser | [Confirmed transaction](https://explorer.testnet.whitechain.io/tx/0x6ccebe1e9d0297254902f65087b13f25958e6bcd2be4d5153f7ee581cac2cc30) |
| `issueRefund` | browser | [Confirmed transaction](https://explorer.testnet.whitechain.io/tx/0xbe5ff1de3fa25f4e5706591c836c0398cd0cd3218c62e29762f269dc4ff9032f) |
| `issueRefund` | browser | [Confirmed transaction](https://explorer.testnet.whitechain.io/tx/0xc75652d2c682fd05093551dae1880608d09e36d0ba4ed1679be5d7279a07efc7) |
| `withdrawAvailable` | browser | [Confirmed transaction](https://explorer.testnet.whitechain.io/tx/0x06af33471e44a418202aa4af2d7c8f904f0b80b84f7ecc9018b3b145f9935bd8) |
| `createInvoice` | browser | [Confirmed transaction](https://explorer.testnet.whitechain.io/tx/0x0f73ae364f95b1156a183cb74e28c9dd1be72f8d6fd8512a28468452710d0a0b) |
| `cancelInvoice` | browser | [Confirmed transaction](https://explorer.testnet.whitechain.io/tx/0x5212f3e8fe36e23830545b5f49cd047de14730d232da541cd99a305fe369e37e) |
| `createPlan` | browser | [Confirmed transaction](https://explorer.testnet.whitechain.io/tx/0xd62fa225050e3b856fc13f5871887968104e1bbfb3bf2bc305b55c07c87b77a9) |
| `approve` | SDK subscriber setup | [Confirmed transaction](https://explorer.testnet.whitechain.io/tx/0x8194fbaef409db2529042fd84d94d339471005d08da18b073266546ddb6e3b9d) |
| `createSubscription` | SDK subscriber setup | [Confirmed transaction](https://explorer.testnet.whitechain.io/tx/0x0e41fc1d3300cf906b557c0bdf025d15b917863ea51a04167ab560dae34bc955) |
| `cancelSubscription` | browser | [Confirmed transaction](https://explorer.testnet.whitechain.io/tx/0x0add49abcbc004b27ae8b49578346bc37804d1d50abf0eeab5dadbe243943214) |
| `createPlan` | SDK short-interval setup | [Confirmed transaction](https://explorer.testnet.whitechain.io/tx/0xdb64c6243145df0b248e88f6700ec791f1d864c89fe557531786d90f85f572c1) |
| `createSubscription` | SDK short-interval setup | [Confirmed transaction](https://explorer.testnet.whitechain.io/tx/0x09803f2106c9f3be13ddff50d7b7005333ae8c102873abd40dc3484db2515532) |
| `chargeRenewal` | browser | [Confirmed transaction](https://explorer.testnet.whitechain.io/tx/0xd92d3a3654b8c422516fdeae73e0e5357cc99b04dd9ddbd3b5433b056c0236cc) |
| `cancelSubscription` | browser | [Confirmed transaction](https://explorer.testnet.whitechain.io/tx/0x8206640af7a49381ed7f3bf4223a248dbe8635f6358c9ee3e01f361fe9304868) |
| `approve` | cleanup: restore original allowance | [Confirmed transaction](https://explorer.testnet.whitechain.io/tx/0x40da40a05f81cce5ef82c465574c649ee9b661a2c5a55781e5ccc67ed4b73f5c) |

## Local verification

Workspace build, lint and all 47 unit tests passed after the receipt fix. The Whitechain adapter’s six tests include three new regression checks. Foundry execution remains unavailable because `forge` is not installed.

Browser captures recorded no page exceptions. The initial receipt defect was repaired before continuing. The harness also waited for hydration before using forms, recovered from a development reload that cleared a confirmation toast after a cancellation had already succeeded, and corrected an export assertion to compare transaction hashes, which are what the CSV schema contains. No confirmed write was repeated to recover a missing toast.
