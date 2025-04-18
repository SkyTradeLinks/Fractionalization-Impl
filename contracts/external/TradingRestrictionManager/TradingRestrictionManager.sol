// SPDX-License-Identifier: MIT
pragma solidity 0.5.8;

import "./ITradingRestrictionManager.sol";

/**
 * @dev Replaces OpenZeppelin's Ownable for Solidity 0.5.8
 */
contract Ownable {
    address public owner;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    constructor () public {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Ownable: caller is not the owner");
        _;
    }

    function transferOwnership(address newOwner) public onlyOwner {
        require(newOwner != address(0), "Ownable: new owner is the zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
}

contract TradingRestrictionManager is ITradingRestrictionManager, Ownable {
    mapping(address => bool) public isOperator;
    mapping(address => InvestorKYCData) private _kycData;
    mapping(address => bool) private _existingInvestors;

    mapping(address => uint64) public nonUSTradingRestrictionPeriod;
    mapping(address => uint64) public usTradingRestrictionPeriod;
    mapping(address => uint64) public tokenLockStartTime;
    mapping(address => bool) public whitelistOnlyTrading;

    event OperatorRoleGranted(address indexed operator);
    event OperatorRoleRevoked(address indexed operator);
    event TradingRestrictionSet(address indexed token, uint64 nonUS, uint64 us, uint64 lockStart);

    modifier onlyOperator() {
        require(isOperator[msg.sender], "Operator only");
        _;
    }

    function grantOperator(address account) external onlyOwner {
        require(!isOperator[account], "Already operator");
        isOperator[account] = true;
        emit OperatorRoleGranted(account);
    }

    function revokeOperator(address account) external onlyOwner {
        require(isOperator[account], "Not an operator");
        isOperator[account] = false;
        emit OperatorRoleRevoked(account);
    }

    function modifyKYCData(
        address investor,
        uint64 expiryTime,
        bool, // isAccredited unused
        InvestorClass investorClass
    ) external onlyOperator {
        _existingInvestors[investor] = true;
        _kycData[investor] = InvestorKYCData(expiryTime, investorClass);
        emit InvestorKYCDataUpdated(investor, expiryTime, investorClass);
    }

    function isExistingInvestor(address investor) external view returns (bool) {
        return _existingInvestors[investor];
    }

    function setTradingRestrictionPeriod(
        address token,
        uint64 nonUSPeriod,
        uint64 usPeriod,
        uint64 lockStart
    ) external onlyOwner {
        nonUSTradingRestrictionPeriod[token] = nonUSPeriod;
        usTradingRestrictionPeriod[token] = usPeriod;
        tokenLockStartTime[token] = lockStart;
        emit TradingRestrictionSet(token, nonUSPeriod, usPeriod, lockStart);
    }

    function setWhitelistOnlyTrading(address token, bool status) external onlyOwner {
        whitelistOnlyTrading[token] = status;
        emit WhitelistOnlyTradingUpdated(token, status);
    }

    function getInvestorKYCData(
        address investor,
        address token
    ) public view returns (
        uint64 canSendAfter,
        uint64 canReceiveAfter,
        uint64 expiryTime,
        uint8 added
    ) {
        bool exists = _existingInvestors[investor];
        bool enforceWhitelist = whitelistOnlyTrading[token];

        if (!exists && enforceWhitelist) {
            return (_future(), _future(), _past(), 0);
        }

        InvestorKYCData memory kyc = _kycData[investor];
        uint64 startTime = tokenLockStartTime[token];

        if (startTime == 0) {
            return (_future(), _future(), kyc.expiryTime, 1);
        }

        uint64 restrictionPeriod = kyc.investorClass == InvestorClass.US
            ? usTradingRestrictionPeriod[token]
            : nonUSTradingRestrictionPeriod[token];

        uint64 unlockTime = startTime + restrictionPeriod;
        uint64 sendAfter = now >= unlockTime ? _past() : unlockTime;

        return (
            sendAfter,
            _past(),
            kyc.expiryTime,
            1
        );
    }

    function _future() internal view returns (uint64) {
        return uint64(now + (1 days));
    }

    function _past() internal view returns (uint64) {
        return uint64(now - (1 days));
    }
}