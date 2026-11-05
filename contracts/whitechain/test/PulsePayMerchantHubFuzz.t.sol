// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {PulsePayMerchantHub} from "../src/PulsePayMerchantHub.sol";
import {MockUSDT} from "./mocks/MockUSDT.sol";

contract PulsePayMerchantHubFuzzTest is Test {
    PulsePayMerchantHub public hub;
    MockUSDT public usdt;

    address public merchant = makeAddr("merchant");
    address public customer = makeAddr("customer");

    function setUp() public {
        usdt = new MockUSDT();
        hub = new PulsePayMerchantHub(address(usdt), 2000); // 20% default

        usdt.mint(customer, 1_000_000_000 * 1e6);
        usdt.mint(merchant, 1_000_000_000 * 1e6);

        vm.prank(customer);
        usdt.approve(address(hub), type(uint256).max);

        vm.prank(merchant);
        usdt.approve(address(hub), type(uint256).max);
    }

    /// @dev Invariant: Cumulative refund can never exceed original amount paid
    function testFuzz_refund_bounds(uint256 amountPaid, uint256 refund1, uint256 refund2) public {
        amountPaid = bound(amountPaid, 1e6, 1_000_000 * 1e6);
        refund1 = bound(refund1, 0, amountPaid);
        refund2 = bound(refund2, 0, amountPaid);

        bytes32 invId = keccak256(abi.encodePacked("fuzz_inv", amountPaid));

        vm.prank(merchant);
        hub.createInvoice(invId, customer, amountPaid, uint64(block.timestamp + 1 days), bytes32(0));

        vm.prank(customer);
        hub.payInvoice(invId);

        if (refund1 > 0) {
            vm.prank(merchant);
            hub.issueRefund(invId, refund1, bytes32(0));
        }

        uint256 remainingRefundable = amountPaid - refund1;

        if (refund2 > remainingRefundable) {
            vm.prank(merchant);
            vm.expectRevert(PulsePayMerchantHub.RefundExceedsPaidAmount.selector);
            hub.issueRefund(invId, refund2, bytes32(0));
        } else if (refund2 > 0) {
            vm.prank(merchant);
            hub.issueRefund(invId, refund2, bytes32(0));
            PulsePayMerchantHub.Payment memory p = hub.getPayment(invId);
            assertEq(p.amountRefunded, refund1 + refund2);
            assertTrue(p.amountRefunded <= amountPaid);
        }
    }

    /// @dev Invariant: Accounting balance conservation:
    /// Contract USDT balance == sum of (refundReserve + merchantAvailable)
    function testFuzz_accounting_conservation(uint256 amount, uint256 reserveBps) public {
        amount = bound(amount, 1e6, 100_000 * 1e6);
        reserveBps = bound(reserveBps, 0, 10000);

        bytes32 invId = keccak256(abi.encodePacked("fuzz_cons", amount, reserveBps));

        vm.prank(merchant);
        hub.setMerchantReserveBps(reserveBps);

        vm.prank(merchant);
        hub.createInvoice(invId, customer, amount, uint64(block.timestamp + 1 days), bytes32(0));

        vm.prank(customer);
        hub.payInvoice(invId);

        (uint256 reserve, uint256 available) = hub.getMerchantBalances(merchant);
        assertEq(reserve + available, amount);
        assertEq(usdt.balanceOf(address(hub)), amount);
    }
}

