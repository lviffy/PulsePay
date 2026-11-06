// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {BaseHook} from "../src/base/BaseHook.sol";
import {TreasuryGuardHook} from "../src/TreasuryGuardHook.sol";
import {HookMiner} from "../src/utils/HookMiner.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {BalanceDelta, toBalanceDelta} from "v4-core/src/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "v4-core/src/types/BeforeSwapDelta.sol";
import {SwapParams} from "v4-core/src/types/PoolOperation.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";

contract TreasuryGuardHookTest is Test {
    TreasuryGuardHook public hook;
    IPoolManager public poolManager = IPoolManager(makeAddr("poolManager"));
    address public treasuryOwner = makeAddr("treasuryOwner");
    address public swapper = makeAddr("swapper");

    uint256 public constant INITIAL_MAX_SWAP = 10_000 * 1e18; // 10,000 tokens

    PoolKey public key;

    function setUp() public {
        // Required flags for TreasuryGuardHook: beforeSwap (bit 7) and afterSwap (bit 6)
        uint160 flags = uint160((1 << 7) | (1 << 6));

        bytes memory creationCode = abi.encodePacked(
            type(TreasuryGuardHook).creationCode,
            abi.encode(poolManager, INITIAL_MAX_SWAP, treasuryOwner, makeAddr("token0"))
        );

        (address hookAddress, bytes32 salt) = HookMiner.find(address(this), flags, creationCode);

        hook = new TreasuryGuardHook{salt: salt}(
            poolManager,
            INITIAL_MAX_SWAP,
            treasuryOwner,
            makeAddr("token0")
        );

        require(address(hook) == hookAddress, "Hook address mismatch");

        // Dummy PoolKey
        key = PoolKey({
            currency0: Currency.wrap(makeAddr("token0")),
            currency1: Currency.wrap(makeAddr("token1")),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(hook))
        });
    }

    // --- Permissions & Initialization ---

    function test_hookPermissions() public view {
        Hooks.Permissions memory permissions = hook.getHookPermissions();
        assertTrue(permissions.beforeSwap);
        assertTrue(permissions.afterSwap);
        assertFalse(permissions.beforeInitialize);
        assertFalse(permissions.afterInitialize);
        assertFalse(permissions.beforeAddLiquidity);
        assertFalse(permissions.afterAddLiquidity);
        assertFalse(permissions.beforeRemoveLiquidity);
        assertFalse(permissions.afterRemoveLiquidity);
        assertFalse(permissions.beforeDonate);
        assertFalse(permissions.afterDonate);
    }

    function test_initialConfiguration() public view {
        assertEq(address(hook.poolManager()), address(poolManager));
        assertEq(hook.owner(), treasuryOwner);
        assertEq(hook.maxSwapAmount(), INITIAL_MAX_SWAP);
        assertFalse(hook.paused());
    }

    // --- Admin Policy Controls ---

    function test_admin_setMaxSwapAmount() public {
        vm.prank(treasuryOwner);
        hook.setMaxSwapAmount(25_000 * 1e18);
        assertEq(hook.maxSwapAmount(), 25_000 * 1e18);

        vm.prank(swapper);
        vm.expectRevert();
        hook.setMaxSwapAmount(50_000 * 1e18);
    }

    function test_admin_setPaused() public {
        vm.prank(treasuryOwner);
        hook.setPaused(true);
        assertTrue(hook.paused());

        vm.prank(treasuryOwner);
        hook.setPaused(false);
        assertFalse(hook.paused());

        vm.prank(swapper);
        vm.expectRevert();
        hook.setPaused(true);
    }

    // --- beforeSwap Callback Tests ---

    function test_beforeSwap_allowedSwap() public {
        SwapParams memory params = SwapParams({
            zeroForOne: true,
            amountSpecified: -5_000 * 1e18, // 5,000 tokens (within 10,000 limit)
            sqrtPriceLimitX96: 0
        });

        vm.prank(address(poolManager));
        (bytes4 selector, BeforeSwapDelta delta, uint24 fee) = hook.beforeSwap(
            swapper,
            key,
            params,
            ""
        );

        assertEq(selector, IHooks.beforeSwap.selector);
        assertEq(BeforeSwapDelta.unwrap(delta), BeforeSwapDelta.unwrap(BeforeSwapDeltaLibrary.ZERO_DELTA));
        assertEq(fee, 0);
    }

    function test_beforeSwap_revert_exceedsMaxSwap() public {
        SwapParams memory params = SwapParams({
            zeroForOne: true,
            amountSpecified: -15_000 * 1e18, // 15,000 tokens (exceeds 10,000 limit)
            sqrtPriceLimitX96: 0
        });

        vm.prank(address(poolManager));
        vm.expectRevert(
            abi.encodeWithSelector(
                TreasuryGuardHook.SwapAmountExceedsPolicyLimit.selector,
                15_000 * 1e18,
                INITIAL_MAX_SWAP
            )
        );
        hook.beforeSwap(swapper, key, params, "");
    }

    function test_beforeSwap_revert_paused() public {
        vm.prank(treasuryOwner);
        hook.setPaused(true);

        SwapParams memory params = SwapParams({
            zeroForOne: true,
            amountSpecified: -1_000 * 1e18,
            sqrtPriceLimitX96: 0
        });

        vm.prank(address(poolManager));
        vm.expectRevert(TreasuryGuardHook.TreasurySwapsPaused.selector);
        hook.beforeSwap(swapper, key, params, "");
    }

    function test_beforeSwap_revert_unauthorizedCaller() public {
        SwapParams memory params = SwapParams({
            zeroForOne: true,
            amountSpecified: -1_000 * 1e18,
            sqrtPriceLimitX96: 0
        });

        vm.prank(swapper);
        vm.expectRevert(BaseHook.NotPoolManager.selector);
        hook.beforeSwap(swapper, key, params, "");
    }

    // --- afterSwap Callback Tests ---

    function test_afterSwap_success() public {
        SwapParams memory params = SwapParams({
            zeroForOne: true,
            amountSpecified: -5_000 * 1e18,
            sqrtPriceLimitX96: 0
        });

        BalanceDelta delta = toBalanceDelta(-5_000 * 1e18, 4_990 * 1e18);

        vm.prank(address(poolManager));
        (bytes4 selector, int128 hookDelta) = hook.afterSwap(
            swapper,
            key,
            params,
            delta,
            ""
        );

        assertEq(selector, IHooks.afterSwap.selector);
        assertEq(hookDelta, 0);
    }
    function test_exactOutputRejected() public {
        vm.prank(address(poolManager));
        vm.expectRevert(TreasuryGuardHook.UnsupportedSwapMode.selector);
        hook.beforeSwap(swapper, key, SwapParams(true, 1, 0), "");
    }

    function test_otherInputCurrencyRejected() public {
        vm.prank(address(poolManager));
        vm.expectRevert(TreasuryGuardHook.UnsupportedInputCurrency.selector);
        hook.beforeSwap(swapper, key, SwapParams(false, -1, 0), "");
    }

}
