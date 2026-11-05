// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {PulsePayMerchantHub} from "../src/PulsePayMerchantHub.sol";

contract DeployMerchantHub is Script {
    // Official Whitechain Sepolia USDT token address
    address public constant OFFICIAL_USDT = 0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7;
    // 20% default refund reserve
    uint256 public constant DEFAULT_RESERVE_BPS = 2000;

    function run() external returns (PulsePayMerchantHub hub) {
        console.log("Deploying PulsePayMerchantHub to Whitechain Sepolia (Chain ID 1874)...");
        console.log("Official USDT:", OFFICIAL_USDT);
        console.log("Default Reserve BPS:", DEFAULT_RESERVE_BPS);

        vm.startBroadcast();
        hub = new PulsePayMerchantHub(OFFICIAL_USDT, DEFAULT_RESERVE_BPS);
        vm.stopBroadcast();

        console.log("PulsePayMerchantHub successfully deployed at:", address(hub));
    }
}

