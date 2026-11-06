// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {TreasuryGuardHook} from "../src/TreasuryGuardHook.sol";
import {HookMiner} from "../src/utils/HookMiner.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";

contract DeployHook is Script {
    // Official Uniswap v4 PoolManager on Unichain Sepolia (Chain ID 1301)
    address public constant UNICHAIN_POOL_MANAGER = 0x00B036bf97F650eEa2f656606A6C4F07449c25f5;


    // Standard deterministic CREATE2 deployer used on Unichain & Ethereum
    address public constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

    function run() external returns (TreasuryGuardHook hook) {
        require(block.chainid == 1301, "Use Unichain Sepolia");
        address deployer = vm.envAddress("DEPLOYER_ADDRESS");
        address inputToken = vm.envAddress("TREASURY_INPUT_TOKEN");
        uint256 initialMaxSwap = vm.envUint("TREASURY_MAX_INPUT_UNITS");
        require(inputToken.code.length > 0 && initialMaxSwap > 0, "Configure input token and raw-unit limit");
        console.log("Mining hook address with beforeSwap + afterSwap permission flags (0x00C0)...");
        console.log("Deployer:", deployer);

        uint160 flags = uint160((1 << 7) | (1 << 6)); // 0x00C0

        bytes memory creationCode = abi.encodePacked(
            type(TreasuryGuardHook).creationCode,
            abi.encode(IPoolManager(UNICHAIN_POOL_MANAGER), initialMaxSwap, deployer, inputToken)
        );

        (address hookAddress, bytes32 salt) = HookMiner.find(CREATE2_DEPLOYER, flags, creationCode);
        console.log("Mined Salt:", vm.toString(salt));
        console.log("Target Hook Address:", hookAddress);

        bytes memory payload = abi.encodePacked(salt, creationCode);

        vm.startBroadcast();
        (bool success, bytes memory returnData) = CREATE2_DEPLOYER.call(payload);
        vm.stopBroadcast();

        require(success && returnData.length == 20, "CREATE2 deployment failed");
        address deployedAddress;
        assembly {
            deployedAddress := shr(96, mload(add(returnData, 0x20)))
        }

        require(deployedAddress == hookAddress && deployedAddress.code.length > 0, "Hook address mismatch on broadcast");
        hook = TreasuryGuardHook(deployedAddress);
        console.log("TreasuryGuardHook successfully deployed at:", address(hook));
    }
}
