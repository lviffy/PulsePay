// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {PulsePayMerchantHub} from "../src/PulsePayMerchantHub.sol";
import {MockUSDT} from "./mocks/MockUSDT.sol";

contract PulsePayMerchantHubTest is Test {
    PulsePayMerchantHub public hub;
    MockUSDT public usdt;

    address public owner = address(this);
    address public merchant = makeAddr("merchant");
    address public customer = makeAddr("customer");
    address public stranger = makeAddr("stranger");
    address public keeper = makeAddr("keeper");

    uint256 public constant DEFAULT_RESERVE_BPS = 2000; // 20%
    uint256 public constant INITIAL_BALANCE = 10_000 * 1e6; // 10,000 USDT

    bytes32 public constant INVOICE_ID = keccak256("inv_001");
    bytes32 public constant PLAN_ID = keccak256("plan_pro_monthly");
    bytes32 public constant SUB_ID = keccak256("sub_user_001");

    function setUp() public {
        usdt = new MockUSDT();
        hub = new PulsePayMerchantHub(address(usdt), DEFAULT_RESERVE_BPS);

        // Fund customer and merchant
        usdt.mint(customer, INITIAL_BALANCE);
        usdt.mint(merchant, INITIAL_BALANCE);

        vm.prank(customer);
        usdt.approve(address(hub), type(uint256).max);

        vm.prank(merchant);
        usdt.approve(address(hub), type(uint256).max);
    }

    // --- Constructor & Config Tests ---

    function test_constructor_config() public view {
        assertEq(address(hub.USDT()), address(usdt));
        assertEq(hub.defaultReserveBps(), DEFAULT_RESERVE_BPS);
        assertEq(hub.owner(), owner);
    }

    function test_setReserveBps() public {
        hub.setDefaultReserveBps(2500);
        assertEq(hub.defaultReserveBps(), 2500);

        vm.prank(merchant);
        hub.setMerchantReserveBps(1500);
        assertEq(hub.getMerchantReserveBps(merchant), 1500);
        assertEq(hub.getMerchantReserveBps(stranger), 2500);
    }

    // --- Invoice Creation & Cancellation Tests ---

    function test_createInvoice_success() public {
        uint256 amount = 20 * 1e6;
        uint64 dueAt = uint64(block.timestamp + 1 days);
        bytes32 meta = keccak256("order_details");

        vm.prank(merchant);
        hub.createInvoice(INVOICE_ID, customer, amount, dueAt, meta);

        PulsePayMerchantHub.Invoice memory inv = hub.getInvoice(INVOICE_ID);
        assertEq(inv.merchant, merchant);
        assertEq(inv.customer, customer);
        assertEq(inv.amount, amount);
        assertEq(inv.dueAt, dueAt);
        assertEq(uint256(inv.status), uint256(PulsePayMerchantHub.InvoiceStatus.OPEN));
    }

    function test_createInvoice_revert_duplicate() public {
        uint256 amount = 20 * 1e6;
        uint64 dueAt = uint64(block.timestamp + 1 days);

        vm.prank(merchant);
        hub.createInvoice(INVOICE_ID, customer, amount, dueAt, bytes32(0));

        vm.prank(merchant);
        vm.expectRevert(PulsePayMerchantHub.InvoiceAlreadyExists.selector);
        hub.createInvoice(INVOICE_ID, customer, amount, dueAt, bytes32(0));
    }

    function test_createInvoice_revert_invalidExpiry() public {
        vm.prank(merchant);
        vm.expectRevert(PulsePayMerchantHub.InvalidExpiry.selector);
        hub.createInvoice(INVOICE_ID, customer, 20 * 1e6, uint64(block.timestamp), bytes32(0));
    }

    function test_cancelInvoice_success() public {
        vm.prank(merchant);
        hub.createInvoice(INVOICE_ID, customer, 20 * 1e6, uint64(block.timestamp + 1 days), bytes32(0));

        vm.prank(merchant);
        hub.cancelInvoice(INVOICE_ID);

        PulsePayMerchantHub.Invoice memory inv = hub.getInvoice(INVOICE_ID);
        assertEq(uint256(inv.status), uint256(PulsePayMerchantHub.InvoiceStatus.CANCELLED));
    }

    function test_cancelInvoice_unauthorized() public {
        vm.prank(merchant);
        hub.createInvoice(INVOICE_ID, customer, 20 * 1e6, uint64(block.timestamp + 1 days), bytes32(0));

        vm.prank(stranger);
        vm.expectRevert(PulsePayMerchantHub.UnauthorizedMerchant.selector);
        hub.cancelInvoice(INVOICE_ID);
    }

    // --- Invoice Payment & Split Accounting Tests ---

    function test_payInvoice_success() public {
        uint256 amount = 100 * 1e6; // 100 USDT
        uint64 dueAt = uint64(block.timestamp + 1 days);

        vm.prank(merchant);
        hub.createInvoice(INVOICE_ID, customer, amount, dueAt, bytes32(0));

        uint256 customerBalBefore = usdt.balanceOf(customer);

        vm.prank(customer);
        hub.payInvoice(INVOICE_ID);

        // Verify balances
        assertEq(usdt.balanceOf(customer), customerBalBefore - amount);
        assertEq(usdt.balanceOf(address(hub)), amount);

        // Verify split accounting: 20% reserve (20 USDT) and 80% available (80 USDT)
        (uint256 reserve, uint256 available) = hub.getMerchantBalances(merchant);
        assertEq(reserve, 20 * 1e6);
        assertEq(available, 80 * 1e6);

        // Verify invoice and payment records
        PulsePayMerchantHub.Invoice memory inv = hub.getInvoice(INVOICE_ID);
        assertEq(uint256(inv.status), uint256(PulsePayMerchantHub.InvoiceStatus.PAID));

        PulsePayMerchantHub.Payment memory p = hub.getPayment(INVOICE_ID);
        assertEq(p.merchant, merchant);
        assertEq(p.customer, customer);
        assertEq(p.amountPaid, amount);
        assertEq(p.amountRefunded, 0);
        assertEq(uint256(p.status), uint256(PulsePayMerchantHub.PaymentStatus.PAID));
    }

    function test_payInvoice_revert_expired() public {
        uint64 dueAt = uint64(block.timestamp + 1 hours);
        vm.prank(merchant);
        hub.createInvoice(INVOICE_ID, customer, 20 * 1e6, dueAt, bytes32(0));

        vm.warp(block.timestamp + 2 hours);

        vm.prank(customer);
        vm.expectRevert(PulsePayMerchantHub.InvoiceExpired.selector);
        hub.payInvoice(INVOICE_ID);
    }

    function test_payInvoice_revert_customerMismatch() public {
        vm.prank(merchant);
        hub.createInvoice(INVOICE_ID, customer, 20 * 1e6, uint64(block.timestamp + 1 days), bytes32(0));

        vm.prank(stranger);
        vm.expectRevert(PulsePayMerchantHub.UnauthorizedCustomer.selector);
        hub.payInvoice(INVOICE_ID);
    }

    function test_payInvoice_publicCustomer() public {
        // address(0) customer allows anyone to pay
        vm.prank(merchant);
        hub.createInvoice(INVOICE_ID, address(0), 50 * 1e6, uint64(block.timestamp + 1 days), bytes32(0));

        vm.prank(customer);
        hub.payInvoice(INVOICE_ID);

        PulsePayMerchantHub.Invoice memory inv = hub.getInvoice(INVOICE_ID);
        assertEq(inv.customer, customer);
    }

    // --- Refund Lifecycle Tests ---

    function test_issueRefund_partial_and_full() public {
        uint256 amount = 100 * 1e6; // 100 USDT
        vm.prank(merchant);
        hub.createInvoice(INVOICE_ID, customer, amount, uint64(block.timestamp + 1 days), bytes32(0));

        vm.prank(customer);
        hub.payInvoice(INVOICE_ID);

        uint256 customerBalAfterPay = usdt.balanceOf(customer);

        // Step 1: Merchant issues partial refund of 10 USDT
        vm.prank(merchant);
        hub.issueRefund(INVOICE_ID, 10 * 1e6, keccak256("partial_discount"));

        assertEq(usdt.balanceOf(customer), customerBalAfterPay + 10 * 1e6);

        PulsePayMerchantHub.Payment memory p1 = hub.getPayment(INVOICE_ID);
        assertEq(p1.amountRefunded, 10 * 1e6);
        assertEq(uint256(p1.status), uint256(PulsePayMerchantHub.PaymentStatus.PARTIALLY_REFUNDED));

        // Reserve had 20, now has 10. Available still has 80.
        (uint256 res1, uint256 avail1) = hub.getMerchantBalances(merchant);
        assertEq(res1, 10 * 1e6);
        assertEq(avail1, 80 * 1e6);

        // Step 2: Merchant refunds remaining 90 USDT (exceeds remaining 10 in reserve, dips into available)
        vm.prank(merchant);
        hub.issueRefund(INVOICE_ID, 90 * 1e6, keccak256("full_satisfaction"));

        assertEq(usdt.balanceOf(customer), customerBalAfterPay + 100 * 1e6);

        PulsePayMerchantHub.Payment memory p2 = hub.getPayment(INVOICE_ID);
        assertEq(p2.amountRefunded, 100 * 1e6);
        assertEq(uint256(p2.status), uint256(PulsePayMerchantHub.PaymentStatus.FULLY_REFUNDED));

        (uint256 res2, uint256 avail2) = hub.getMerchantBalances(merchant);
        assertEq(res2, 0);
        assertEq(avail2, 0);
    }

    function test_issueRefund_revert_exceedsPaid() public {
        uint256 amount = 50 * 1e6;
        vm.prank(merchant);
        hub.createInvoice(INVOICE_ID, customer, amount, uint64(block.timestamp + 1 days), bytes32(0));

        vm.prank(customer);
        hub.payInvoice(INVOICE_ID);

        vm.prank(merchant);
        vm.expectRevert(PulsePayMerchantHub.RefundExceedsPaidAmount.selector);
        hub.issueRefund(INVOICE_ID, 51 * 1e6, bytes32(0));
    }

    // --- Fund Reserve & Withdraw Available Tests ---

    function test_fundRefundReserve_and_withdrawAvailable() public {
        // Fund reserve
        vm.prank(merchant);
        hub.fundRefundReserve(500 * 1e6);

        (uint256 res, ) = hub.getMerchantBalances(merchant);
        assertEq(res, 500 * 1e6);

        // Pay an invoice to generate available proceeds
        vm.prank(merchant);
        hub.createInvoice(INVOICE_ID, customer, 100 * 1e6, uint64(block.timestamp + 1 days), bytes32(0));

        vm.prank(customer);
        hub.payInvoice(INVOICE_ID);

        // Merchant available is 80 USDT
        address payout = makeAddr("payout");
        vm.prank(merchant);
        hub.withdrawAvailable(80 * 1e6, payout);

        assertEq(usdt.balanceOf(payout), 80 * 1e6);

        (, uint256 availAfter) = hub.getMerchantBalances(merchant);
        assertEq(availAfter, 0);

        // Cannot withdraw more
        vm.prank(merchant);
        vm.expectRevert(PulsePayMerchantHub.InsufficientAvailableBalance.selector);
        hub.withdrawAvailable(1 * 1e6, payout);
    }

    // --- Subscriptions Lifecycle Tests ---

    function test_subscription_lifecycle() public {
        uint256 cycleAmount = 20 * 1e6; // $20/month
        uint64 interval = 30 days;
        uint32 maxCycles = 12;

        // Step 1: Merchant creates plan
        vm.prank(merchant);
        hub.createPlan(PLAN_ID, cycleAmount, interval, maxCycles);

        PulsePayMerchantHub.SubscriptionPlan memory plan = hub.getPlan(PLAN_ID);
        assertEq(plan.merchant, merchant);
        assertEq(plan.amountPerCycle, cycleAmount);
        assertEq(plan.intervalSeconds, interval);
        assertEq(plan.maxCycles, maxCycles);
        assertTrue(plan.active);

        // Step 2: Customer subscribes (pays cycle 1 immediately)
        uint256 customerBalBefore = usdt.balanceOf(customer);

        vm.prank(customer);
        hub.createSubscription(SUB_ID, PLAN_ID);

        assertEq(usdt.balanceOf(customer), customerBalBefore - cycleAmount);

        PulsePayMerchantHub.Subscription memory sub = hub.getSubscription(SUB_ID);
        assertEq(sub.subscriber, customer);
        assertEq(sub.merchant, merchant);
        assertEq(sub.cyclesCharged, 1);
        assertEq(sub.nextChargeAt, block.timestamp + interval);
        assertTrue(sub.active);

        // Step 3: Premature renewal before interval fails
        bytes32 renewal2 = keccak256("renewal_cycle_2");
        vm.prank(keeper);
        vm.expectRevert(PulsePayMerchantHub.SubscriptionNotDue.selector);
        hub.chargeRenewal(SUB_ID, renewal2);

        // Step 4: Warp time to billing due date
        vm.warp(block.timestamp + 30 days);

        // Keeper charges renewal 2
        vm.prank(keeper);
        hub.chargeRenewal(SUB_ID, renewal2);

        PulsePayMerchantHub.Subscription memory sub2 = hub.getSubscription(SUB_ID);
        assertEq(sub2.cyclesCharged, 2);
        assertEq(sub2.nextChargeAt, block.timestamp + interval);

        // Duplicate renewal ID reverts
        vm.prank(keeper);
        vm.expectRevert(PulsePayMerchantHub.DuplicateRenewal.selector);
        hub.chargeRenewal(SUB_ID, renewal2);

        // Step 5: Customer cancels subscription
        vm.prank(customer);
        hub.cancelSubscription(SUB_ID);

        PulsePayMerchantHub.Subscription memory subCancelled = hub.getSubscription(SUB_ID);
        assertFalse(subCancelled.active);

        // Step 6: Renewal on cancelled subscription reverts
        vm.warp(block.timestamp + 30 days);
        bytes32 renewal3 = keccak256("renewal_cycle_3");

        vm.prank(keeper);
        vm.expectRevert(PulsePayMerchantHub.SubscriptionInactive.selector);
        hub.chargeRenewal(SUB_ID, renewal3);
    }
}

