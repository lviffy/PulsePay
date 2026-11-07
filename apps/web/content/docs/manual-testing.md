## Console basics

The merchant console reads public contract state. Selecting an address does not give permission to spend from it. Wallet transactions must be signed by the merchant account you intend to operate. The browser saves the selected merchant address locally; it does not store private keys.

The current customer checkout pays invoices in USDT on Whitechain Sepolia. Other-token settlement and CCIP transfers require separate integrations. Hedera agent payments use the paid service and agent worker.

## Every page and control

| Page or control | What it does |
| --- | --- |
| Settings → Use this address | Reads the entered merchant's public records and saves that selection in this browser. Does not connect or authorize a wallet. |
| Settings → Connect merchant wallet | Requests an EVM account, switches to Whitechain Sepolia, and selects that account as the merchant. Add the network to the wallet first if needed. |
| Settings → Network configuration | Shows the server's public hub, token, RPC, HCS topic and service settings. These are read-only here; change deployment configuration on the server. |
| Whitechain tab | Selects Whitechain billing pages. From Agents it returns to the remembered Whitechain section. |
| Hedera tab | Opens Agents and reads the paid-service manifest and configured HCS topic. Does not send a payment. |
| Invoices → Create invoice | Sets the USDT amount, optional allowed customer address and due time of 1–365 days. Review, then confirm in the wallet to create the contract record. |
| Invoice ID link | Opens customer checkout for an unpaid invoice, or its receipt when a payment record exists. Copy the checkout URL to the customer. |
| Invoice → Cancel | Cancels an OPEN invoice after review and a wallet transaction. Future payment attempts must fail. |
| Payments | Shows discovered invoices with a payment record, including refunded payments. Amounts are original settled USDT. |
| Refunds | Shows paid records eligible for inspection/refund, including records with no refund yet. It is not exclusively a list of refund events. |
| Refund | Defaults to the unpaid-back portion of the payment. Enter a full or partial amount and optional reason. Funds go to the original payer, using reserve first and then available merchant balance. |
| View | Opens the receipt. A receipt requires a settled payment; cancelled or expired unpaid invoices have no payment receipt. |
| Filter ID, customer, status | Filters currently loaded rows by invoice ID, restricted customer address or invoice status. Does not search all historical blocks. |
| Subscriptions → Create plan | Creates an amount per cycle, interval in days and maximum cycles. It does not enroll a customer. |
| Subscription → Charge | Attempts a due renewal. The contract checks time, active status, cycle limit, subscriber balance and allowance. Nothing charges automatically just because this page is open. |
| Subscription → Cancel | Cancels future renewals after wallet confirmation. Existing payments remain recorded. |
| Treasury → Fund reserve | Deposits merchant USDT into the hub's refund reserve. May require an allowance transaction followed by a funding transaction. |
| Treasury → Withdraw available | Transfers available USDT from the hub to the merchant wallet. Reserve is not part of the withdrawable balance. |
| Treasury → CCIP details / Open CCIP Explorer | Reads the configured source/destination lane and router, then opens the external CCIP explorer. This panel does not submit a bridge transfer or prove a token is supported. |
| Agents → Service manifest | Displays available paid endpoints, pricing, settlement scheme and network from the configured API. Viewing it does not buy a resource. |
| Agents → Refresh | Reloads the configured HCS topic's latest messages. |
| Agents → View | Opens the topic in HashScan. A public topic message is an audit claim; independent payment verification is still required. |
| Export CSV / Exports → Download CSV | On Whitechain, downloads settlement/refund events in the selected block window with timestamps and transaction evidence. On Hedera, exports the currently loaded audit messages. |
| Older event window | Loads the preceding block window for discovery and window-based totals. |
| Latest window | Returns to the latest block window. |
| Retry | Repeats the failed read. It does not resubmit a transaction. |
| Dismiss | Hides the transaction notification. Does not cancel a submitted transaction. |
| Review transaction | Validates the form and opens a summary. Does not submit a transaction. |
| Confirmation action, e.g. Create invoice | Connects/uses the merchant wallet, requests required transactions and waits for a receipt. |
| Back | Closes the confirmation. For form actions, returns to the form. No new transaction is submitted. |
| ESC / backdrop | Closes the dialog when it is not busy. It cannot undo a transaction already submitted. |
| Documentation / Back to PulsePay / logo | Navigates to docs or the homepage. |

## Dashboard numbers

- **Gross / loaded window:** payment events in the selected block window, before subtracting refunds.
- **Available:** current withdrawable USDT held by the hub for this merchant.
- **Refund reserve:** current reserve held by the hub. The displayed percentage is the merchant's settlement allocation policy, not a guarantee that the current balances have that ratio.
- **Refunded / loaded window:** refund events in the selected block window.
- **Balance bar:** the current split between available funds and reserve.

Balances are current contract reads even when you browse historical event windows. Invoice rows are discovered by invoice creation events in the selected window. An older invoice can be absent from the latest table even if its payment happened recently; use its saved ID or browse older windows.

## Prepare a manual test

