// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {WhitechainBridgeMapper} from "./WhitechainBridgeMapper.sol";

/**
 * @title WhitechainCCIPBridge
 * @notice Origin bridge contract deployed on Whitechain for locking/escrowing USDT
 *         and emitting canonical cross-chain deposit proofs dispatched to Ethereum Sepolia.
 *         Adapted from whitechain-labs/bridge-contracts architecture.
 */
contract WhitechainCCIPBridge is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Whitechain bridge token mapper
    WhitechainBridgeMapper public immutable mapper;

    /// @notice Address authorized to sign cross-chain bridge vouchers
    address public authorizedSigner;

    /// @notice Whether backend signature verification is strictly enforced
    bool public signatureRequired;

    /// @notice Tracks processed deposit hashes to prevent replay attacks
    mapping(bytes32 => bool) public usedHashes;

    /// @notice Tracks nonces per user
    mapping(address => uint256) public userNonces;

    event Deposit(
        bytes32 indexed depositId,
        address indexed token,
        address indexed sender,
        address recipient,
        uint256 amount,
        uint64 destChainSelector,
        uint256 nonce,
        uint256 timestamp
    );

    event AuthorizedSignerUpdated(
        address indexed previousSigner,
        address indexed newSigner
    );

    event SignatureRequirementUpdated(bool required);

    event LiquidityWithdrawn(
        address indexed token,
        address indexed to,
        uint256 amount
    );

    error InvalidAddress();
    error InvalidAmount();
    error InvalidNonce(uint256 expected, uint256 provided);
    error DepositAlreadyProcessed(bytes32 depositId);
    error SignerNotConfigured();
    error InvalidSignature();

    constructor(
        address mapperAddress,
        address signerAddress
    ) Ownable(msg.sender) {
        if (mapperAddress == address(0)) {
            revert InvalidAddress();
        }
        mapper = WhitechainBridgeMapper(mapperAddress);
        authorizedSigner = signerAddress;
        signatureRequired = signerAddress != address(0);
    }

    /**
     * @notice Computes unique deposit hash for replay protection and signing.
     */
    function getDepositHash(
        address token,
        uint256 amount,
        uint64 destChainSelector,
        address recipient,
        uint256 nonce,
        address sender
    ) public view returns (bytes32) {
        bytes32 rawHash = keccak256(
            abi.encode(
                token,
                amount,
                destChainSelector,
                recipient,
                nonce,
                sender,
                block.chainid,
                address(this)
            )
        );
        return MessageHashUtils.toEthSignedMessageHash(rawHash);
    }

    /**
     * @notice Checks if a deposit hash has already been processed.
     */
    function isDepositUsed(bytes32 depositId) external view returns (bool) {
        return usedHashes[depositId];
    }

    /**
     * @notice Updates the authorized backend signer.
     */
    function setAuthorizedSigner(address newSigner) external onlyOwner {
        address prev = authorizedSigner;
        authorizedSigner = newSigner;
        emit AuthorizedSignerUpdated(prev, newSigner);
    }

    /**
     * @notice Toggles strict signature requirement.
     */
    function setSignatureRequired(bool required) external onlyOwner {
        signatureRequired = required;
        emit SignatureRequirementUpdated(required);
    }

    /**
     * @notice Pauses contract deposits in an emergency.
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Resumes contract deposits.
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Emergency liquidity withdrawal (from whitechain-labs/bridge-contracts).
     */
    function withdrawTokenLiquidity(
        address token,
        address to,
        uint256 amount
    ) external onlyOwner nonReentrant {
        if (token == address(0) || to == address(0)) {
            revert InvalidAddress();
        }
        if (amount == 0) {
            revert InvalidAmount();
        }

        IERC20(token).safeTransfer(to, amount);
        emit LiquidityWithdrawn(token, to, amount);
    }

    /**
     * @notice Bridges tokens from Whitechain to the destination chain.
     */
    function bridgeTokens(
        address token,
        uint256 amount,
        uint64 destChainSelector,
        address recipient,
        uint256 nonce,
        bytes calldata signature
    ) external nonReentrant whenNotPaused returns (bytes32 depositId) {
        if (token == address(0) || recipient == address(0)) {
            revert InvalidAddress();
        }
        if (amount == 0) {
            revert InvalidAmount();
        }

        uint256 currentNonce = userNonces[msg.sender];
        if (nonce != currentNonce) {
            revert InvalidNonce(currentNonce, nonce);
        }

        depositId = getDepositHash(
            token,
            amount,
            destChainSelector,
            recipient,
            nonce,
            msg.sender
        );

        if (usedHashes[depositId]) {
            revert DepositAlreadyProcessed(depositId);
        }

        if (signatureRequired) {
            if (authorizedSigner == address(0)) {
                revert SignerNotConfigured();
            }
            address recovered = ECDSA.recover(depositId, signature);
            if (recovered != authorizedSigner) {
                revert InvalidSignature();
            }
        }

        usedHashes[depositId] = true;
        userNonces[msg.sender] = currentNonce + 1;

        // Record on mapper (validates bounds and daily volume)
        mapper.recordTransfer(token, destChainSelector, amount);

        // Pull user tokens into bridge custody
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        emit Deposit(
            depositId,
            token,
            msg.sender,
            recipient,
            amount,
            destChainSelector,
            nonce,
            block.timestamp
        );

        return depositId;
    }
}

