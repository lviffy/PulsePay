// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title PulsePayHederaMerchantHub
 * @notice Hedera EVM merchant settlement with HIP-1215 autonomous renewals.
 * @dev Native HTS tokens are called through their HIP-218 ERC-20 redirect address.
 *      Low-level token calls are intentional because native tokens have no EVM bytecode.
 */
contract PulsePayHederaMerchantHub is Ownable, ReentrancyGuard {
    enum InvoiceStatus { NONE, OPEN, PAID, EXPIRED, CANCELLED }
    enum PaymentStatus { NONE, PAID, PARTIALLY_REFUNDED, FULLY_REFUNDED }

    struct Invoice {
        bytes32 invoiceId;
        address merchant;
        address customer;
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
        uint256 maxSpend;
        uint256 totalCharged;
        uint64 intervalSeconds;
        uint64 nextChargeAt;
        uint64 expiresAt;
        uint32 maxCycles;
        uint32 cyclesCharged;
        uint32 generation;
        address scheduleAddress;
        bool active;
        bool armed;
    }

    address internal constant HSS = address(0x16b);
    address internal constant HTS = address(0x167);
    int64 internal constant HEDERA_SUCCESS = 22;
    uint256 public constant BPS_DIVISOR = 10_000;
    uint64 public constant MIN_INTERVAL = 60;
    uint64 public constant MAX_INTERVAL = 30 days;
    uint256 public constant RENEWAL_GAS_LIMIT = 1_500_000;
    uint64 public constant SCHEDULE_TIME_BUFFER = 30;
    uint256 public constant MAX_SCHEDULE_DELAY = 60;

    address public immutable settlementToken;
    uint256 public defaultReserveBps;

    mapping(bytes32 => Invoice) public invoices;
    mapping(bytes32 => Payment) public payments;
    mapping(bytes32 => SubscriptionPlan) public plans;
    mapping(bytes32 => Subscription) public subscriptions;
    mapping(address => uint256) public refundReserve;
    mapping(address => uint256) public merchantAvailable;
    mapping(address => uint256) public merchantCustomReserveBps;

    event InvoiceCreated(bytes32 indexed invoiceId, address indexed merchant, address indexed customer, uint256 amount, uint64 dueAt, bytes32 metadataHash);
    event InvoiceCancelled(bytes32 indexed invoiceId, address indexed merchant);
    event PaymentSettled(bytes32 indexed invoiceId, address indexed merchant, address indexed customer, uint256 amount, uint64 paidAt);
    event RefundIssued(bytes32 indexed invoiceId, address indexed merchant, address indexed customer, uint256 amount, uint256 cumulativeRefund, bytes32 reasonHash);
    event MerchantWithdrawal(address indexed merchant, address indexed recipient, uint256 amount);
    event PlanCreated(bytes32 indexed planId, address indexed merchant, uint256 amountPerCycle, uint64 intervalSeconds, uint32 maxCycles);
    event SubscriptionCreated(bytes32 indexed subscriptionId, bytes32 indexed planId, address indexed merchant, address subscriber, uint256 amountPerCycle, uint256 maxSpend, uint64 expiresAt, uint64 nextChargeAt);
    event SubscriptionRenewed(bytes32 indexed subscriptionId, bytes32 indexed renewalId, uint32 cycleNumber, uint256 amount, uint64 nextChargeAt);
    event SubscriptionScheduled(bytes32 indexed subscriptionId, address indexed scheduleAddress, uint32 generation, uint32 cycleNumber, uint64 executeAt);
    event SubscriptionUnarmed(bytes32 indexed subscriptionId, uint32 generation, uint32 cycleNumber, int64 responseCode);
    event SubscriptionPaused(bytes32 indexed subscriptionId, uint32 generation, string reason);
    event SubscriptionCancelled(bytes32 indexed subscriptionId, address indexed cancelledBy, int64 deleteResponseCode);
    event ExecutionFunded(address indexed funder, uint256 amount, uint256 balance);
    event ExecutionFundsWithdrawn(address indexed recipient, uint256 amount);

    error ZeroAddress();
    error InvalidAmount();
    error InvalidExpiry();
    error InvalidReserveBps();
    error InvoiceAlreadyExists();
    error InvoiceNotFound();
    error InvoiceNotOpen();
    error InvoiceExpired();
    error UnauthorizedCustomer();
    error UnauthorizedMerchant();
    error PaymentNotFound();
    error RefundExceedsPaidAmount();
    error InsufficientRefundLiquidity();
    error InsufficientAvailableBalance();
    error TokenTransferFailed();
    error TokenAssociationFailed(int64 responseCode);
    error PlanAlreadyExists();
    error PlanNotFound();
    error PlanInactive();
    error SubscriptionAlreadyExists();
    error SubscriptionNotFound();
    error SubscriptionInactive();
    error SubscriptionNotDue();
    error SubscriptionLimitReached();
    error InvalidScheduleCallback();
    error UnauthorizedSubscriptionManager();
    error ExecutionWithdrawalFailed();

    constructor(address token, uint256 reserveBps, bool associateHtsToken) Ownable(msg.sender) {
        if (token == address(0)) revert ZeroAddress();
        if (reserveBps > BPS_DIVISOR) revert InvalidReserveBps();
        settlementToken = token;
        defaultReserveBps = reserveBps;
        if (associateHtsToken) {
            int64 responseCode = _associateToken(token);
            if (responseCode != HEDERA_SUCCESS) revert TokenAssociationFailed(responseCode);
        }
    }

    receive() external payable { emit ExecutionFunded(msg.sender, msg.value, address(this).balance); }

    function fundExecution() external payable {
        if (msg.value == 0) revert InvalidAmount();
        emit ExecutionFunded(msg.sender, msg.value, address(this).balance);
    }

    function withdrawExecutionFunds(uint256 amount, address payable recipient) external onlyOwner {
        if (recipient == address(0)) revert ZeroAddress();
        if (amount == 0 || amount > address(this).balance) revert InvalidAmount();
        (bool sent,) = recipient.call{value: amount}("");
        if (!sent) revert ExecutionWithdrawalFailed();
        emit ExecutionFundsWithdrawn(recipient, amount);
    }

    function setDefaultReserveBps(uint256 newBps) external onlyOwner {
        if (newBps > BPS_DIVISOR) revert InvalidReserveBps();
        defaultReserveBps = newBps;
    }

    function setMerchantReserveBps(uint256 newBps) external {
        if (newBps > BPS_DIVISOR) revert InvalidReserveBps();
        merchantCustomReserveBps[msg.sender] = newBps;
    }

    function getMerchantReserveBps(address merchant) public view returns (uint256) {
        uint256 custom = merchantCustomReserveBps[merchant];
        return custom == 0 ? defaultReserveBps : custom;
    }

    function createInvoice(bytes32 invoiceId, address customer, uint256 amount, uint64 dueAt, bytes32 metadataHash) external {
        if (invoices[invoiceId].status != InvoiceStatus.NONE) revert InvoiceAlreadyExists();
        if (amount == 0) revert InvalidAmount();
        if (dueAt <= block.timestamp) revert InvalidExpiry();
        invoices[invoiceId] = Invoice(invoiceId, msg.sender, customer, amount, dueAt, InvoiceStatus.OPEN, metadataHash);
        emit InvoiceCreated(invoiceId, msg.sender, customer, amount, dueAt, metadataHash);
    }

    function cancelInvoice(bytes32 invoiceId) external {
        Invoice storage invoice = invoices[invoiceId];
        if (invoice.status == InvoiceStatus.NONE) revert InvoiceNotFound();
        if (invoice.merchant != msg.sender) revert UnauthorizedMerchant();
        if (invoice.status != InvoiceStatus.OPEN) revert InvoiceNotOpen();
        invoice.status = InvoiceStatus.CANCELLED;
        emit InvoiceCancelled(invoiceId, msg.sender);
    }

    function payInvoice(bytes32 invoiceId) external nonReentrant {
        Invoice storage invoice = invoices[invoiceId];
        if (invoice.status == InvoiceStatus.NONE) revert InvoiceNotFound();
        if (invoice.status != InvoiceStatus.OPEN) revert InvoiceNotOpen();
        if (block.timestamp > invoice.dueAt) revert InvoiceExpired();
        if (invoice.customer != address(0) && invoice.customer != msg.sender) revert UnauthorizedCustomer();
        invoice.status = InvoiceStatus.PAID;
        invoice.customer = msg.sender;
        payments[invoiceId] = Payment(invoiceId, invoice.merchant, msg.sender, invoice.amount, 0, uint64(block.timestamp), PaymentStatus.PAID);
        _creditMerchant(invoice.merchant, invoice.amount);
        if (!_tokenTransferFrom(msg.sender, address(this), invoice.amount)) revert TokenTransferFailed();
        emit PaymentSettled(invoiceId, invoice.merchant, msg.sender, invoice.amount, uint64(block.timestamp));
    }

    function issueRefund(bytes32 invoiceId, uint256 amount, bytes32 reasonHash) external nonReentrant {
        Payment storage payment = payments[invoiceId];
        if (payment.status == PaymentStatus.NONE) revert PaymentNotFound();
        if (payment.merchant != msg.sender && owner() != msg.sender) revert UnauthorizedMerchant();
        if (amount == 0) revert InvalidAmount();
        if (amount > payment.amountPaid - payment.amountRefunded) revert RefundExceedsPaidAmount();
        uint256 reserve = refundReserve[payment.merchant];
        uint256 available = merchantAvailable[payment.merchant];
        if (amount > reserve + available) revert InsufficientRefundLiquidity();
        if (amount <= reserve) refundReserve[payment.merchant] = reserve - amount;
        else {
            refundReserve[payment.merchant] = 0;
            merchantAvailable[payment.merchant] = available - (amount - reserve);
        }
        payment.amountRefunded += amount;
        payment.status = payment.amountRefunded == payment.amountPaid ? PaymentStatus.FULLY_REFUNDED : PaymentStatus.PARTIALLY_REFUNDED;
        if (!_tokenTransfer(payment.customer, amount)) revert TokenTransferFailed();
        emit RefundIssued(invoiceId, payment.merchant, payment.customer, amount, payment.amountRefunded, reasonHash);
    }

    function withdrawAvailable(uint256 amount, address recipient) external nonReentrant {
        if (recipient == address(0)) revert ZeroAddress();
        if (amount == 0 || amount > merchantAvailable[msg.sender]) revert InsufficientAvailableBalance();
        merchantAvailable[msg.sender] -= amount;
        if (!_tokenTransfer(recipient, amount)) revert TokenTransferFailed();
        emit MerchantWithdrawal(msg.sender, recipient, amount);
    }

    function createPlan(bytes32 planId, uint256 amountPerCycle, uint64 intervalSeconds, uint32 maxCycles) external {
        if (plans[planId].merchant != address(0)) revert PlanAlreadyExists();
        if (amountPerCycle == 0 || maxCycles < 2) revert InvalidAmount();
        if (intervalSeconds < MIN_INTERVAL || intervalSeconds > MAX_INTERVAL) revert InvalidExpiry();
        plans[planId] = SubscriptionPlan(planId, msg.sender, amountPerCycle, intervalSeconds, maxCycles, true);
        emit PlanCreated(planId, msg.sender, amountPerCycle, intervalSeconds, maxCycles);
    }

    function createSubscription(bytes32 subscriptionId, bytes32 planId, uint256 maxSpend, uint64 expiresAt) external payable nonReentrant {
        if (subscriptions[subscriptionId].subscriber != address(0)) revert SubscriptionAlreadyExists();
        SubscriptionPlan storage plan = plans[planId];
        if (plan.merchant == address(0)) revert PlanNotFound();
        if (!plan.active) revert PlanInactive();
        uint64 nextChargeAt = uint64(block.timestamp + plan.intervalSeconds);
        if (maxSpend < plan.amountPerCycle || maxSpend > plan.amountPerCycle * plan.maxCycles) revert InvalidAmount();
        if (expiresAt < nextChargeAt) revert InvalidExpiry();

        Subscription storage subscription = subscriptions[subscriptionId];
        subscription.subscriptionId = subscriptionId;
        subscription.planId = planId;
        subscription.merchant = plan.merchant;
        subscription.subscriber = msg.sender;
        subscription.amountPerCycle = plan.amountPerCycle;
        subscription.maxSpend = maxSpend;
        subscription.totalCharged = plan.amountPerCycle;
        subscription.intervalSeconds = plan.intervalSeconds;
        subscription.nextChargeAt = nextChargeAt;
        subscription.expiresAt = expiresAt;
        subscription.maxCycles = plan.maxCycles;
        subscription.cyclesCharged = 1;
        subscription.generation = 1;
        subscription.active = true;

        if (msg.value > 0) emit ExecutionFunded(msg.sender, msg.value, address(this).balance);

        _creditMerchant(plan.merchant, plan.amountPerCycle);
        if (!_tokenTransferFrom(msg.sender, address(this), plan.amountPerCycle)) revert TokenTransferFailed();
        emit SubscriptionCreated(subscriptionId, planId, plan.merchant, msg.sender, plan.amountPerCycle, maxSpend, expiresAt, nextChargeAt);
        emit PaymentSettled(subscriptionId, plan.merchant, msg.sender, plan.amountPerCycle, uint64(block.timestamp));
        if (_withinSubscriptionLimits(subscription)) _armSubscription(subscription);
        else subscription.active = false;
    }

    function executeScheduledRenewal(bytes32 subscriptionId, uint32 generation, uint32 cycleNumber) external nonReentrant {
        Subscription storage subscription = subscriptions[subscriptionId];
        if (subscription.subscriber == address(0)) revert SubscriptionNotFound();
        if (!subscription.active) revert SubscriptionInactive();
        if (subscription.generation != generation || subscription.cyclesCharged + 1 != cycleNumber) revert InvalidScheduleCallback();
        if (block.timestamp < subscription.nextChargeAt) revert SubscriptionNotDue();
        subscription.armed = false;
        subscription.scheduleAddress = address(0);
        if (!_withinSubscriptionLimits(subscription)) {
            subscription.active = false;
            emit SubscriptionPaused(subscriptionId, generation, "consent limit reached");
            return;
        }
        if (!_tokenTransferFrom(subscription.subscriber, address(this), subscription.amountPerCycle)) {
            subscription.active = false;
            subscription.generation++;
            emit SubscriptionPaused(subscriptionId, generation, "token balance or allowance unavailable");
            return;
        }

        subscription.cyclesCharged++;
        subscription.totalCharged += subscription.amountPerCycle;
        bytes32 renewalId = keccak256(abi.encode(subscriptionId, generation, cycleNumber));
        _creditMerchant(subscription.merchant, subscription.amountPerCycle);
        subscription.nextChargeAt = uint64(block.timestamp + subscription.intervalSeconds);
        emit SubscriptionRenewed(subscriptionId, renewalId, subscription.cyclesCharged, subscription.amountPerCycle, subscription.nextChargeAt);
        emit PaymentSettled(renewalId, subscription.merchant, subscription.subscriber, subscription.amountPerCycle, uint64(block.timestamp));

        if (_withinSubscriptionLimits(subscription)) _armSubscription(subscription);
        else subscription.active = false;
    }

    function rearmSubscription(bytes32 subscriptionId) external payable nonReentrant {
        Subscription storage subscription = subscriptions[subscriptionId];
        if (subscription.subscriber == address(0)) revert SubscriptionNotFound();
        if (msg.sender != subscription.subscriber && msg.sender != subscription.merchant && msg.sender != owner()) revert UnauthorizedSubscriptionManager();
        if (subscription.armed) return;
        if (!_withinSubscriptionLimits(subscription)) revert SubscriptionLimitReached();
        subscription.active = true;
        subscription.generation++;
        if (msg.value > 0) emit ExecutionFunded(msg.sender, msg.value, address(this).balance);
        if (subscription.nextChargeAt <= block.timestamp) subscription.nextChargeAt = uint64(block.timestamp + MIN_INTERVAL);
        _armSubscription(subscription);
    }

    function cancelSubscription(bytes32 subscriptionId) external nonReentrant {
        Subscription storage subscription = subscriptions[subscriptionId];
        if (subscription.subscriber == address(0)) revert SubscriptionNotFound();
        if (msg.sender != subscription.subscriber && msg.sender != subscription.merchant && msg.sender != owner()) revert UnauthorizedSubscriptionManager();
        if (!subscription.active && !subscription.armed) revert SubscriptionInactive();
        address scheduleAddress = subscription.scheduleAddress;
        subscription.active = false;
        subscription.armed = false;
        subscription.scheduleAddress = address(0);
        subscription.generation++;
        int64 responseCode;
        if (scheduleAddress != address(0)) responseCode = _deleteSchedule(scheduleAddress);
        emit SubscriptionCancelled(subscriptionId, msg.sender, responseCode);
    }

    function getInvoice(bytes32 invoiceId) external view returns (Invoice memory) { return invoices[invoiceId]; }
    function getPayment(bytes32 invoiceId) external view returns (Payment memory) { return payments[invoiceId]; }
    function getPlan(bytes32 planId) external view returns (SubscriptionPlan memory) { return plans[planId]; }
    function getSubscription(bytes32 subscriptionId) external view returns (Subscription memory) { return subscriptions[subscriptionId]; }
    function getMerchantBalances(address merchant) external view returns (uint256 reserve, uint256 available) { return (refundReserve[merchant], merchantAvailable[merchant]); }

    function _withinSubscriptionLimits(Subscription storage subscription) internal view returns (bool) {
        return block.timestamp <= subscription.expiresAt && subscription.cyclesCharged < subscription.maxCycles
            && subscription.totalCharged + subscription.amountPerCycle <= subscription.maxSpend;
    }

    function _armSubscription(Subscription storage subscription) internal {
        uint64 executeAt = subscription.nextChargeAt + SCHEDULE_TIME_BUFFER;
        bool capacity;
        for (uint256 delay; delay <= MAX_SCHEDULE_DELAY; delay++) {
            executeAt = uint64(subscription.nextChargeAt + SCHEDULE_TIME_BUFFER + delay);
            if (_hasScheduleCapacity(executeAt, RENEWAL_GAS_LIMIT)) { capacity = true; break; }
        }
        uint32 cycleNumber = subscription.cyclesCharged + 1;
        if (!capacity) {
            emit SubscriptionUnarmed(subscription.subscriptionId, subscription.generation, cycleNumber, 0);
            return;
        }
        bytes memory callData = abi.encodeCall(this.executeScheduledRenewal, (subscription.subscriptionId, subscription.generation, cycleNumber));
        (int64 responseCode, address scheduleAddress) = _scheduleCall(address(this), executeAt, RENEWAL_GAS_LIMIT, 0, callData);
        if (responseCode != HEDERA_SUCCESS || scheduleAddress == address(0)) {
            emit SubscriptionUnarmed(subscription.subscriptionId, subscription.generation, cycleNumber, responseCode);
            return;
        }
        subscription.armed = true;
        subscription.scheduleAddress = scheduleAddress;
        emit SubscriptionScheduled(subscription.subscriptionId, scheduleAddress, subscription.generation, cycleNumber, executeAt);
    }

    function _creditMerchant(address merchant, uint256 amount) internal {
        uint256 reserve = amount * getMerchantReserveBps(merchant) / BPS_DIVISOR;
        refundReserve[merchant] += reserve;
        merchantAvailable[merchant] += amount - reserve;
    }

    function _tokenTransferFrom(address from, address to, uint256 amount) internal returns (bool) {
        return _callToken(abi.encodeWithSelector(IERC20.transferFrom.selector, from, to, amount));
    }

    function _tokenTransfer(address to, uint256 amount) internal returns (bool) {
        return _callToken(abi.encodeWithSelector(IERC20.transfer.selector, to, amount));
    }

    function _callToken(bytes memory callData) internal returns (bool) {
        (bool success, bytes memory result) = settlementToken.call(callData);
        return success && (result.length == 0 || (result.length == 32 && abi.decode(result, (bool))));
    }

    function _associateToken(address token) internal virtual returns (int64 responseCode) {
        (bool success, bytes memory result) = HTS.call(abi.encodeWithSignature("associateToken(address,address)", address(this), token));
        if (!success || result.length < 32) return -1;
        return abi.decode(result, (int64));
    }

    function _hasScheduleCapacity(uint256 expirySecond, uint256 gasLimit) internal view virtual returns (bool) {
        (bool success, bytes memory result) = HSS.staticcall(abi.encodeWithSelector(bytes4(0xdfb4a999), expirySecond, gasLimit));
        return success && result.length >= 32 && abi.decode(result, (bool));
    }

    function _scheduleCall(address target, uint256 expirySecond, uint256 gasLimit, uint64 value, bytes memory callData)
        internal virtual returns (int64 responseCode, address scheduleAddress)
    {
        (bool success, bytes memory result) = HSS.call(abi.encodeWithSelector(bytes4(0x6f5bfde8), target, expirySecond, gasLimit, value, callData));
        if (!success || result.length < 64) return (-1, address(0));
        return abi.decode(result, (int64, address));
    }

    function _deleteSchedule(address scheduleAddress) internal virtual returns (int64 responseCode) {
        (bool success, bytes memory result) = HSS.call(abi.encodeWithSelector(bytes4(0x72d42394), scheduleAddress));
        if (!success || result.length < 32) return -1;
        return abi.decode(result, (int64));
    }
}

