// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title MockPriceOracle
 * @notice Mock price oracle for ETH/USD with 8 decimals precision, supporting instant price updates for simulation and testing.
 */
contract MockPriceOracle {
    // --- State Variables ---
    uint256 private _price;
    uint256 private _updatedAt;

    // --- Events ---
    event PriceUpdated(uint256 indexed oldPrice, uint256 indexed newPrice, uint256 timestamp);

    // --- Errors ---
    error InvalidPrice();

    /**
     * @notice Initializes the oracle with an initial price.
     * @param initialPrice Initial ETH/USD price with 8 decimals (e.g., 2000 * 1e8 = $2000).
     */
    constructor(uint256 initialPrice) {
        if (initialPrice == 0) revert InvalidPrice();
        _price = initialPrice;
        _updatedAt = block.timestamp;
        emit PriceUpdated(0, initialPrice, block.timestamp);
    }

    /**
     * @notice Returns the number of decimal places for the price feed (8 decimals for USD pairs).
     * @return Decimals count (8).
     */
    function decimals() external pure returns (uint8) {
        return 8;
    }

    /**
     * @notice Returns the latest price and update timestamp.
     * @return price ETH/USD price with 8 decimals.
     * @return timestamp Block timestamp when the price was recorded.
     */
    function getLatestPrice() external view returns (uint256 price, uint256 timestamp) {
        return (_price, _updatedAt);
    }

    /**
     * @notice Updates the ETH/USD price. Open for testnet crash simulator slider.
     * @param newPrice New ETH/USD price with 8 decimals.
     */
    function setPrice(uint256 newPrice) external {
        if (newPrice == 0) revert InvalidPrice();
        uint256 oldPrice = _price;
        _price = newPrice;
        _updatedAt = block.timestamp;
        emit PriceUpdated(oldPrice, newPrice, block.timestamp);
    }
}
