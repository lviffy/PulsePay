// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {PoolManager} from "v4-core/src/PoolManager.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {SwapParams, ModifyLiquidityParams} from "v4-core/src/types/PoolOperation.sol";
import {PoolSwapTest} from "v4-core/src/test/PoolSwapTest.sol";
import {PoolModifyLiquidityTest} from "v4-core/src/test/PoolModifyLiquidityTest.sol";
import {TreasuryGuardHook} from "../src/TreasuryGuardHook.sol";
import {HookMiner} from "../src/utils/HookMiner.sol";

contract GuardTestToken is ERC20 {
    uint8 private immutable precision;
    constructor(uint8 digits) ERC20("Test", "TST") { precision = digits; _mint(msg.sender, 1e30); }
    function decimals() public view override returns (uint8) { return precision; }
}

contract TreasuryGuardIntegrationTest is Test {
    PoolManager manager;
    PoolSwapTest swapper;
    PoolKey key;
    GuardTestToken input;
    uint256 constant LIMIT = 1000 * 1e6;

    function setUp() public {
        manager = new PoolManager(address(this));
        swapper = new PoolSwapTest(manager);
        PoolModifyLiquidityTest liquidity = new PoolModifyLiquidityTest(manager);
        GuardTestToken a = new GuardTestToken(6);
        GuardTestToken b = new GuardTestToken(18);
        input = a;
        bytes memory args = abi.encode(IPoolManager(address(manager)), LIMIT, address(this), address(a));
        (address target, bytes32 salt) = HookMiner.find(address(this), 0xC0, abi.encodePacked(type(TreasuryGuardHook).creationCode, args));
        TreasuryGuardHook hook = new TreasuryGuardHook{salt: salt}(manager, LIMIT, address(this), address(a));
        assertEq(address(hook), target);
        key = PoolKey({currency0: Currency.wrap(address(a) < address(b) ? address(a) : address(b)), currency1: Currency.wrap(address(a) < address(b) ? address(b) : address(a)), fee: 3000, tickSpacing: 60, hooks: IHooks(address(hook))});
        manager.initialize(key, uint160(1 << 96));
        a.approve(address(liquidity), type(uint256).max); b.approve(address(liquidity), type(uint256).max);
        a.approve(address(swapper), type(uint256).max); b.approve(address(swapper), type(uint256).max);
        liquidity.modifyLiquidity(key, ModifyLiquidityParams(-120, 120, 1e20, bytes32(0)), "");
    }
    function swap(int256 amount, bool forward) internal {
        bool zeroForOne = Currency.unwrap(key.currency0) == address(input);
        if (!forward) zeroForOne = !zeroForOne;
        swapper.swap(key, SwapParams(zeroForOne, amount, zeroForOne ? uint160(4295128740) : uint160(1461446703485210103287273052203988822378723970341)), PoolSwapTest.TestSettings(false, false), "");
    }
    function test_realPoolAcceptsSixDecimalInputWithinLimit() public {
        uint256 beforeBalance = input.balanceOf(address(this));
        swap(-int256(100 * 1e6), true);
        assertEq(beforeBalance - input.balanceOf(address(this)), 100 * 1e6);
    }
    function test_realPoolRejectsOversizedInput() public {
        vm.expectRevert(); swap(-int256(LIMIT + 1), true);
    }
    function test_realPoolRejectsExactOutput() public {
        vm.expectRevert(); swap(1, true);
    }
    function test_realPoolRejectsOtherDecimalInputCurrency() public {
        vm.expectRevert(); swap(-1e18, false);
    }
}
