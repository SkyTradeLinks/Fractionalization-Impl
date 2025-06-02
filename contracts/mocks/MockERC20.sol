// SPDX-License-Identifier: MIT
pragma solidity 0.5.8;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20Detailed.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Mintable.sol";

/**
 * @title MockERC20
 * @dev Mock ERC20 contract for testing
 */
contract MockERC20 is ERC20Detailed, ERC20Mintable {
    constructor(
        string memory name,
        string memory symbol,
        uint8 decimals
    ) public ERC20Detailed(name, symbol, decimals) {}
}