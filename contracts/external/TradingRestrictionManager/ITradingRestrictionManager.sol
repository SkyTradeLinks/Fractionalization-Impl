// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ITradingRestrictionManager {
    enum InvestorClass {
        NonUS,
        US
    }

    struct InvestorKYCData {
        uint64 expiryTime;
        InvestorClass investorClass;
    }

    // Events (only those present in the contract)
    event InvestorKYCDataUpdated(address indexed investor, uint64 expiryTime, InvestorClass investorClass);
    event WhitelistOnlyTradingUpdated(address indexed token, bool status);

    // KYC Management
    function modifyKYCData(
        address investor,
        uint64 expiryTime,
        bool isAccredited, // You had this param, but it wasn't used in logic. Keep it for interface compatibility.
        InvestorClass investorClass
    ) external;

    // Trading restriction setup per token
    function setTradingRestrictionPeriod(
        address token,
        uint64 nonUSRestrictionPeriod,
        uint64 usRestrictionPeriod,
        uint64 lockStartTime
    ) external;

    // Toggle whitelist-only trading mode per token
    function setWhitelistOnlyTrading(address token, bool status) external;

    // Query if investor is registered
    function isExistingInvestor(address investor) external view returns (bool);

    // Check investor KYC status and trading restrictions
    function getInvestorKYCData(
        address investor,
        address token
    ) external view returns (
        uint64 canSendAfter,
        uint64 canReceiveAfter,
        uint64 expiryTime,
        uint8 added
    );
}