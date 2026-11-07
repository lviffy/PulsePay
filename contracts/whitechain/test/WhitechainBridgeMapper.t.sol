// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {WhitechainBridgeMapper} from "../src/WhitechainBridgeMapper.sol";

contract WhitechainBridgeMapperTest is Test {
    WhitechainBridgeMapper public mapper;

    address public owner = address(0xABCD);
    address public bridge = address(0xBEEF);
    address public localToken = address(0x1111);
    address public foreignToken = address(0x2222);
    uint64 public constant SEPOLIA_SELECTOR = 16015286601757825753;

    function setUp() public {
        vm.prank(owner);
        mapper = new WhitechainBridgeMapper();

        vm.prank(owner);
        mapper.setBridgeAuthorization(bridge, true);
    }

    function test_addToken_revert_invalidAddress() public {
        vm.startPrank(owner);
        vm.expectRevert(WhitechainBridgeMapper.InvalidAddress.selector);
        mapper.addToken(address(0), foreignToken, SEPOLIA_SELECTOR, 0, 10e6, 1000e6, 5000e6);

        vm.expectRevert(WhitechainBridgeMapper.InvalidAddress.selector);
        mapper.addToken(localToken, address(0), SEPOLIA_SELECTOR, 0, 10e6, 1000e6, 5000e6);
        vm.stopPrank();
    }

    function test_addToken_revert_invalidBounds() public {
        vm.startPrank(owner);
        // minAmount == 0
        vm.expectRevert(WhitechainBridgeMapper.InvalidAmountBounds.selector);
        mapper.addToken(localToken, foreignToken, SEPOLIA_SELECTOR, 0, 0, 1000e6, 5000e6);

        // minAmount > maxAmount
        vm.expectRevert(WhitechainBridgeMapper.InvalidAmountBounds.selector);
        mapper.addToken(localToken, foreignToken, SEPOLIA_SELECTOR, 0, 2000e6, 1000e6, 5000e6);

        // dailyLimit < maxAmount
        vm.expectRevert(WhitechainBridgeMapper.InvalidAmountBounds.selector);
        mapper.addToken(localToken, foreignToken, SEPOLIA_SELECTOR, 0, 10e6, 1000e6, 500e6);
        vm.stopPrank();
    }

    function test_addToken_success() public {
        vm.prank(owner);
        mapper.addToken(localToken, foreignToken, SEPOLIA_SELECTOR, 0, 10e6, 1000e6, 5000e6);

        assertTrue(mapper.isTokenSupported(localToken, SEPOLIA_SELECTOR));
        WhitechainBridgeMapper.TokenConfig memory config = mapper.getTokenConfig(localToken, SEPOLIA_SELECTOR);
        assertEq(config.localToken, localToken);
        assertEq(config.foreignToken, foreignToken);
        assertEq(config.destChainSelector, SEPOLIA_SELECTOR);
        assertEq(uint8(config.transferType), 0);
        assertEq(config.minAmount, 10e6);
        assertEq(config.maxAmount, 1000e6);
        assertEq(config.dailyLimit, 5000e6);
        assertEq(config.currentDailyVolume, 0);
        assertTrue(config.isActive);
    }

    function test_updateToken_success() public {
        vm.startPrank(owner);
        mapper.addToken(localToken, foreignToken, SEPOLIA_SELECTOR, 0, 10e6, 1000e6, 5000e6);

        address newForeign = address(0x3333);
        mapper.updateToken(localToken, SEPOLIA_SELECTOR, newForeign, 1, 20e6, 2000e6, 10000e6, true);
        vm.stopPrank();

        WhitechainBridgeMapper.TokenConfig memory config = mapper.getTokenConfig(localToken, SEPOLIA_SELECTOR);
        assertEq(config.foreignToken, newForeign);
        assertEq(uint8(config.transferType), 1);
        assertEq(config.minAmount, 20e6);
        assertEq(config.maxAmount, 2000e6);
        assertEq(config.dailyLimit, 10000e6);
    }

    function test_setTokenActive() public {
        vm.startPrank(owner);
        mapper.addToken(localToken, foreignToken, SEPOLIA_SELECTOR, 0, 10e6, 1000e6, 5000e6);
        mapper.setTokenActive(localToken, SEPOLIA_SELECTOR, false);
        vm.stopPrank();

        assertFalse(mapper.isTokenSupported(localToken, SEPOLIA_SELECTOR));

        // Reverts when recording transfer for inactive token
        vm.prank(bridge);
        vm.expectRevert(WhitechainBridgeMapper.TokenInactive.selector);
        mapper.recordTransfer(localToken, SEPOLIA_SELECTOR, 100e6);
    }

    function test_recordTransfer_revert_unauthorizedCaller() public {
        vm.prank(owner);
        mapper.addToken(localToken, foreignToken, SEPOLIA_SELECTOR, 0, 10e6, 1000e6, 5000e6);

        address stranger = address(0x9999);
        vm.prank(stranger);
        vm.expectRevert(WhitechainBridgeMapper.UnauthorizedCaller.selector);
        mapper.recordTransfer(localToken, SEPOLIA_SELECTOR, 100e6);
    }

    function test_recordTransfer_revert_bounds() public {
        vm.prank(owner);
        mapper.addToken(localToken, foreignToken, SEPOLIA_SELECTOR, 0, 10e6, 1000e6, 5000e6);

        vm.startPrank(bridge);
        // below min
        vm.expectRevert(
            abi.encodeWithSelector(WhitechainBridgeMapper.AmountBelowMinimum.selector, 5e6, 10e6)
        );
        mapper.recordTransfer(localToken, SEPOLIA_SELECTOR, 5e6);

        // above max
        vm.expectRevert(
            abi.encodeWithSelector(WhitechainBridgeMapper.AmountExceedsMaximum.selector, 1500e6, 1000e6)
        );
        mapper.recordTransfer(localToken, SEPOLIA_SELECTOR, 1500e6);
        vm.stopPrank();
    }

    function test_recordTransfer_enforcesDailyLimitAndReset() public {
        vm.prank(owner);
        mapper.addToken(localToken, foreignToken, SEPOLIA_SELECTOR, 0, 10e6, 1000e6, 1500e6);

        assertEq(mapper.getRemainingDailyLimit(localToken, SEPOLIA_SELECTOR), 1500e6);

        vm.startPrank(bridge);
        mapper.recordTransfer(localToken, SEPOLIA_SELECTOR, 1000e6);
        assertEq(mapper.getRemainingDailyLimit(localToken, SEPOLIA_SELECTOR), 500e6);

        // Try transfer exceeding remaining limit (600 > 500)
        vm.expectRevert(
            abi.encodeWithSelector(WhitechainBridgeMapper.DailyLimitExceeded.selector, 600e6, 500e6)
        );
        mapper.recordTransfer(localToken, SEPOLIA_SELECTOR, 600e6);

        // Exact remaining transfer succeeds
        mapper.recordTransfer(localToken, SEPOLIA_SELECTOR, 500e6);
        assertEq(mapper.getRemainingDailyLimit(localToken, SEPOLIA_SELECTOR), 0);
        vm.stopPrank();

        // Warp time by 1 day + 1 second
        vm.warp(block.timestamp + 1 days + 1);
        assertEq(mapper.getRemainingDailyLimit(localToken, SEPOLIA_SELECTOR), 1500e6);

        vm.prank(bridge);
        mapper.recordTransfer(localToken, SEPOLIA_SELECTOR, 800e6);
        assertEq(mapper.getRemainingDailyLimit(localToken, SEPOLIA_SELECTOR), 700e6);
    }
}

