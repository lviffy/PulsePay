// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script} from "forge-std/Script.sol";
import {PulsePayHederaMerchantHub} from "../src/PulsePayHederaMerchantHub.sol";

contract DeployMerchantHub is Script {
    function run() external returns (PulsePayHederaMerchantHub hub) {
        address token = vm.envAddress("HEDERA_EVM_SETTLEMENT_TOKEN_ADDRESS");
        uint256 reserveBps = vm.envOr("PULSEPAY_DEFAULT_RESERVE_BPS", uint256(2000));
        bool associateHtsToken = vm.envOr("HEDERA_EVM_ASSOCIATE_HTS", true);
        vm.startBroadcast();
        hub = new PulsePayHederaMerchantHub(token, reserveBps, associateHtsToken);
        vm.stopBroadcast();
    }
}

