import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import truffleAssert from "truffle-assertions";

const KYCWhitelistMerkleSTO = artifacts.require("KYCWhitelistMerkleSTO");

contract("KYCWhitelistMerkleSTO", (accounts) => {
  let contract;
  const [admin, operator, investor1, investor2, token] = accounts;

  let merkleTree, merkleRoot, proof1, expiry, isAccredited1, isAccredited2;

  beforeEach(async () => {
    contract = await KYCWhitelistMerkleSTO.new({ from: admin });

    await contract.grantOperatorRole(operator, { from: admin });

    expiry = Math.floor(Date.now() / 1000) + 3600 * 24 * 100;
    isAccredited1 = false;
    isAccredited2 = true;

    const values = [
      [investor1, expiry, isAccredited1],
      [investor2, expiry, isAccredited2]
    ];
    merkleTree = StandardMerkleTree.of(values, ["address", "uint64", "bool"]);
    merkleRoot = merkleTree.root;

    for (const [i, v] of merkleTree.entries()) {
      if (v[0] === investor1) {
        proof1 = merkleTree.getProof(i);
        break;
      }
    }
  });

  it("should allow operator to set merkle root", async () => {
    const tx = await contract.modifyKYCData(merkleRoot, { from: operator });
    truffleAssert.eventEmitted(tx, "MerkleRootUpdated", (ev) => ev.root === merkleRoot);
  });

  it("should reject non-operator trying to set merkle root", async () => {
    await truffleAssert.reverts(
      contract.modifyKYCData(merkleRoot, { from: investor1 }),
      "Not a operator"
    );
  });

  it("should verify investor with valid proof", async () => {
    await contract.modifyKYCData(merkleRoot, { from: operator });

    const tx = await contract.verifyInvestor(
      proof1,
      investor1,
      expiry,
      isAccredited1,
      { from: investor1 }
    );

    truffleAssert.eventEmitted(tx, "InvestorKYCDataUpdate", (ev) =>
      ev.investor === investor1 &&
      ev.expiryTime.toString() === String(expiry) &&
      ev.isAccredited === isAccredited1
    );

    const result = await contract.isExistingInvestor(investor1);
    assert.strictEqual(result, true);
  });

  it("should reject expired proof", async () => {
    await contract.modifyKYCData(merkleRoot, { from: operator });

    const expiredExpiry = Math.floor(Date.now() / 1000) - 3600;

    await truffleAssert.reverts(
      contract.verifyInvestor(
        proof1,
        investor1,
        expiredExpiry,
        isAccredited1,
        { from: investor1 }
      ),
      "Investor Proof has expired"
    );
  });

  it("should reject invalid proof", async () => {
    await contract.modifyKYCData(merkleRoot, { from: operator });

    const invalidProof = ["0x0"];
    await truffleAssert.reverts(
      contract.verifyInvestor(
        invalidProof,
        investor1,
        expiry,
        isAccredited1,
        { from: investor1 }
      ),
      "Invalid proof"
    );
  });

  it("should return correct KYC data for existing investor", async () => {
    await contract.modifyKYCData(merkleRoot, { from: operator });
    await contract.verifyInvestor(proof1, investor1, expiry, isAccredited1, {
      from: investor1
    });

    const now = Math.floor(Date.now() / 1000);
    await contract.addTokenLockStartTime(token, now, { from: admin });

    const result = await contract.getInvestorKYCData(investor1, token);
    assert.strictEqual(result.added.toString(), "1");
    assert.strictEqual(result.expiryTime.toString(), String(expiry));
  });

  it("should handle token transfer status", async () => {
    await contract.modifyKYCData(merkleRoot, { from: operator });
    await contract.verifyInvestor(proof1, investor1, expiry, isAccredited1, {
      from: investor1
    });

    // Disable transfers for token
    await contract.modifyTokenTransferStatus(token, false, { from: admin });

    const result = await contract.getInvestorKYCData(investor1, token);
    // The canSendAfter value should be greater than now + MAX_LOCK_PERIOD
    const now = Math.floor(Date.now() / 1000);
    const MAX_LOCK_PERIOD = 365 * 24 * 3600;
    assert.ok(result.canSendAfter.toNumber() > now + MAX_LOCK_PERIOD);
  });

  it("should allow admin to grant and revoke operator role", async () => {
    await contract.grantOperatorRole(investor2, { from: admin });
    assert.strictEqual(await contract.isOperator(investor2), true);

    await contract.revokeOperatorRole(investor2, { from: admin });
    assert.strictEqual(await contract.isOperator(investor2), false);
  });

  it("should return token transfer status", async () => {
    await contract.modifyTokenTransferStatus(token, true, { from: admin });
    const status = await contract.getTokenTransferStatus(token);
    assert.strictEqual(status, true);
  });

  it("should return default KYC data for non-existing investor", async () => {
    const result = await contract.getInvestorKYCData(investor2, token);
    const now = Math.floor(Date.now() / 1000);
    const MAX_LOCK_PERIOD = 365 * 24 * 3600;

    assert.ok(
      Math.abs(result.canSendAfter.toNumber() - (now + MAX_LOCK_PERIOD)) < 100
    );
    assert.ok(
      Math.abs(result.canReceiveAfter.toNumber() - (now + MAX_LOCK_PERIOD)) < 100
    );
    assert.ok(
      Math.abs(result.expiryTime.toNumber() - (now - 1)) < 100
    );
    assert.strictEqual(result.added.toString(), "1");
  });

  it("should return default values for non-existing investor in getInvestorKYCData (else path)", async () => {
    // investor2 has not been verified, so is not an existing investor
    const result = await contract.getInvestorKYCData(investor2, token);

    const now = Math.floor(Date.now() / 1000);
    const MAX_LOCK_PERIOD = 365 * 24 * 3600;
    // The returned values should match the else branch
    assert.ok(
      Math.abs(result.canSendAfter.toNumber() - (now + MAX_LOCK_PERIOD)) < 100
    );
    assert.ok(
      Math.abs(result.canReceiveAfter.toNumber() - (now + MAX_LOCK_PERIOD)) < 100
    );
    assert.ok(
      Math.abs(result.expiryTime.toNumber() - (now - 1)) < 100
    );
    assert.strictEqual(result.added.toString(), "1");
  });

  it("should grant and revoke admin role", async () => {
    await contract.grantAdminRole(investor2, { from: admin });
    assert.strictEqual(await contract.isAdmin(investor2), true);

    await contract.revokeAdminRole(investor2, { from: admin });
    assert.strictEqual(await contract.isAdmin(investor2), false);
  });

  it("should revert when granting admin role to an existing admin", async () => {
    await contract.grantAdminRole(investor2, { from: admin });
    await truffleAssert.reverts(
      contract.grantAdminRole(investor2, { from: admin }),
      "Account is already an admin"
    );
  });

  it("should revert when revoking admin role from a non-admin", async () => {
    await truffleAssert.reverts(
      contract.revokeAdminRole(investor2, { from: admin }),
      "Account is not an admin"
    );
  });

  it("should revert when granting operator role to an existing operator", async () => {
    await contract.grantOperatorRole(investor2, { from: admin });
    await truffleAssert.reverts(
      contract.grantOperatorRole(investor2, { from: admin }),
      "Account is already a operator"
    );
  });

  it("should revert when revoking operator role from a non-operator", async () => {
    await truffleAssert.reverts(
      contract.revokeOperatorRole(investor2, { from: admin }),
      "Account is not a operator"
    );
  });

  it("should revert when non-admin tries to addTokenLockStartTime", async () => {
    await truffleAssert.reverts(
      contract.addTokenLockStartTime(token, 1234567890, { from: investor1 }),
      "Not an admin"
    );
  });

  it("should revert when non-admin tries to modifyTokenTransferStatus", async () => {
    await truffleAssert.reverts(
      contract.modifyTokenTransferStatus(token, true, { from: investor1 }),
      "Not an admin"
    );
  });

  it("should revert when non-admin tries to grantAdminRole", async () => {
    await truffleAssert.reverts(
      contract.grantAdminRole(investor2, { from: investor1 }),
      "Not an admin"
    );
  });

  it("should revert when non-admin tries to revokeAdminRole", async () => {
    await truffleAssert.reverts(
      contract.revokeAdminRole(investor2, { from: investor1 }),
      "Not an admin"
    );
  });

  it("should revert when non-admin tries to grantOperatorRole", async () => {
    await truffleAssert.reverts(
      contract.grantOperatorRole(investor2, { from: investor1 }),
      "Not an admin"
    );
  });

  it("should revert when non-admin tries to revokeOperatorRole", async () => {
    await truffleAssert.reverts(
      contract.revokeOperatorRole(investor2, { from: investor1 }),
      "Not an admin"
    );
  });

  it("should set _existingInvestors for a new investor in verifyInvestor", async () => {
    await contract.modifyKYCData(merkleRoot, { from: operator });

    // Use accounts[5] as a new investor (not investor1 or investor2)
    const newInvestor = accounts[5];

    // Add newInvestor to the Merkle tree for this test
    const newExpiry = Math.floor(Date.now() / 1000) + 3600 * 24 * 100;
    const newIsAccredited = false;
    const newValues = [
      [newInvestor, newExpiry, newIsAccredited]
    ];
    const newTree = StandardMerkleTree.of(newValues, ["address", "uint64", "bool"]);
    const newRoot = newTree.root;
    let newProof;
    for (const [i, v] of newTree.entries()) {
      if (v[0] === newInvestor) {
        newProof = newTree.getProof(i);
        break;
      }
    }
    await contract.modifyKYCData(newRoot, { from: operator });

    // Call verifyInvestor for the first time for newInvestor
    await contract.verifyInvestor(
      newProof,
      newInvestor,
      newExpiry,
      newIsAccredited,
      { from: newInvestor }
    );

    // Now _existingInvestors[newInvestor] should be true
    assert.strictEqual(await contract.isExistingInvestor(newInvestor), true);
  });

  it("should take the else path when investor is already existing in verifyInvestor", async () => {
    await contract.modifyKYCData(merkleRoot, { from: operator });

    // First verification: investor1 is not existing yet
    await contract.verifyInvestor(
      proof1,
      investor1,
      expiry,
      isAccredited1,
      { from: investor1 }
    );

    // Second verification: investor1 is now already existing
    // This will take the else path in the contract
    await contract.verifyInvestor(
      proof1,
      investor1,
      expiry,
      isAccredited1,
      { from: investor1 }
    );

    // Assert that investor1 is still marked as existing
    assert.strictEqual(await contract.isExistingInvestor(investor1), true);
  });

  it("should take else paths when investor is not accredited and transfer is allowed", async () => {
    await contract.modifyKYCData(merkleRoot, { from: operator });
    await contract.verifyInvestor(
      proof1,
      investor1,
      expiry,
      false, // isAccredited1 is false
      { from: investor1 }
    );

    // Set token lock start time
    const now = Math.floor(Date.now() / 1000);
    await contract.addTokenLockStartTime(token, now, { from: admin });

    // Ensure transfer is allowed
    await contract.modifyTokenTransferStatus(token, true, { from: admin });

    const result = await contract.getInvestorKYCData(investor1, token);

    // _canSendAfter should be pastBlockTimestamp (since isAccredited is false and transfer is allowed)
    const pastBlockTimestamp = now - 1;
    assert.ok(
      Math.abs(result.canSendAfter.toNumber() - pastBlockTimestamp) < 100
    );
    assert.ok(
      Math.abs(result.canReceiveAfter.toNumber() - pastBlockTimestamp) < 100
    );
    assert.strictEqual(result.expiryTime.toString(), String(expiry));
    assert.strictEqual(result.added.toString(), "1");
  });

  it("should take else path when investor is accredited and transfer is allowed", async () => {
    // Get proof for investor2 (accredited)
    let proof2;
    for (const [i, v] of merkleTree.entries()) {
      if (v[0] === investor2) {
        proof2 = merkleTree.getProof(i);
        break;
      }
    }

    await contract.modifyKYCData(merkleRoot, { from: operator });
    await contract.verifyInvestor(
      proof2,
      investor2,
      expiry,
      true, // isAccredited2 is true
      { from: investor2 }
    );

    // Set token lock start time
    const now = Math.floor(Date.now() / 1000);
    await contract.addTokenLockStartTime(token, now, { from: admin });

    // Ensure transfer is allowed
    await contract.modifyTokenTransferStatus(token, true, { from: admin });

    const result = await contract.getInvestorKYCData(investor2, token);

    // _canSendAfter should be tokenLockStartTime[token] + MAX_LOCK_PERIOD
    const MAX_LOCK_PERIOD = 365 * 24 * 3600;
    assert.strictEqual(result.canSendAfter.toNumber(), now + MAX_LOCK_PERIOD);
    assert.ok(
      Math.abs(result.canReceiveAfter.toNumber() - (now - 1)) < 100
    );
    assert.strictEqual(result.expiryTime.toString(), String(expiry));
    assert.strictEqual(result.added.toString(), "1");
  });

  it("should take else path for isAccredited and if path for !isTransferAllowed", async () => {
    await contract.modifyKYCData(merkleRoot, { from: operator });
    await contract.verifyInvestor(
      proof1,
      investor1,
      expiry,
      false, // isAccredited1 is false
      { from: investor1 }
    );

    // Set token lock start time
    const now = Math.floor(Date.now() / 1000);
    await contract.addTokenLockStartTime(token, now, { from: admin });

    // Disable transfer
    await contract.modifyTokenTransferStatus(token, false, { from: admin });

    const result = await contract.getInvestorKYCData(investor1, token);

    // _canSendAfter should be pastBlockTimestamp + futureBlockTimestamp
    const pastBlockTimestamp = now - 1;
    const futureBlockTimestamp = now + 365 * 24 * 3600;
    assert.ok(
      Math.abs(result.canSendAfter.toNumber() - (pastBlockTimestamp + futureBlockTimestamp)) < 200
    );
    assert.ok(
      Math.abs(result.canReceiveAfter.toNumber() - pastBlockTimestamp) < 100
    );
    assert.strictEqual(result.expiryTime.toString(), String(expiry));
    assert.strictEqual(result.added.toString(), "1");
  });
});
