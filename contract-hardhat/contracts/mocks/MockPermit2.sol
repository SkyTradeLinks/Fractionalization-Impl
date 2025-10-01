// SPDX-License-Identifier: MIT 
pragma solidity 0.8.30;

contract MockPermit2 {
    // Minimal storage to simulate approvals
    mapping(address => mapping(address => uint256)) public allowance;

    function permitTransferFrom(
        address from,
        address to,
        uint256 amount
    ) external {
        // naive "transfer" simulation
        require(allowance[from][msg.sender] >= amount, "Not permitted");
        allowance[from][msg.sender] -= amount;
    }

    function approve(
        address spender,
        uint256 amount
    ) external {
        allowance[msg.sender][spender] = amount;
    }
}
