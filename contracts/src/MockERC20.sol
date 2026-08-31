// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title MockERC20
 * @notice Standard ERC20 token implementation with configurable decimals and open mint/burn functionality for testnet usage and testing.
 */
contract MockERC20 {
    // --- ERC20 Metadata ---
    string public name;
    string public symbol;
    uint8 public immutable decimals;

    // --- State Variables ---
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    // --- Events ---
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    // --- Errors ---
    error InsufficientBalance(address account, uint256 available, uint256 required);
    error InsufficientAllowance(address spender, uint256 currentAllowance, uint256 required);
    error ZeroAddress();

    /**
     * @notice Initializes token with name, symbol, and decimals.
     * @param _name Token full name.
     * @param _symbol Token ticker symbol.
     * @param _decimals Number of decimal places (e.g. 18 for WETH, 6 for tUSDC).
     */
    constructor(string memory _name, string memory _symbol, uint8 _decimals) {
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
    }

    /**
     * @notice Approves `spender` to spend `amount` tokens on behalf of `msg.sender`.
     * @param spender Address authorized to spend.
     * @param amount Maximum token amount authorized.
     * @return success True if the approval was successful.
     */
    function approve(address spender, uint256 amount) external returns (bool) {
        if (spender == address(0)) revert ZeroAddress();
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    /**
     * @notice Transfers `amount` tokens from `msg.sender` to `to`.
     * @param to Recipient address.
     * @param amount Number of tokens to transfer.
     * @return success True if the transfer succeeded.
     */
    function transfer(address to, uint256 amount) external returns (bool) {
        if (to == address(0)) revert ZeroAddress();
        uint256 senderBalance = balanceOf[msg.sender];
        if (senderBalance < amount) revert InsufficientBalance(msg.sender, senderBalance, amount);

        unchecked {
            balanceOf[msg.sender] = senderBalance - amount;
            balanceOf[to] += amount;
        }

        emit Transfer(msg.sender, to, amount);
        return true;
    }

    /**
     * @notice Transfers `amount` tokens from `from` to `to` using the caller's allowance.
     * @param from Source address.
     * @param to Recipient address.
     * @param amount Number of tokens to transfer.
     * @return success True if the transfer succeeded.
     */
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        if (to == address(0)) revert ZeroAddress();
        uint256 currentAllowance = allowance[from][msg.sender];
        if (currentAllowance != type(uint256).max) {
            if (currentAllowance < amount) revert InsufficientAllowance(msg.sender, currentAllowance, amount);
            unchecked {
                allowance[from][msg.sender] = currentAllowance - amount;
            }
            emit Approval(from, msg.sender, allowance[from][msg.sender]);
        }

        uint256 fromBalance = balanceOf[from];
        if (fromBalance < amount) revert InsufficientBalance(from, fromBalance, amount);

        unchecked {
            balanceOf[from] = fromBalance - amount;
            balanceOf[to] += amount;
        }

        emit Transfer(from, to, amount);
        return true;
    }

    /**
     * @notice Public mint function for faucets and test environments.
     * @param to Recipient of the minted tokens.
     * @param amount Quantity of tokens to mint.
     */
    function mint(address to, uint256 amount) external {
        if (to == address(0)) revert ZeroAddress();
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    /**
     * @notice Burns tokens from a designated address.
     * @param from Address whose tokens are to be burned.
     * @param amount Quantity of tokens to burn.
     */
    function burn(address from, uint256 amount) external {
        if (from == address(0)) revert ZeroAddress();
        if (msg.sender != from) {
            uint256 currentAllowance = allowance[from][msg.sender];
            if (currentAllowance != type(uint256).max) {
                if (currentAllowance < amount) revert InsufficientAllowance(msg.sender, currentAllowance, amount);
                unchecked {
                    allowance[from][msg.sender] = currentAllowance - amount;
                }
                emit Approval(from, msg.sender, allowance[from][msg.sender]);
            }
        }

        uint256 fromBalance = balanceOf[from];
        if (fromBalance < amount) revert InsufficientBalance(from, fromBalance, amount);

        unchecked {
            balanceOf[from] = fromBalance - amount;
            totalSupply -= amount;
        }

        emit Transfer(from, address(0), amount);
    }
}
