// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {BaseHook} from "./base/BaseHook.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {PoolId, PoolIdLibrary} from "v4-core/src/types/PoolId.sol";
import {BalanceDelta} from "v4-core/src/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "v4-core/src/types/BeforeSwapDelta.sol";
import {SwapParams} from "v4-core/src/types/PoolOperation.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TreasuryGuardHook
 * @notice Uniswap v4 custom hook for enterprise treasury risk management.
 * Enforces merchant-configured maximum swap limits and emergency circuit-breaker pause
 * via beforeSwap, and emits normalized treasury audit events via afterSwap.
 */
contract TreasuryGuardHook is BaseHook, Ownable {
    using PoolIdLibrary for PoolKey;

    // --- Custom Errors ---
    error TreasurySwapsPaused();
    error SwapAmountExceedsPolicyLimit(uint256 amount, uint256 limit);
    error InvalidLimit();
    error UnsupportedSwapMode();
    error UnsupportedInputCurrency();

    // --- State Variables ---
    /// @notice Maximum allowed input token amount per swap
    uint256 public maxSwapAmount;
    /// @notice The sole input currency this deployment guards; limits use its native base units.
    address public immutable limitCurrency;

    /// @notice Emergency circuit-breaker pause switch
    bool public paused;

    // --- Events ---
    event TreasurySwapsPausedUpdated(bool isPaused);
    event MaxSwapAmountUpdated(uint256 oldLimit, uint256 newLimit);
    event TreasurySwapExecuted(
        PoolId indexed poolId,
        address indexed sender,
        bool zeroForOne,
        int128 amount0,
        int128 amount1,
        uint256 timestamp
    );

    constructor(
        IPoolManager _poolManager,
        uint256 _initialMaxSwapAmount,
        address _treasuryOwner,
        address _limitCurrency
    ) BaseHook(_poolManager) Ownable(_treasuryOwner) {
        if (_initialMaxSwapAmount == 0 || _limitCurrency == address(0)) revert InvalidLimit();
        limitCurrency = _limitCurrency;
        maxSwapAmount = _initialMaxSwapAmount;
        paused = false;
    }

    // --- Hook Permissions ---

    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: false,
            afterInitialize: false,
            beforeAddLiquidity: false,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: false,
            beforeSwap: true,
            afterSwap: true,
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    // --- Treasury Admin Controls ---

    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit TreasurySwapsPausedUpdated(_paused);
    }

    function setMaxSwapAmount(uint256 _newLimit) external onlyOwner {
        if (_newLimit == 0) revert InvalidLimit();
        uint256 oldLimit = maxSwapAmount;
        maxSwapAmount = _newLimit;
        emit MaxSwapAmountUpdated(oldLimit, _newLimit);
    }

    // --- Hook Callbacks ---

    function beforeSwap(
        address,
        PoolKey calldata key,
        SwapParams calldata params,
        bytes calldata
    ) external view override onlyPoolManager returns (bytes4, BeforeSwapDelta, uint24) {
        if (paused) revert TreasurySwapsPaused();
        // Positive amountSpecified is output, so it cannot enforce an input spending cap.
        if (params.amountSpecified >= 0) revert UnsupportedSwapMode();
        if (Currency.unwrap(params.zeroForOne ? key.currency0 : key.currency1) != limitCurrency) {
            revert UnsupportedInputCurrency();
        }
        uint256 swapAmount = uint256(-(params.amountSpecified + 1)) + 1;

        if (maxSwapAmount > 0 && swapAmount > maxSwapAmount) {
            revert SwapAmountExceedsPolicyLimit(swapAmount, maxSwapAmount);
        }

        return (BaseHook.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);
    }

    function afterSwap(
        address sender,
        PoolKey calldata key,
        SwapParams calldata params,
        BalanceDelta delta,
        bytes calldata
    ) external override onlyPoolManager returns (bytes4, int128) {
        emit TreasurySwapExecuted(
            key.toId(),
            sender,
            params.zeroForOne,
            delta.amount0(),
            delta.amount1(),
            block.timestamp
        );

        return (BaseHook.afterSwap.selector, 0);
    }
}

