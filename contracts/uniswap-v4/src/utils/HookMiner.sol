// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Hooks} from "v4-core/src/libraries/Hooks.sol";

/**
 * @title HookMiner
 * @notice Helper library to find a CREATE2 salt that deploys a hook with specific permission bits.
 */
library HookMiner {
    // Flag mask for all 14 hook permissions in Uniswap v4
    uint160 internal constant ALL_HOOK_MASK = uint160((1 << 14) - 1);

    /**
     * @notice Find a salt that produces a hook address matching the required flags.
     * @param deployer Address of the deployer contract or factory
     * @param flags The required hook permission bitmask (e.g. 0x00C0 for beforeSwap + afterSwap)
     * @param creationCode The creation bytecode of the hook contract (bytecode + encoded constructor args)
     * @return hookAddress The computed address of the hook
     * @return salt The mined salt
     */
    function find(
        address deployer,
        uint160 flags,
        bytes memory creationCode
    ) internal pure returns (address hookAddress, bytes32 salt) {
        bytes32 initCodeHash = keccak256(creationCode);

        for (uint256 i = 0; i < 100_000; i++) {
            salt = bytes32(i);
            hookAddress = computeAddress(deployer, salt, initCodeHash);
            if (uint160(hookAddress) & ALL_HOOK_MASK == flags) {
                return (hookAddress, salt);
            }
        }
        revert("HookMiner: could not find salt within iteration limit");
    }

    /**
     * @notice Compute CREATE2 address from deployer, salt, and initCodeHash.
     */
    function computeAddress(
        address deployer,
        bytes32 salt,
        bytes32 initCodeHash
    ) internal pure returns (address) {
        return address(
            uint160(
                uint256(
                    keccak256(
                        abi.encodePacked(
                            bytes1(0xff),
                            deployer,
                            salt,
                            initCodeHash
                        )
                    )
                )
            )
        );
    }
}

