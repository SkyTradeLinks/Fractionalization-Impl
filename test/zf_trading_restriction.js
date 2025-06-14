import { eventEmitted, reverts } from "truffle-assertions";

const TradingRestrictionManager = artifacts.require("TradingRestrictionManager");

contract("TradingRestrictionManager", (accounts) => {
  let contract;
  const [owner, operator1, operator2, investor1, investor2, investor3, token1, token2, nonOwner] = accounts;

  // Constants for testing
  const INVESTOR_CLASS = {
    NonUS: 0,
    US: 1
  };

  const ONE_DAY = 24 * 60 * 60; // 1 day in seconds
  const ONE_WEEK = 7 * ONE_DAY;
  const ONE_MONTH = 30 * ONE_DAY;

  beforeEach(async () => {
    contract = await TradingRestrictionManager.new({ from: owner });

    // Verify contract deployment
    assert.isNotNull(contract, "Contract should be deployed");
    assert.isNotNull(contract.address, "Contract should have an address");
  });

  describe("Ownership functionality", () => {
    it("should set the deployer as owner", async () => {
      const contractOwner = await contract.owner();
      assert.equal(contractOwner, owner, "Owner should be set to deployer");
    });

    it("should allow owner to transfer ownership", async () => {
      const tx = await contract.transferOwnership(operator1, { from: owner });

      eventEmitted(tx, "OwnershipTransferred", (ev) => {
        return ev.previousOwner === owner && ev.newOwner === operator1;
      });

      const newOwner = await contract.owner();
      assert.equal(newOwner, operator1, "Ownership should be transferred");
    });

    it("should reject ownership transfer to zero address", async () => {
      await reverts(
        contract.transferOwnership("0x0000000000000000000000000000000000000000", { from: owner }),
        "Ownable: new owner is the zero address"
      );
    });

    it("should reject ownership transfer from non-owner", async () => {
      await reverts(
        contract.transferOwnership(operator1, { from: nonOwner }),
        "Ownable: caller is not the owner"
      );
    });
  });

  describe("Operator management", () => {
    it("should allow owner to grant operator role", async () => {
      const tx = await contract.grantOperator(operator1, { from: owner });

      eventEmitted(tx, "OperatorRoleGranted", (ev) => {
        return ev.operator === operator1;
      });

      const isOp = await contract.isOperator(operator1);
      assert.equal(isOp, true, "Operator role should be granted");
    });

    it("should allow owner to revoke operator role", async () => {
      await contract.grantOperator(operator1, { from: owner });

      const tx = await contract.revokeOperator(operator1, { from: owner });

      eventEmitted(tx, "OperatorRoleRevoked", (ev) => {
        return ev.operator === operator1;
      });

      const isOp = await contract.isOperator(operator1);
      assert.equal(isOp, false, "Operator role should be revoked");
    });

    it("should reject granting operator role to existing operator", async () => {
      await contract.grantOperator(operator1, { from: owner });

      await reverts(
        contract.grantOperator(operator1, { from: owner }),
        "Already operator"
      );
    });

    it("should reject revoking non-operator", async () => {
      await reverts(
        contract.revokeOperator(operator1, { from: owner }),
        "Not an operator"
      );
    });

    it("should reject operator management from non-owner", async () => {
      await reverts(
        contract.grantOperator(operator1, { from: nonOwner }),
        "Ownable: caller is not the owner"
      );

      await contract.grantOperator(operator1, { from: owner });

      await reverts(
        contract.revokeOperator(operator1, { from: nonOwner }),
        "Ownable: caller is not the owner"
      );
    });
  });

  describe("KYC Data management", () => {
    beforeEach(async () => {
      await contract.grantOperator(operator1, { from: owner });
    });

    it("should allow operator to modify KYC data", async () => {
      const expiryTime = Math.floor(Date.now() / 1000) + ONE_MONTH;

      const tx = await contract.modifyKYCData(
        investor1,
        expiryTime,
        false, // isAccredited (unused)
        INVESTOR_CLASS.NonUS,
        { from: operator1 }
      );

      eventEmitted(tx, "InvestorKYCDataUpdated", (ev) => {
        return ev.investor === investor1 &&
               ev.expiryTime.toNumber() === expiryTime &&
               ev.investorClass.toNumber() === INVESTOR_CLASS.NonUS;
      });

      const isExisting = await contract.isExistingInvestor(investor1);
      assert.equal(isExisting, true, "Investor should be marked as existing");
    });

    it("should allow operator to modify KYC data for US investor", async () => {
      const expiryTime = Math.floor(Date.now() / 1000) + ONE_MONTH;

      const tx = await contract.modifyKYCData(
        investor2,
        expiryTime,
        true, // isAccredited (unused)
        INVESTOR_CLASS.US,
        { from: operator1 }
      );

      eventEmitted(tx, "InvestorKYCDataUpdated", (ev) => {
        return ev.investor === investor2 &&
               ev.expiryTime.toNumber() === expiryTime &&
               ev.investorClass.toNumber() === INVESTOR_CLASS.US;
      });
    });

    it("should reject KYC modification from non-operator", async () => {
      const expiryTime = Math.floor(Date.now() / 1000) + ONE_MONTH;

      await reverts(
        contract.modifyKYCData(
          investor1,
          expiryTime,
          false,
          INVESTOR_CLASS.NonUS,
          { from: nonOwner }
        ),
        "Operator only"
      );
    });

    it("should return false for non-existing investor", async () => {
      const isExisting = await contract.isExistingInvestor(investor3);
      assert.equal(isExisting, false, "Non-existing investor should return false");
    });
  });

  describe("Trading restriction management", () => {
    it("should allow owner to set trading restriction periods", async () => {
      const nonUSPeriod = ONE_WEEK;
      const usPeriod = ONE_MONTH;
      const lockStart = Math.floor(Date.now() / 1000);

      const tx = await contract.setTradingRestrictionPeriod(
        token1,
        nonUSPeriod,
        usPeriod,
        lockStart,
        { from: owner }
      );

      eventEmitted(tx, "TradingRestrictionSet", (ev) => {
        return ev.token === token1 &&
               ev.nonUS.toNumber() === nonUSPeriod &&
               ev.us.toNumber() === usPeriod &&
               ev.lockStart.toNumber() === lockStart;
      });

      const storedNonUS = await contract.nonUSTradingRestrictionPeriod(token1);
      const storedUS = await contract.usTradingRestrictionPeriod(token1);
      const storedLockStart = await contract.tokenLockStartTime(token1);

      assert.equal(storedNonUS.toNumber(), nonUSPeriod, "Non-US period should be set");
      assert.equal(storedUS.toNumber(), usPeriod, "US period should be set");
      assert.equal(storedLockStart.toNumber(), lockStart, "Lock start time should be set");
    });

    it("should reject trading restriction setting from non-owner", async () => {
      await reverts(
        contract.setTradingRestrictionPeriod(
          token1,
          ONE_WEEK,
          ONE_MONTH,
          Math.floor(Date.now() / 1000),
          { from: nonOwner }
        ),
        "Ownable: caller is not the owner"
      );
    });

    it("should allow owner to set whitelist-only trading", async () => {
      const tx = await contract.setWhitelistOnlyTrading(token1, true, { from: owner });

      eventEmitted(tx, "WhitelistOnlyTradingUpdated", (ev) => {
        return ev.token === token1 && ev.status === true;
      });

      const isWhitelistOnly = await contract.whitelistOnlyTrading(token1);
      assert.equal(isWhitelistOnly, true, "Whitelist-only trading should be enabled");
    });

    it("should reject whitelist-only trading setting from non-owner", async () => {
      await reverts(
        contract.setWhitelistOnlyTrading(token1, true, { from: nonOwner }),
        "Ownable: caller is not the owner"
      );
    });
  });

  describe("KYC Data retrieval", () => {
    beforeEach(async () => {
      await contract.grantOperator(operator1, { from: owner });
    });

    it("should return future times for non-existing investor with whitelist enforcement", async () => {
      await contract.setWhitelistOnlyTrading(token1, true, { from: owner });

      const result = await contract.getInvestorKYCData(investor3, token1);
      const now = Math.floor(Date.now() / 1000);

      assert.isTrue(result.canSendAfter.toNumber() > now, "canSendAfter should be in future");
      assert.isTrue(result.canReceiveAfter.toNumber() > now, "canReceiveAfter should be in future");
      assert.isTrue(result.expiryTime.toNumber() < now, "expiryTime should be in past");
      assert.equal(result.added.toNumber(), 0, "added should be 0");
    });

    it("should return future times when no lock start time is set", async () => {
      const expiryTime = Math.floor(Date.now() / 1000) + ONE_MONTH;
      await contract.modifyKYCData(investor1, expiryTime, false, INVESTOR_CLASS.NonUS, { from: operator1 });

      const result = await contract.getInvestorKYCData(investor1, token1);
      const now = Math.floor(Date.now() / 1000);

      assert.isTrue(result.canSendAfter.toNumber() > now, "canSendAfter should be in future");
      assert.isTrue(result.canReceiveAfter.toNumber() > now, "canReceiveAfter should be in future");
      assert.equal(result.expiryTime.toNumber(), expiryTime, "expiryTime should match");
      assert.equal(result.added.toNumber(), 1, "added should be 1");
    });

    it("should calculate correct unlock time for NonUS investor", async () => {
      const lockStart = Math.floor(Date.now() / 1000);
      const nonUSPeriod = ONE_WEEK;
      const usPeriod = ONE_MONTH;
      const expiryTime = lockStart + ONE_MONTH * 2;

      await contract.setTradingRestrictionPeriod(token1, nonUSPeriod, usPeriod, lockStart, { from: owner });
      await contract.modifyKYCData(investor1, expiryTime, false, INVESTOR_CLASS.NonUS, { from: operator1 });

      const result = await contract.getInvestorKYCData(investor1, token1);
      const expectedUnlockTime = lockStart + nonUSPeriod;
      const now = Math.floor(Date.now() / 1000);

      if (now >= expectedUnlockTime) {
        assert.isTrue(result.canSendAfter.toNumber() < now, "canSendAfter should be in past if unlocked");
      } else {
        assert.equal(result.canSendAfter.toNumber(), expectedUnlockTime, "canSendAfter should match unlock time");
      }

      assert.isTrue(result.canReceiveAfter.toNumber() < now, "canReceiveAfter should be in past");
      assert.equal(result.expiryTime.toNumber(), expiryTime, "expiryTime should match");
      assert.equal(result.added.toNumber(), 1, "added should be 1");
    });

    it("should calculate correct unlock time for US investor", async () => {
      const lockStart = Math.floor(Date.now() / 1000);
      const nonUSPeriod = ONE_WEEK;
      const usPeriod = ONE_MONTH;
      const expiryTime = lockStart + ONE_MONTH * 2;

      await contract.setTradingRestrictionPeriod(token1, nonUSPeriod, usPeriod, lockStart, { from: owner });
      await contract.modifyKYCData(investor2, expiryTime, false, INVESTOR_CLASS.US, { from: operator1 });

      const result = await contract.getInvestorKYCData(investor2, token1);
      const expectedUnlockTime = lockStart + usPeriod;
      const now = Math.floor(Date.now() / 1000);

      if (now >= expectedUnlockTime) {
        assert.isTrue(result.canSendAfter.toNumber() < now, "canSendAfter should be in past if unlocked");
      } else {
        assert.equal(result.canSendAfter.toNumber(), expectedUnlockTime, "canSendAfter should match unlock time");
      }

      assert.equal(result.expiryTime.toNumber(), expiryTime, "expiryTime should match");
      assert.equal(result.added.toNumber(), 1, "added should be 1");
    });

    it("should handle multiple tokens with different restrictions", async () => {
      const lockStart1 = Math.floor(Date.now() / 1000);
      const lockStart2 = lockStart1 + ONE_DAY;
      const expiryTime = lockStart1 + ONE_MONTH * 2;

      await contract.setTradingRestrictionPeriod(token1, ONE_WEEK, ONE_MONTH, lockStart1, { from: owner });
      await contract.setTradingRestrictionPeriod(token2, ONE_DAY, ONE_WEEK, lockStart2, { from: owner });
      await contract.modifyKYCData(investor1, expiryTime, false, INVESTOR_CLASS.NonUS, { from: operator1 });

      const result1 = await contract.getInvestorKYCData(investor1, token1);
      const result2 = await contract.getInvestorKYCData(investor1, token2);

      // Results should be different due to different restriction periods
      assert.notEqual(result1.canSendAfter.toNumber(), result2.canSendAfter.toNumber(), "Different tokens should have different unlock times");
    });
  });

  describe("Edge cases and validation", () => {
    beforeEach(async () => {
      await contract.grantOperator(operator1, { from: owner });
    });

    it("should handle zero restriction periods", async () => {
      const lockStart = Math.floor(Date.now() / 1000);
      const expiryTime = lockStart + ONE_MONTH;

      await contract.setTradingRestrictionPeriod(token1, 0, 0, lockStart, { from: owner });
      await contract.modifyKYCData(investor1, expiryTime, false, INVESTOR_CLASS.NonUS, { from: operator1 });

      const result = await contract.getInvestorKYCData(investor1, token1);
      const now = Math.floor(Date.now() / 1000);

      // With zero restriction period, unlock time should be lock start time
      assert.isTrue(result.canSendAfter.toNumber() <= now, "Should be unlocked immediately with zero restriction");
    });

    it("should handle past expiry times", async () => {
      const pastExpiryTime = Math.floor(Date.now() / 1000) - ONE_DAY;

      await contract.modifyKYCData(investor1, pastExpiryTime, false, INVESTOR_CLASS.NonUS, { from: operator1 });

      const result = await contract.getInvestorKYCData(investor1, token1);

      assert.equal(result.expiryTime.toNumber(), pastExpiryTime, "Should handle past expiry times");
    });

    it("should maintain state across multiple operations", async () => {
      const expiryTime = Math.floor(Date.now() / 1000) + ONE_MONTH;

      // Add investor
      await contract.modifyKYCData(investor1, expiryTime, false, INVESTOR_CLASS.US, { from: operator1 });

      // Set restrictions
      await contract.setTradingRestrictionPeriod(token1, ONE_WEEK, ONE_MONTH, Math.floor(Date.now() / 1000), { from: owner });

      // Enable whitelist
      await contract.setWhitelistOnlyTrading(token1, true, { from: owner });

      // Verify all states are maintained
      const isExisting = await contract.isExistingInvestor(investor1);
      const isWhitelistOnly = await contract.whitelistOnlyTrading(token1);
      const nonUSPeriod = await contract.nonUSTradingRestrictionPeriod(token1);

      assert.equal(isExisting, true, "Investor status should be maintained");
      assert.equal(isWhitelistOnly, true, "Whitelist status should be maintained");
      assert.equal(nonUSPeriod.toNumber(), ONE_WEEK, "Restriction period should be maintained");
    });
  });
});
