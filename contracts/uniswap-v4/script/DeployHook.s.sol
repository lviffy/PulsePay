// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {TreasuryGuardHook} from "../src/TreasuryGuardHook.sol";
import {HookMiner} from "../src/utils/HookMiner.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";

contract DeployHook is Script {
    // Official Uniswap v4 PoolManager on Unichain Sepolia (Chain ID 1301)
    address public constant UNICHAIN_POOL_MANAGER = 0x00B036bf97F650eEa2f656606A6C4F07449c25f5;

    // Default max single swap limit for treasury protection: 50,000 units (18 decimals)
    uint256 public constant INITIAL_MAX_SWAP = 50_000 * 1e18;

    function run() external returns (TreasuryGuardHook hook) {
        address deployer = msg.sender;
        console.log("Mining hook address with beforeSwap + afterSwap permission flags (0x00C0)...");
        console.log("Deployer:", deployer);

        uint160 flags = uint160((1 << 7) | (1 << 6)); // 0x00C0

        bytes memory creationCode = abi.encodePacked(
            type(TreasuryGuardHook).creationCode,
            abi.encode(IPoolManager(UNICHAIN_POOL_MANAGER), INITIAL_MAX_SWAP, deployer)
        );

        (address hookAddress, bytes32 salt) = HookMiner.find(deployer, flags, creationCode);
        console.log("Mined Salt:", vm.toString(salt));
        console.log("Target Hook Address:", hookAddress);

        vm.startBroadcast();
        hook = new TreasuryGuardHook{salt: salt}(
            IPoolManager(UNICHAIN_POOL_MANAGER),
            INITIAL_MAX_SWAP,
            deployer
        );
        vm.stopBroadcast();

        require(address(hook) == hookAddress, "Hook address mismatch on broadcast");
        console.log("TreasuryGuardHook successfully deployed at:", address(hook));
    }
}
