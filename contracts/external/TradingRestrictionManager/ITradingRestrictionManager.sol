// SPDX-License-Identifier: MIT
pragma solidity 0.5.8;

interface ITradingRestrictionManager {
    enum InvestorClass { NonUS, US }

    struct InvestorKYCData {
        uint64 expiryTime;
        InvestorClass investorClass;
    }

    event InvestorKYCDataUpdated(address indexed investor, uint64 expiryTime, InvestorClass investorClass);
    event WhitelistOnlyTradingUpdated(address indexed token, bool status);

    function modifyKYCData(
        address investor,
        uint64 expiryTime,
        bool isAccredited,
        InvestorClass investorClass
    ) external;

    function setTradingRestrictionPeriod(
        address token,
        uint64 nonUSRestrictionPeriod,
        uint64 usRestrictionPeriod,
        uint64 lockStartTime
    ) external;

    function setWhitelistOnlyTrading(address token, bool status) external;

    function isExistingInvestor(address investor) external view returns (bool);

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