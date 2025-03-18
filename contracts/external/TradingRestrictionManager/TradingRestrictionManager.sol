// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./ITradingRestrictionManager.sol";

library TimestampUtils {
    function future(uint64 daysAhead) internal view returns (uint64) {
        return uint64(block.timestamp + (daysAhead * 1 days));
    }

    function past(uint64 daysAgo) internal view returns (uint64) {
        return uint64(block.timestamp - (daysAgo * 1 days));
    }
}

contract TradingRestrictionManager is ITradingRestrictionManager, Ownable {
    using TimestampUtils for uint64;

    // Operator roles
    mapping(address => bool) public isOperator;

    // Investor KYC data
    mapping(address => InvestorKYCData) private _kycData;
    mapping(address => bool) private _existingInvestors;

    // Token-specific restrictions
    mapping(address => uint64) public nonUSTradingRestrictionPeriod;
    mapping(address => uint64) public usTradingRestrictionPeriod;
    mapping(address => uint64) public tokenLockStartTime;
    mapping(address => bool) public whitelistOnlyTrading;

    modifier onlyOperator() {
        require(isOperator[msg.sender], "Operator only");
        _;
    }

    // Operator Management
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

    // Investor KYC Management
    function modifyKYCData(
        address investor,
        uint64 expiryTime,
        bool, // isAccredited unused but preserved for interface compatibility
        InvestorClass investorClass
    ) external override onlyOperator {
        _existingInvestors[investor] = true;
        _kycData[investor] = InvestorKYCData(expiryTime, investorClass);
        emit InvestorKYCDataUpdate(investor, expiryTime, investorClass);
    }

    function isExistingInvestor(address investor) external view returns (bool) {
        return _existingInvestors[investor];
    }

    // Token Settings
    function setTradingRestrictionPeriod(
        address token,
        uint64 nonUSPeriod,
        uint64 usPeriod,
        uint64 lockStart
    ) external override onlyOwner {
        nonUSTradingRestrictionPeriod[token] = nonUSPeriod;
        usTradingRestrictionPeriod[token] = usPeriod;
        tokenLockStartTime[token] = lockStart;
        emit TradingRestrictionSet(token, nonUSPeriod, usPeriod, lockStart);
    }

    function setWhitelistOnlyTrading(address token, bool status) external override onlyOwner {
        whitelistOnlyTrading[token] = status;
        emit WhitelistOnlyTradingUpdated(token, status);
    }

    // KYC Data Query / Trade Permission Check
    function getInvestorKYCData(
        address investor,
        address token
    ) public view override returns (
        uint64 canSendAfter,
        uint64 canReceiveAfter,
        uint64 expiryTime,
        uint8 added
    ) {
        bool exists = _existingInvestors[investor];
        bool enforceWhitelist = whitelistOnlyTrading[token];

        // If whitelist enforced and investor is unknown, block trade
        if (!exists && enforceWhitelist) {
            return (_future(), _future(), _past(), 0);
        }

        InvestorKYCData memory kyc = _kycData[investor];
        uint64 startTime = tokenLockStartTime[token];

        if (startTime == 0) {
            // Token issuance not started
            return (_future(), _future(), kyc.expiryTime, 1);
        }

        // Determine unlock time based on investor class
        uint64 restrictionPeriod = kyc.investorClass == InvestorClass.US
            ? usTradingRestrictionPeriod[token]
            : nonUSTradingRestrictionPeriod[token];

        uint64 unlockTime = startTime + restrictionPeriod;
        uint64 sendAfter = block.timestamp >= unlockTime ? _past() : unlockTime;

        return (
            sendAfter,
            _past(), // Receiving is unrestricted unless customized
            kyc.expiryTime,
            1
        );
    }

    // Internal time helpers
    function _future() internal view returns (uint64) {
        return TimestampUtils.future(1); // 1 day ahead
    }

    function _past() internal view returns (uint64) {
        return TimestampUtils.past(1); // 1 day ago
    }
}