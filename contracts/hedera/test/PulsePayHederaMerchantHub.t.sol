// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {PulsePayHederaMerchantHub} from "../src/PulsePayHederaMerchantHub.sol";
import {MockToken} from "./mocks/MockToken.sol";

contract TestableHederaHub is PulsePayHederaMerchantHub {
    bool public capacity = true;
    int64 public scheduleResponse = 22;
    int64 public deleteResponse = 22;
    uint256 public scheduleNonce;

    constructor(address token) PulsePayHederaMerchantHub(token, 2000, false) {}
    function setCapacity(bool value) external { capacity = value; }
    function setScheduleResponse(int64 value) external { scheduleResponse = value; }
    function setDeleteResponse(int64 value) external { deleteResponse = value; }
    function _hasScheduleCapacity(uint256, uint256) internal view override returns (bool) { return capacity; }
    function _scheduleCall(address, uint256, uint256, uint64, bytes memory) internal override returns (int64, address) {
        scheduleNonce++;
        return scheduleResponse == 22 ? (int64(22), address(uint160(10_000 + scheduleNonce))) : (scheduleResponse, address(0));
    }
    function _deleteSchedule(address) internal view override returns (int64) { return deleteResponse; }
}

contract PulsePayHederaMerchantHubTest is Test {
    MockToken internal token;
    TestableHederaHub internal hub;
    address internal merchant = makeAddr("merchant");
    address internal subscriber = makeAddr("subscriber");
    bytes32 internal constant PLAN = keccak256("plan");
    bytes32 internal constant SUBSCRIPTION = keccak256("subscription");

    function setUp() public {
        token = new MockToken();
        hub = new TestableHederaHub(address(token));
        token.mint(subscriber, 1_000e18);
        vm.prank(subscriber);
        token.approve(address(hub), type(uint256).max);
        vm.prank(merchant);
        hub.createPlan(PLAN, 10e18, 60, 3);
    }

    function _subscribe(uint256 maxSpend) internal {
        vm.prank(subscriber);
        hub.createSubscription(SUBSCRIPTION, PLAN, maxSpend, uint64(block.timestamp + 1 days));
    }

    function test_subscriptionSchedulesAndRenewsUntilConsentCap() public {
        _subscribe(30e18);
        PulsePayHederaMerchantHub.Subscription memory subscription = hub.getSubscription(SUBSCRIPTION);
        assertTrue(subscription.armed);
        assertEq(subscription.cyclesCharged, 1);
        vm.warp(subscription.nextChargeAt);
        hub.executeScheduledRenewal(SUBSCRIPTION, subscription.generation, 2);
        subscription = hub.getSubscription(SUBSCRIPTION);
        assertEq(subscription.cyclesCharged, 2);
        assertEq(subscription.totalCharged, 20e18);
        assertTrue(subscription.armed);
        vm.warp(subscription.nextChargeAt);
        hub.executeScheduledRenewal(SUBSCRIPTION, subscription.generation, 3);
        subscription = hub.getSubscription(SUBSCRIPTION);
        assertEq(subscription.cyclesCharged, 3);
        assertFalse(subscription.active);
        assertFalse(subscription.armed);
    }

    function test_cancelInvalidatesCallbackEvenWhenDeleteFails() public {
        _subscribe(30e18);
        PulsePayHederaMerchantHub.Subscription memory beforeCancel = hub.getSubscription(SUBSCRIPTION);
        hub.setDeleteResponse(1);
        vm.prank(subscriber);
        hub.cancelSubscription(SUBSCRIPTION);
        PulsePayHederaMerchantHub.Subscription memory afterCancel = hub.getSubscription(SUBSCRIPTION);
        assertFalse(afterCancel.active);
        assertGt(afterCancel.generation, beforeCancel.generation);
        vm.warp(beforeCancel.nextChargeAt);
        vm.expectRevert(PulsePayHederaMerchantHub.SubscriptionInactive.selector);
        hub.executeScheduledRenewal(SUBSCRIPTION, beforeCancel.generation, 2);
    }

    function test_failedTokenPullPausesWithoutLosingState() public {
        _subscribe(30e18);
        PulsePayHederaMerchantHub.Subscription memory subscription = hub.getSubscription(SUBSCRIPTION);
        vm.prank(subscriber);
        token.approve(address(hub), 0);
        vm.warp(subscription.nextChargeAt);
        hub.executeScheduledRenewal(SUBSCRIPTION, subscription.generation, 2);
        subscription = hub.getSubscription(SUBSCRIPTION);
        assertEq(subscription.cyclesCharged, 1);
        assertFalse(subscription.active);
        assertFalse(subscription.armed);
        vm.prank(subscriber);
        token.approve(address(hub), type(uint256).max);
        vm.prank(subscriber);
        hub.rearmSubscription(SUBSCRIPTION);
        assertTrue(hub.getSubscription(SUBSCRIPTION).armed);
    }

    function test_capacityFailureLeavesPaidSubscriptionRecoverable() public {
        hub.setCapacity(false);
        _subscribe(30e18);
        PulsePayHederaMerchantHub.Subscription memory subscription = hub.getSubscription(SUBSCRIPTION);
        assertTrue(subscription.active);
        assertFalse(subscription.armed);
        hub.setCapacity(true);
        vm.prank(subscriber);
        hub.rearmSubscription(SUBSCRIPTION);
        assertTrue(hub.getSubscription(SUBSCRIPTION).armed);
    }

    function test_invoiceSettlementAndRefundUseSameTokenAccounting() public {
        bytes32 invoiceId = keccak256("invoice");
        vm.prank(merchant);
        hub.createInvoice(invoiceId, subscriber, 100e18, uint64(block.timestamp + 1 days), keccak256("challenge"));
        vm.prank(subscriber);
        hub.payInvoice(invoiceId);
        (uint256 reserve, uint256 available) = hub.getMerchantBalances(merchant);
        assertEq(reserve, 20e18);
        assertEq(available, 80e18);
        vm.prank(merchant);
        hub.issueRefund(invoiceId, 25e18, keccak256("refund"));
        (reserve, available) = hub.getMerchantBalances(merchant);
        assertEq(reserve, 0);
        assertEq(available, 75e18);
    }
}