Use two separate browser wallet accounts: merchant M and customer C. Separate browser profiles are helpful. Use Whitechain Sepolia, chain ID 1874. Both accounts need testnet WBT for gas; C needs the configured testnet USDT. M needs USDT too if testing reserve funding.

Open `/merchant/settings` and check the hub and USDT addresses. Both merchant and customer pages must use this same configuration. If the network is not already in the wallet, add it using the public configuration before connecting the merchant.

Keep the invoice ID and transaction hashes from each step. Use testnet assets and a small amount such as 0.001 USDT. The receipt artwork is generated from the ID; artwork alone is not proof of payment.

## Merchant → customer → receipt

1. As M, open Settings → Connect merchant wallet. Confirm the selected merchant is M.
2. Open Invoices → Create invoice. Enter **0.001 USDT**, customer **C**, and **7 days**. Review transaction.
3. Check that the summary, primary button, Back button and wallet notice are readable. Click Back once: no invoice should be created. Review again and click Create invoice.
4. Confirm in the wallet. Wait for Transaction confirmed. The explorer receipt should be successful and include InvoiceCreated. Find the OPEN invoice in the table. If it is not listed, confirm the current merchant and loaded block window.
5. Open the invoice ID link and copy the resulting `/pricing-free?invoice=0x...` URL to C's browser profile. Alternatively paste the full invoice ID into checkout and click Load invoice.
6. As C, check the amount and due date, then click Pay 0.001 USDT. Approve connection/network switching as needed. Confirm the exact token allowance if requested, wait, then confirm the payment transaction. Existing sufficient allowance skips the approval step.
7. Expect Payment settled only after a successful receipt with a matching PaymentSettled event. Approval alone is not settlement. Open the confirmed transaction in the explorer.
8. Click Open receipt. Verify invoice ID, merchant M, payer C, paid **0.001**, refunded **0**, and PAID status. A valid transaction link should open the payment transaction. If event history is unavailable, contract values stay visible with a warning and Retry transaction lookup; do not pay again to repair a missing link.
9. Return to M's console. Reload the page to fetch current data. Check Payments and the updated available/reserve balances. Export CSV and find the payment's transaction and amount.

## Partial refund, full refund and withdrawal

1. As M, select Refund on the paid invoice. Enter **0.0004 USDT** and a reason. Review and confirm in the wallet.
2. Verify a successful RefundIssued event, C's token balance increase, and receipt values: paid **0.001**, refunded **0.0004**, PARTIALLY REFUNDED.
3. Refund the remaining **0.0006 USDT**. Verify FULLY REFUNDED and no remaining refund action. Refresh the receipt and export CSV to check both refund events.
4. For a separate paid invoice, test Treasury → Withdraw available with an amount no greater than Available. Verify merchant wallet increase and available balance decrease after confirmation.
5. Test Fund reserve using M's USDT. Confirm allowance if requested and then funding. Verify reserve increases by that amount.
6. If withdrawals left insufficient hub funds for a refund, fund the reserve before retrying the refund. Do not expect a withdrawn balance to remain available in the contract.

## Negative tests

- Reject a wallet request: no success message or new settled record should appear. Recheck the explorer if the transaction was already submitted before an interruption.
- Enter zero, negative amounts or more than six decimal places: Review must reject the amount.
- Enter an invalid customer address or a due period outside 1–365 days: Review must reject it.
- As an account other than C, try paying a C-restricted invoice: payment must fail.
- Cancel a new unpaid invoice as M. Reload checkout: payment must be unavailable.
- Reload a paid invoice in checkout: it must not be payable again.
- Attempt a refund larger than the unpaid-back amount: Review must reject it.
- Try a withdrawal above Available: the transaction must not succeed.
- Use an invalid invoice ID: checkout/receipt should show a readable error, not a fabricated payment.

## Subscription test and current UI limit

Create plan works in the console, but there is no customer subscription-enrollment screen. Plan creation alone therefore leaves the subscription ledger empty.

To test the rest, obtain the plan ID from PlanCreated in its transaction receipt. Using the SDK with C's wallet, call `client.whitechain.createSubscription(subscriptionId, planId)`, with a fresh bytes32 subscription ID. Review any token allowance request: the current adapter can approve twelve cycles when existing allowance is insufficient. The first cycle is paid during enrollment.

Reload M's Subscriptions page. Verify cycle count and next charge date. Charge before the due time must fail. Once due, Charge should settle one renewal and advance the date/counter. Cancel should disable future renewals. The console plan form uses whole days, so a short-interval test requires creating a plan through the SDK or a local contract test environment.

## Hedera and CCIP tests

For Agents, the paid API and HCS topic must be configured and running. Select Hedera, verify the manifest's endpoint and price, run a paid request through the agent worker, then Refresh the audit table and compare with the payment receipt and HashScan. Opening the Agents tab alone does not run the worker, pay an endpoint, or prove an audit payload is a verified payment. See [x402 agents](/docs/hedera/x402-agents) and [spend policy](/docs/hedera/spend-policy).

For CCIP, Treasury can verify lane configuration and link to the explorer. A transfer test uses the bridge SDK/integration with supported tokens, fees and source-chain gas, followed by destination verification. There is no bridge-submit button in this console. See [token bridge](/docs/ccip/token-bridge).
