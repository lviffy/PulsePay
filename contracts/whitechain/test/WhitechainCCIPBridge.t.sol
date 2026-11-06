// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {WhitechainBridgeMapper} from "../src/WhitechainBridgeMapper.sol";
import {WhitechainCCIPBridge} from "../src/WhitechainCCIPBridge.sol";
import {MockUSDT} from "./mocks/MockUSDT.sol";

contract WhitechainCCIPBridgeTest is Test {
    WhitechainBridgeMapper public mapper;
    WhitechainCCIPBridge public bridge;
    MockUSDT public usdt;

    address public owner = address(0xABCD);
    uint256 public signerPrivateKey = 0xA11CE;
    address public signer;
    address public user = address(0x1234);
    address public recipient = address(0x5678);
    uint64 public constant SEPOLIA_SELECTOR = 16015286601757825753;

    function setUp() public {
        signer = vm.addr(signerPrivateKey);

        vm.startPrank(owner);
        mapper = new WhitechainBridgeMapper();
        bridge = new WhitechainCCIPBridge(address(mapper), signer);
        mapper.setBridgeAuthorization(address(bridge), true);
        vm.stopPrank();

        usdt = new MockUSDT();
        usdt.mint(user, 100_000e6);

        vm.prank(owner);
        mapper.addToken(
            address(usdt),
            address(0x9999), // foreignToken on Sepolia
            SEPOLIA_SELECTOR,
            0, // LOCK_RELEASE
            10e6, // min 10 USDT
            5000e6, // max 5000 USDT
            20000e6 // daily 20000 USDT
        );

        vm.prank(user);
        usdt.approve(address(bridge), type(uint256).max);
    }

    function _signDeposit(
        address token,
        uint256 amount,
        uint64 destChainSelector,
        address rec,
        uint256 nonce,
        address sender
    ) internal view returns (bytes memory) {
        bytes32 depositHash = bridge.getDepositHash(
            token,
            amount,
            destChainSelector,
            rec,
            nonce,
            sender
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPrivateKey, depositHash);
        return abi.encodePacked(r, s, v);
    }

    function test_bridgeTokens_success_withSignature() public {
        uint256 amount = 100e6;
        uint256 nonce = 0;
        bytes memory signature = _signDeposit(
            address(usdt),
            amount,
            SEPOLIA_SELECTOR,
            recipient,
            nonce,
            user
        );

        vm.prank(user);
        bytes32 depositId = bridge.bridgeTokens(
            address(usdt),
            amount,
            SEPOLIA_SELECTOR,
            recipient,
            nonce,
            signature
        );

        assertTrue(bridge.isDepositUsed(depositId));
        assertEq(bridge.userNonces(user), 1);
        assertEq(usdt.balanceOf(address(bridge)), amount);
    }

    function test_bridgeTokens_success_direct() public {
        // Disable signature requirement for permissionless mode
        vm.prank(owner);
        bridge.setSignatureRequired(false);

        uint256 amount = 50e6;
        uint256 nonce = 0;

        vm.prank(user);
        bytes32 depositId = bridge.bridgeTokens(
            address(usdt),
            amount,
            SEPOLIA_SELECTOR,
            recipient,
            nonce,
            ""
        );

        assertTrue(bridge.isDepositUsed(depositId));
        assertEq(bridge.userNonces(user), 1);
        assertEq(usdt.balanceOf(address(bridge)), amount);
    }

    function test_bridgeTokens_revert_invalidNonce() public {
        uint256 amount = 100e6;
        uint256 wrongNonce = 5;
        bytes memory signature = _signDeposit(
            address(usdt),
            amount,
            SEPOLIA_SELECTOR,
            recipient,
            wrongNonce,
            user
        );

        vm.prank(user);
        vm.expectRevert(
            abi.encodeWithSelector(WhitechainCCIPBridge.InvalidNonce.selector, 0, wrongNonce)
        );
        bridge.bridgeTokens(
            address(usdt),
            amount,
            SEPOLIA_SELECTOR,
            recipient,
            wrongNonce,
            signature
        );
    }

    function test_bridgeTokens_revert_invalidSignature() public {
        uint256 amount = 100e6;
        uint256 nonce = 0;
        // Sign with a different key
        bytes32 depositHash = bridge.getDepositHash(
            address(usdt),
            amount,
            SEPOLIA_SELECTOR,
            recipient,
            nonce,
            user
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(0xB0B, depositHash);
        bytes memory badSignature = abi.encodePacked(r, s, v);

        vm.prank(user);
        vm.expectRevert(WhitechainCCIPBridge.InvalidSignature.selector);
        bridge.bridgeTokens(
            address(usdt),
            amount,
            SEPOLIA_SELECTOR,
            recipient,
            nonce,
            badSignature
        );
    }

    function test_bridgeTokens_revert_replay() public {
        uint256 amount = 100e6;
        uint256 nonce = 0;
        bytes memory signature = _signDeposit(
            address(usdt),
            amount,
            SEPOLIA_SELECTOR,
            recipient,
            nonce,
            user
        );

        vm.prank(user);
        bridge.bridgeTokens(
            address(usdt),
            amount,
            SEPOLIA_SELECTOR,
            recipient,
            nonce,
            signature
        );

        // Same call again reverts (nonce will fail first)
        vm.prank(user);
        vm.expectRevert(
            abi.encodeWithSelector(WhitechainCCIPBridge.InvalidNonce.selector, 1, 0)
        );
        bridge.bridgeTokens(
            address(usdt),
            amount,
            SEPOLIA_SELECTOR,
            recipient,
            nonce,
            signature
        );
    }

    function test_bridgeTokens_revert_whenPaused() public {
        vm.prank(owner);
        bridge.pause();

        uint256 amount = 100e6;
        uint256 nonce = 0;
        bytes memory signature = _signDeposit(
            address(usdt),
            amount,
            SEPOLIA_SELECTOR,
            recipient,
            nonce,
            user
        );

        vm.prank(user);
        vm.expectRevert();
        bridge.bridgeTokens(
            address(usdt),
            amount,
            SEPOLIA_SELECTOR,
            recipient,
            nonce,
            signature
        );
    }

    function test_withdrawTokenLiquidity() public {
        uint256 amount = 500e6;
        // User bridges 500 USDT
        bytes memory signature = _signDeposit(
            address(usdt),
            amount,
            SEPOLIA_SELECTOR,
            recipient,
            0,
            user
        );
        vm.prank(user);
        bridge.bridgeTokens(
            address(usdt),
            amount,
            SEPOLIA_SELECTOR,
            recipient,
            0,
            signature
        );

        assertEq(usdt.balanceOf(address(bridge)), amount);

        address treasury = address(0xCAFE);
        vm.prank(owner);
        bridge.withdrawTokenLiquidity(address(usdt), treasury, amount);

        assertEq(usdt.balanceOf(treasury), amount);
        assertEq(usdt.balanceOf(address(bridge)), 0);
    }
}

