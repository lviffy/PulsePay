// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title PulsePayMerchantHub
 * @notice Core merchant settlement contract on Whitechain Sepolia for PulsePay.
 * Handles invoices, exact USDT stablecoin payments, reserve-backed verifiable refunds,
 * and recurring subscription billing.
 */
contract PulsePayMerchantHub is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // --- Enums ---
    enum InvoiceStatus {
        NONE,
        OPEN,
        PAID,
        EXPIRED,
        CANCELLED
    }

    enum PaymentStatus {
        NONE,
        PAID,
        PARTIALLY_REFUNDED,
        FULLY_REFUNDED
    }

    // --- Structs ---
    struct Invoice {
        bytes32 invoiceId;
        address merchant;
        address customer; // address(0) allows any payer
        uint256 amount;
        uint64 dueAt;
        InvoiceStatus status;
        bytes32 metadataHash;
    }

    struct Payment {
        bytes32 invoiceId;
        address merchant;
        address customer;
        uint256 amountPaid;
        uint256 amountRefunded;
        uint64 paidAt;
        PaymentStatus status;
    }

    struct SubscriptionPlan {
        bytes32 planId;
        address merchant;
        uint256 amountPerCycle;
        uint64 intervalSeconds;
        uint32 maxCycles;
        bool active;
    }

    struct Subscription {
        bytes32 subscriptionId;
        bytes32 planId;
        address merchant;
        address subscriber;
        uint256 amountPerCycle;
        uint64 intervalSeconds;
        uint64 nextChargeAt;
        uint32 maxCycles;
        uint32 cyclesCharged;
        bool active;
    }

    // --- Immutable State ---
    /// @notice Official Whitechain Sepolia USDT token address
    IERC20 public immutable USDT;

    /// @notice Basis points divisor (10000 = 100%)
    uint256 public constant BPS_DIVISOR = 10_000;

    // --- Configurable State ---
    /// @notice Default reserve percentage in BPS (e.g. 2000 = 20%)
    uint256 public defaultReserveBps;

    // --- Mappings ---
    mapping(bytes32 => Invoice) public invoices;
    mapping(bytes32 => Payment) public payments;
    mapping(bytes32 => SubscriptionPlan) public plans;
    mapping(bytes32 => Subscription) public subscriptions;
    mapping(bytes32 => bool) public processedRenewals;

    // Merchant balances
    mapping(address => uint256) public refundReserve;
    mapping(address => uint256) public merchantAvailable;
    mapping(address => uint256) public merchantCustomReserveBps;

    // --- Events ---
    event InvoiceCreated(
        bytes32 indexed invoiceId,
        address indexed merchant,
        address indexed customer,
        uint256 amount,
        uint64 dueAt,
        bytes32 metadataHash
    );

    event InvoiceCancelled(bytes32 indexed invoiceId, address indexed merchant);

    event PaymentSettled(
        bytes32 indexed invoiceId,
        address indexed merchant,
        address indexed customer,
        uint256 amount,
        uint64 paidAt
    );

    event RefundIssued(
        bytes32 indexed invoiceId,
        address indexed merchant,
        address indexed customer,
        uint256 amount,
        uint256 cumulativeRefund,
        bytes32 reasonHash
    );

    event RefundReserveFunded(address indexed merchant, uint256 amount, uint256 newReserveBalance);

    event MerchantWithdrawal(address indexed merchant, address indexed recipient, uint256 amount);

    event DefaultReserveBpsUpdated(uint256 oldBps, uint256 newBps);

    event MerchantReserveBpsUpdated(address indexed merchant, uint256 newBps);

    event PlanCreated(
        bytes32 indexed planId,
        address indexed merchant,
        uint256 amountPerCycle,
        uint64 intervalSeconds,
        uint32 maxCycles
    );

    event SubscriptionCreated(
        bytes32 indexed subscriptionId,
        bytes32 indexed planId,
        address indexed merchant,
        address subscriber,
        uint256 amountPerCycle,
        uint64 nextChargeAt
    );

    event SubscriptionRenewed(
        bytes32 indexed subscriptionId,
        bytes32 indexed renewalId,
        uint32 cycleNumber,
        uint256 amount,
        uint64 nextChargeAt
    );

    event SubscriptionCancelled(bytes32 indexed subscriptionId, address indexed cancelledBy);

    // --- Custom Errors ---
    error ZeroAddress();
    error InvalidAmount();
    error InvalidExpiry();
    error InvoiceAlreadyExists();
    error InvoiceNotFound();
    error InvoiceNotOpen();
    error InvoiceExpired();
    error UnauthorizedCustomer();
    error UnauthorizedMerchant();
    error PaymentAlreadySettled();
    error PaymentNotFound();
    error RefundExceedsPaidAmount();
    error InsufficientRefundLiquidity();
    error PlanAlreadyExists();
    error PlanNotFound();
    error PlanInactive();
    error SubscriptionAlreadyExists();
    error SubscriptionNotFound();
    error SubscriptionInactive();
    error SubscriptionNotDue();
    error SubscriptionCycleCapReached();
    error DuplicateRenewal();
    error InsufficientAvailableBalance();
    error InvalidReserveBps();

    /**
     * @param _usdt Address of the official USDT contract on Whitechain Sepolia
     * @param _defaultReserveBps Default refund reserve percentage in basis points (e.g. 2000 for 20%)
     */
    constructor(address _usdt, uint256 _defaultReserveBps) Ownable(msg.sender) {
        if (_usdt == address(0)) revert ZeroAddress();
        if (_defaultReserveBps > BPS_DIVISOR) revert InvalidReserveBps();

        USDT = IERC20(_usdt);
        defaultReserveBps = _defaultReserveBps;
    }

    // --- Configuration Functions ---

    function setDefaultReserveBps(uint256 _newBps) external onlyOwner {
        if (_newBps > BPS_DIVISOR) revert InvalidReserveBps();
        uint256 oldBps = defaultReserveBps;
        defaultReserveBps = _newBps;
        emit DefaultReserveBpsUpdated(oldBps, _newBps);
    }

    function setMerchantReserveBps(uint256 _newBps) external {
        if (_newBps > BPS_DIVISOR) revert InvalidReserveBps();
        merchantCustomReserveBps[msg.sender] = _newBps;
        emit MerchantReserveBpsUpdated(msg.sender, _newBps);
    }

    function getMerchantReserveBps(address _merchant) public view returns (uint256) {
        uint256 customBps = merchantCustomReserveBps[_merchant];
        return customBps > 0 ? customBps : defaultReserveBps;
    }

    // --- Invoice Lifecycle ---

    /**
     * @notice Create a unique one-time invoice.
     * @param invoiceId Unique 32-byte identifier for the invoice
     * @param customer Specific allowed customer address (or address(0) for any payer)
     * @param amount USDT amount in smallest token units
     * @param dueAt Expiration timestamp in seconds
     * @param metadataHash Hash of offchain invoice metadata (e.g. IPFS/JSON)
     */
    function createInvoice(
        bytes32 invoiceId,
        address customer,
        uint256 amount,
        uint64 dueAt,
        bytes32 metadataHash
    ) external {
        if (invoices[invoiceId].status != InvoiceStatus.NONE) revert InvoiceAlreadyExists();
        if (amount == 0) revert InvalidAmount();
        if (dueAt <= block.timestamp) revert InvalidExpiry();

        invoices[invoiceId] = Invoice({
            invoiceId: invoiceId,
            merchant: msg.sender,
            customer: customer,
            amount: amount,
            dueAt: dueAt,
            status: InvoiceStatus.OPEN,
            metadataHash: metadataHash
        });

        emit InvoiceCreated(invoiceId, msg.sender, customer, amount, dueAt, metadataHash);
    }

    /**
     * @notice Merchant cancels an open, unpaid invoice.
     */
    function cancelInvoice(bytes32 invoiceId) external {
        Invoice storage inv = invoices[invoiceId];
        if (inv.status == InvoiceStatus.NONE) revert InvoiceNotFound();
        if (inv.merchant != msg.sender) revert UnauthorizedMerchant();
        if (inv.status != InvoiceStatus.OPEN) revert InvoiceNotOpen();

        inv.status = InvoiceStatus.CANCELLED;
        emit InvoiceCancelled(invoiceId, msg.sender);
    }

    /**
     * @notice Pay an open invoice in official USDT.
     */
    function payInvoice(bytes32 invoiceId) external nonReentrant {
        Invoice storage inv = invoices[invoiceId];
        if (inv.status == InvoiceStatus.NONE) revert InvoiceNotFound();
        if (inv.status != InvoiceStatus.OPEN) revert InvoiceNotOpen();
        if (block.timestamp > inv.dueAt) {
            inv.status = InvoiceStatus.EXPIRED;
            revert InvoiceExpired();
        }
        if (inv.customer != address(0) && inv.customer != msg.sender) {
            revert UnauthorizedCustomer();
        }

        address payer = msg.sender;
        uint256 amount = inv.amount;
        address merchant = inv.merchant;

        // Mark invoice as paid
        inv.status = InvoiceStatus.PAID;
        if (inv.customer == address(0)) {
            inv.customer = payer;
        }

        // Record payment details
        payments[invoiceId] = Payment({
            invoiceId: invoiceId,
            merchant: merchant,
            customer: payer,
            amountPaid: amount,
            amountRefunded: 0,
            paidAt: uint64(block.timestamp),
            status: PaymentStatus.PAID
        });

        // Split funds into reserve and merchant available balance
        uint256 reserveBps = getMerchantReserveBps(merchant);
        uint256 reserveAmount = (amount * reserveBps) / BPS_DIVISOR;
        uint256 availableAmount = amount - reserveAmount;

        refundReserve[merchant] += reserveAmount;
        merchantAvailable[merchant] += availableAmount;

        // Pull USDT from customer to this contract
        USDT.safeTransferFrom(payer, address(this), amount);

        emit PaymentSettled(invoiceId, merchant, payer, amount, uint64(block.timestamp));
    }

    // --- Refunds & Reserve Management ---

    /**
     * @notice Merchant issues a full or partial refund to the original customer.
     * Guaranteed to refund the original payer, bounded by amountPaid - amountRefunded.
     * Draws from refundReserve first, then merchantAvailable if needed.
     */
    function issueRefund(
        bytes32 invoiceId,
        uint256 refundAmount,
        bytes32 reasonHash
    ) external nonReentrant {
        Payment storage p = payments[invoiceId];
        if (p.status == PaymentStatus.NONE) revert PaymentNotFound();
        if (p.merchant != msg.sender && owner() != msg.sender) revert UnauthorizedMerchant();
        if (refundAmount == 0) revert InvalidAmount();

        uint256 remainingRefundable = p.amountPaid - p.amountRefunded;
        if (refundAmount > remainingRefundable) revert RefundExceedsPaidAmount();

        address merchant = p.merchant;
        uint256 currentReserve = refundReserve[merchant];
        uint256 currentAvailable = merchantAvailable[merchant];
        uint256 totalMerchantLiquidity = currentReserve + currentAvailable;

        if (refundAmount > totalMerchantLiquidity) revert InsufficientRefundLiquidity();

        // Accounting: consume reserve first, then merchantAvailable
        if (refundAmount <= currentReserve) {
            refundReserve[merchant] -= refundAmount;
        } else {
            uint256 fromAvailable = refundAmount - currentReserve;
            refundReserve[merchant] = 0;
            merchantAvailable[merchant] -= fromAvailable;
        }

        p.amountRefunded += refundAmount;
        if (p.amountRefunded == p.amountPaid) {
            p.status = PaymentStatus.FULLY_REFUNDED;
        } else {
            p.status = PaymentStatus.PARTIALLY_REFUNDED;
        }

        // Transfer funds back to the original customer
        USDT.safeTransfer(p.customer, refundAmount);

        emit RefundIssued(
            invoiceId,
            merchant,
            p.customer,
            refundAmount,
            p.amountRefunded,
            reasonHash
        );
    }

    /**
     * @notice Fund the merchant refund reserve with additional USDT liquidity.
     */
    function fundRefundReserve(uint256 amount) external nonReentrant {
        if (amount == 0) revert InvalidAmount();
        refundReserve[msg.sender] += amount;

        USDT.safeTransferFrom(msg.sender, address(this), amount);
        emit RefundReserveFunded(msg.sender, amount, refundReserve[msg.sender]);
    }

    /**
     * @notice Withdraw from merchant available balance (does not touch refund reserve).
     */
    function withdrawAvailable(uint256 amount, address to) external nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert InvalidAmount();
        if (amount > merchantAvailable[msg.sender]) revert InsufficientAvailableBalance();

        merchantAvailable[msg.sender] -= amount;
        USDT.safeTransfer(to, amount);

        emit MerchantWithdrawal(msg.sender, to, amount);
    }

    // --- Subscription Lifecycle ---

    /**
     * @notice Merchant creates a recurring subscription plan.
     */
    function createPlan(
        bytes32 planId,
        uint256 amountPerCycle,
        uint64 intervalSeconds,
        uint32 maxCycles
    ) external {
        if (plans[planId].merchant != address(0)) revert PlanAlreadyExists();
        if (amountPerCycle == 0) revert InvalidAmount();
        if (intervalSeconds == 0) revert InvalidExpiry();

        plans[planId] = SubscriptionPlan({
            planId: planId,
            merchant: msg.sender,
            amountPerCycle: amountPerCycle,
            intervalSeconds: intervalSeconds,
            maxCycles: maxCycles,
            active: true
        });

        emit PlanCreated(planId, msg.sender, amountPerCycle, intervalSeconds, maxCycles);
    }

    /**
     * @notice Subscriber authorizes and activates a subscription, paying the 1st cycle.
     */
    function createSubscription(bytes32 subscriptionId, bytes32 planId) external nonReentrant {
        if (subscriptions[subscriptionId].subscriber != address(0)) {
            revert SubscriptionAlreadyExists();
        }

        SubscriptionPlan storage plan = plans[planId];
        if (plan.merchant == address(0)) revert PlanNotFound();
        if (!plan.active) revert PlanInactive();

        address subscriber = msg.sender;
        address merchant = plan.merchant;
        uint256 amount = plan.amountPerCycle;
        uint64 nextCharge = uint64(block.timestamp + plan.intervalSeconds);

        subscriptions[subscriptionId] = Subscription({
            subscriptionId: subscriptionId,
            planId: planId,
            merchant: merchant,
            subscriber: subscriber,
            amountPerCycle: amount,
            intervalSeconds: plan.intervalSeconds,
            nextChargeAt: nextCharge,
            maxCycles: plan.maxCycles,
            cyclesCharged: 1,
            active: true
        });

        // Split funds into reserve and merchant available
        uint256 reserveBps = getMerchantReserveBps(merchant);
        uint256 reserveAmount = (amount * reserveBps) / BPS_DIVISOR;
        uint256 availableAmount = amount - reserveAmount;

        refundReserve[merchant] += reserveAmount;
        merchantAvailable[merchant] += availableAmount;

        // Pull first cycle payment from subscriber
        USDT.safeTransferFrom(subscriber, address(this), amount);

        emit SubscriptionCreated(
            subscriptionId,
            planId,
            merchant,
            subscriber,
            amount,
            nextCharge
        );
        emit PaymentSettled(subscriptionId, merchant, subscriber, amount, uint64(block.timestamp));
    }

    /**
     * @notice Keeper/relayer executes a due subscription renewal.
     * Enforces active state, due timestamp, and cycle caps onchain.
     */
    function chargeRenewal(bytes32 subscriptionId, bytes32 renewalId) external nonReentrant {
        if (processedRenewals[renewalId]) revert DuplicateRenewal();

        Subscription storage sub = subscriptions[subscriptionId];
        if (sub.subscriber == address(0)) revert SubscriptionNotFound();
        if (!sub.active) revert SubscriptionInactive();
        if (block.timestamp < sub.nextChargeAt) revert SubscriptionNotDue();
        if (sub.maxCycles > 0 && sub.cyclesCharged >= sub.maxCycles) {
            revert SubscriptionCycleCapReached();
        }

        processedRenewals[renewalId] = true;
        sub.cyclesCharged++;
        sub.nextChargeAt += sub.intervalSeconds;

        address merchant = sub.merchant;
        address subscriber = sub.subscriber;
        uint256 amount = sub.amountPerCycle;

        // Split funds
        uint256 reserveBps = getMerchantReserveBps(merchant);
        uint256 reserveAmount = (amount * reserveBps) / BPS_DIVISOR;
        uint256 availableAmount = amount - reserveAmount;

        refundReserve[merchant] += reserveAmount;
        merchantAvailable[merchant] += availableAmount;

        // Pull renewal payment from subscriber
        USDT.safeTransferFrom(subscriber, address(this), amount);

        emit SubscriptionRenewed(
            subscriptionId,
            renewalId,
            sub.cyclesCharged,
            amount,
            sub.nextChargeAt
        );
        emit PaymentSettled(renewalId, merchant, subscriber, amount, uint64(block.timestamp));
    }

    /**
     * @notice Subscriber or merchant cancels subscription, immediately disabling future charges.
     */
    function cancelSubscription(bytes32 subscriptionId) external {
        Subscription storage sub = subscriptions[subscriptionId];
        if (sub.subscriber == address(0)) revert SubscriptionNotFound();
        if (msg.sender != sub.subscriber && msg.sender != sub.merchant && msg.sender != owner()) {
            revert UnauthorizedCustomer();
        }
        if (!sub.active) revert SubscriptionInactive();

        sub.active = false;
        emit SubscriptionCancelled(subscriptionId, msg.sender);
    }

    // --- View Helpers ---

    function getInvoice(bytes32 invoiceId) external view returns (Invoice memory) {
        return invoices[invoiceId];
    }

    function getPayment(bytes32 invoiceId) external view returns (Payment memory) {
        return payments[invoiceId];
    }

    function getSubscription(bytes32 subscriptionId) external view returns (Subscription memory) {
        return subscriptions[subscriptionId];
    }

    function getPlan(bytes32 planId) external view returns (SubscriptionPlan memory) {
        return plans[planId];
    }

    function getMerchantBalances(address merchant) external view returns (uint256 reserve, uint256 available) {
        return (refundReserve[merchant], merchantAvailable[merchant]);
    }
}
