// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title WhitechainBridgeMapper
 * @notice Cross-chain token registry and daily limit coordinator for Whitechain Bridge.
 *         Adapted from whitechain-labs/bridge-contracts architecture.
 */
contract WhitechainBridgeMapper is Ownable {
    enum TransferType {
        LOCK_RELEASE,
        BURN_MINT
    }

    struct TokenConfig {
        address localToken;
        address foreignToken;
        uint64 destChainSelector;
        TransferType transferType;
        uint256 minAmount;
        uint256 maxAmount;
        uint256 dailyLimit;
        uint256 currentDailyVolume;
        uint256 lastVolumeReset;
        bool isActive;
    }

    /// @notice Authorized bridge contracts permitted to record transfers
    mapping(address => bool) public authorizedBridges;

    mapping(bytes32 => TokenConfig) private _configs;

    event TokenConfigAdded(
        address indexed localToken,
        uint64 indexed destChainSelector,
        address foreignToken,
        uint8 transferType,
        uint256 minAmount,
        uint256 maxAmount,
        uint256 dailyLimit
    );

    event TokenConfigUpdated(
        address indexed localToken,
        uint64 indexed destChainSelector,
        address foreignToken,
        uint8 transferType,
        uint256 minAmount,
        uint256 maxAmount,
        uint256 dailyLimit,
        bool isActive
    );

    event TokenStatusChanged(
        address indexed localToken,
        uint64 indexed destChainSelector,
        bool isActive
    );

    event DailyLimitUpdated(
        address indexed localToken,
        uint64 indexed destChainSelector,
        uint256 newDailyLimit
    );

    event DailyVolumeReset(
        address indexed localToken,
        uint64 indexed destChainSelector,
        uint256 timestamp
    );

    event BridgeAuthorizationChanged(address indexed bridge, bool authorized);

    event TransferRecorded(
        address indexed localToken,
        uint64 indexed destChainSelector,
        uint256 amount,
        uint256 currentDailyVolume
    );

    error InvalidAddress();
    error InvalidAmountBounds();
    error TokenNotConfigured();
    error TokenInactive();
    error UnauthorizedCaller();
    error AmountBelowMinimum(uint256 amount, uint256 minAmount);
    error AmountExceedsMaximum(uint256 amount, uint256 maxAmount);
    error DailyLimitExceeded(uint256 requested, uint256 remaining);

    modifier onlyAuthorizedBridge() {
        if (!authorizedBridges[msg.sender] && msg.sender != owner()) {
            revert UnauthorizedCaller();
        }
        _;
    }

    constructor() Ownable(msg.sender) {}

    /**
     * @notice Computes unique mapping key for a token and destination chain.
     */
    function getMappingKey(
        address localToken,
        uint64 destChainSelector
    ) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(localToken, destChainSelector));
    }

    /**
     * @notice Registers a new token configuration.
     */
    function addToken(
        address localToken,
        address foreignToken,
        uint64 destChainSelector,
        uint8 transferType,
        uint256 minAmount,
        uint256 maxAmount,
        uint256 dailyLimit
    ) external onlyOwner {
        if (localToken == address(0) || foreignToken == address(0)) {
            revert InvalidAddress();
        }
        if (minAmount == 0 || minAmount > maxAmount || dailyLimit < maxAmount) {
            revert InvalidAmountBounds();
        }

        bytes32 key = getMappingKey(localToken, destChainSelector);
        _configs[key] = TokenConfig({
            localToken: localToken,
            foreignToken: foreignToken,
            destChainSelector: destChainSelector,
            transferType: TransferType(transferType),
            minAmount: minAmount,
            maxAmount: maxAmount,
            dailyLimit: dailyLimit,
            currentDailyVolume: 0,
            lastVolumeReset: block.timestamp,
            isActive: true
        });

        emit TokenConfigAdded(
            localToken,
            destChainSelector,
            foreignToken,
            transferType,
            minAmount,
            maxAmount,
            dailyLimit
        );
    }

    /**
     * @notice Updates an existing token configuration.
     */
    function updateToken(
        address localToken,
        uint64 destChainSelector,
        address foreignToken,
        uint8 transferType,
        uint256 minAmount,
        uint256 maxAmount,
        uint256 dailyLimit,
        bool isActive
    ) external onlyOwner {
        if (foreignToken == address(0)) {
            revert InvalidAddress();
        }
        if (minAmount == 0 || minAmount > maxAmount || dailyLimit < maxAmount) {
            revert InvalidAmountBounds();
        }

        bytes32 key = getMappingKey(localToken, destChainSelector);
        TokenConfig storage config = _configs[key];
        if (config.localToken == address(0)) {
            revert TokenNotConfigured();
        }

        config.foreignToken = foreignToken;
        config.transferType = TransferType(transferType);
        config.minAmount = minAmount;
        config.maxAmount = maxAmount;
        config.dailyLimit = dailyLimit;
        config.isActive = isActive;

        emit TokenConfigUpdated(
            localToken,
            destChainSelector,
            foreignToken,
            transferType,
            minAmount,
            maxAmount,
            dailyLimit,
            isActive
        );
    }

    /**
     * @notice Activates or deactivates a token mapping.
     */
    function setTokenActive(
        address localToken,
        uint64 destChainSelector,
        bool isActive
    ) external onlyOwner {
        bytes32 key = getMappingKey(localToken, destChainSelector);
        TokenConfig storage config = _configs[key];
        if (config.localToken == address(0)) {
            revert TokenNotConfigured();
        }

        config.isActive = isActive;
        emit TokenStatusChanged(localToken, destChainSelector, isActive);
    }

    /**
     * @notice Updates the daily volume limit for a token lane.
     */
    function setDailyLimit(
        address localToken,
        uint64 destChainSelector,
        uint256 newDailyLimit
    ) external onlyOwner {
        bytes32 key = getMappingKey(localToken, destChainSelector);
        TokenConfig storage config = _configs[key];
        if (config.localToken == address(0)) {
            revert TokenNotConfigured();
        }
        if (newDailyLimit < config.maxAmount) {
            revert InvalidAmountBounds();
        }

        config.dailyLimit = newDailyLimit;
        emit DailyLimitUpdated(localToken, destChainSelector, newDailyLimit);
    }

    /**
     * @notice Authorizes or deauthorizes a bridge contract to record transfers.
     */
    function setBridgeAuthorization(
        address bridge,
        bool authorized
    ) external onlyOwner {
        if (bridge == address(0)) {
            revert InvalidAddress();
        }
        authorizedBridges[bridge] = authorized;
        emit BridgeAuthorizationChanged(bridge, authorized);
    }

    /**
     * @notice Retrieves full token configuration.
     */
    function getTokenConfig(
        address localToken,
        uint64 destChainSelector
    ) external view returns (TokenConfig memory) {
        bytes32 key = getMappingKey(localToken, destChainSelector);
        TokenConfig memory config = _configs[key];
        if (config.localToken == address(0)) {
            revert TokenNotConfigured();
        }
        return config;
    }

    /**
     * @notice Checks if a token mapping exists and is active.
     */
    function isTokenSupported(
        address localToken,
        uint64 destChainSelector
    ) external view returns (bool) {
        bytes32 key = getMappingKey(localToken, destChainSelector);
        TokenConfig memory config = _configs[key];
        return config.localToken != address(0) && config.isActive;
    }

    /**
     * @notice Returns remaining daily limit available in the current window.
     */
    function getRemainingDailyLimit(
        address localToken,
        uint64 destChainSelector
    ) public view returns (uint256) {
        bytes32 key = getMappingKey(localToken, destChainSelector);
        TokenConfig memory config = _configs[key];
        if (config.localToken == address(0) || !config.isActive) {
            return 0;
        }

        if (block.timestamp >= config.lastVolumeReset + 1 days) {
            return config.dailyLimit;
        }

        if (config.currentDailyVolume >= config.dailyLimit) {
            return 0;
        }

        return config.dailyLimit - config.currentDailyVolume;
    }

    /**
     * @notice Validates transfer parameters and updates daily volume quotas. Can only be called by authorized bridge contracts.
     */
    function recordTransfer(
        address localToken,
        uint64 destChainSelector,
        uint256 amount
    )
        external
        onlyAuthorizedBridge
        returns (uint8 transferType, address foreignToken)
    {
        bytes32 key = getMappingKey(localToken, destChainSelector);
        TokenConfig storage config = _configs[key];

        if (config.localToken == address(0)) {
            revert TokenNotConfigured();
        }
        if (!config.isActive) {
            revert TokenInactive();
        }
        if (amount < config.minAmount) {
            revert AmountBelowMinimum(amount, config.minAmount);
        }
        if (amount > config.maxAmount) {
            revert AmountExceedsMaximum(amount, config.maxAmount);
        }

        // Daily volume rollover check (24 hour rolling window)
        if (block.timestamp >= config.lastVolumeReset + 1 days) {
            config.currentDailyVolume = 0;
            config.lastVolumeReset = block.timestamp;
            emit DailyVolumeReset(localToken, destChainSelector, block.timestamp);
        }

        uint256 remaining = config.dailyLimit - config.currentDailyVolume;
        if (amount > remaining) {
            revert DailyLimitExceeded(amount, remaining);
        }

        config.currentDailyVolume += amount;
        emit TransferRecorded(
            localToken,
            destChainSelector,
            amount,
            config.currentDailyVolume
        );

        return (uint8(config.transferType), config.foreignToken);
    }
}

