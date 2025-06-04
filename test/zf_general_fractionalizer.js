import { web3 } from '@openzeppelin/test-helpers/src/setup';
import { setUpPolymathNetwork, deployGPMAndVerifyed, deployLockUpTMAndVerified, deployCappedSTOAndVerifyed, deployAndVerifyGfn } from "./helpers/createInstances";

const GeneralFractionalizer = artifacts.require('GeneralFractionalizer');
const GeneralFractionalizerProxy = artifacts.require('GeneralFractionalizerProxy');
const STGetter = artifacts.require("./STGetter.sol");
const SecurityToken = artifacts.require("./SecurityToken.sol");
const SampleNFT = artifacts.require('SampleNFT');

contract('GeneralFractionalizer', (accounts) => {
  const [admin, staker, redeemer, claimant] = accounts;
  const tokenSymbol = "SKYTEST1";
  const tokenName = "Sky Demo Token";
  const tokenDetails = "This is equity type of issuance";
  const tokenId = 1;
  const transferManagerKey = 2;
  const generalFractionalizerKey = 8;
  const fractionsCount = 100;
  const fractionPrice = web3.utils.toWei('0.1', 'ether');
  const cappedSTOSetupCost = 0
  const reservePrice = fractionsCount * fractionPrice;

  let nft, fractionalizer;
  let polymathInstances, securityToken;
  let I_SecurityTokenRegistry;

    let I_GeneralPermissionManagerFactory;
    let I_GeneralTransferManagerFactory;
    let I_GeneralFractionalizerFactory;
    let I_SecurityTokenRegistryProxy;
    let I_LockUpTransferManagerFactory;
    let I_GeneralPermissionManager;
    let I_GeneralTransferManager;
    let I_ModuleRegistryProxy;
    let I_ModuleRegistry;
    let I_FeatureRegistry;
    let I_DummySTOFactory;
    let P_DummySTOFactory;
    let I_STFactory;
    let I_SecurityToken;
    let I_STRProxied;
    let I_MRProxied;
    let I_DummySTO;
    let I_PolyToken;
    let I_PolymathRegistry;
    let P_GeneralTransferManagerFactory;
    let I_STRGetter;
    let I_STGetter;
    let I_STGetter2;
    let stGetter;
    let I_CappedSTOFactory;

  before(async () => {
    // Set up Polymath network

    polymathInstances = await setUpPolymathNetwork(admin, admin);
    [
      I_PolymathRegistry,
      I_PolyToken,
      I_FeatureRegistry,
      I_ModuleRegistry,
      I_ModuleRegistryProxy,
      I_MRProxied,
      I_GeneralTransferManagerFactory,
      I_STFactory,
      I_SecurityTokenRegistry,
      I_SecurityTokenRegistryProxy,
      I_STRProxied,
      I_STRGetter,
      I_STGetter
    ] = polymathInstances;

    // STEP 2: Deploy the GeneralDelegateManagerFactory
    [I_GeneralPermissionManagerFactory] = await deployGPMAndVerifyed(admin, I_MRProxied, 0);
    // STEP 3: Deploy the CappedSTOFactory
    [I_CappedSTOFactory] = await deployCappedSTOAndVerifyed(admin, I_MRProxied, cappedSTOSetupCost);
    // STEP 4(c): Deploy the LockUpVolumeRestrictionTMFactory
    [I_LockUpTransferManagerFactory] = await deployLockUpTMAndVerified(admin, I_MRProxied, 0);
    // STEP 5: Deploy the GeneralFractionalizerFactory
    [I_GeneralFractionalizerFactory] = await deployAndVerifyGfn(admin, I_MRProxied);

    // Printing all the contract addresses
    console.log(`
    --------------------- Polymath Network Smart Contracts: ---------------------
    PolymathRegistry:                  ${I_PolymathRegistry.address}
    SecurityTokenRegistryProxy:        ${I_SecurityTokenRegistryProxy.address}
    SecurityTokenRegistry:             ${I_SecurityTokenRegistry.address}
    ModuleRegistryProxy:               ${I_ModuleRegistryProxy.address}
    ModuleRegistry:                    ${I_ModuleRegistry.address}
    FeatureRegistry:                   ${I_FeatureRegistry.address}

    STFactory:                         ${I_STFactory.address}
    GeneralTransferManagerFactory:     ${I_GeneralTransferManagerFactory.address}
    GeneralPermissionManagerFactory:   ${I_GeneralPermissionManagerFactory.address}

    CappedSTOFactory:                  ${I_CappedSTOFactory.address}
    GeneralFractionalizerFactory:      ${I_GeneralFractionalizerFactory.address}
    -----------------------------------------------------------------------------
    `);

    // Deploy Sample NFT
    nft = await SampleNFT.new({ from: admin });
    await nft.safeMint(staker, tokenId.toString(), { from: admin });

    const tx1 = await I_STRProxied.registerNewTicker(
            admin,
            tokenSymbol,
            { from: admin }
        );
    console.log("RegisterTicker successful, tx hash:", tx1.tx);

    const tx = await I_STRProxied.generateNewSecurityToken(tokenName, tokenSymbol, tokenDetails, false, admin, 0, { from: admin });
    // Verify the successful generation of the security token
    for (let i = 0; i < tx.logs.length; i++) {
      console.log("LOGS: " + i);
      console.log(tx.logs[i]);
    }
    assert.equal(tx.logs[1].args._ticker, tokenSymbol, "SecurityToken doesn't get deployed");

    I_SecurityToken = await SecurityToken.at(tx.logs[1].args._securityTokenAddress);
    stGetter = await STGetter.at(I_SecurityToken.address);
    assert.equal(await stGetter.getTreasuryWallet.call(), admin, "Incorrect wallet set")
    const log = (await I_SecurityToken.getPastEvents('ModuleAdded', { filter: { transactionHash: tx.transactionHash } }))[0];

    // Verify that GeneralTransferManager module get added successfully or not
    assert.equal(log.args._types[0].toNumber(), transferManagerKey);
    assert.equal(web3.utils.toUtf8(log.args._name), "GeneralTransferManager");
    assert.equal(await I_SecurityToken.owner.call(), admin);
    assert.equal(await I_SecurityToken.initialized.call(), true);
  });

  async function initializeAndStake () {
    const fractionalizerAddress = await I_GeneralFractionalizerFactory.deploy("0x", { from: admin });
    console.log("GeneralFractionalizer deployed at:", fractionalizerAddress.logs[0].address);
    fractionalizer = GeneralFractionalizerProxy.at(fractionalizerAddress.logs[0].address);

    // Approve NFT transfer
    await nft.approve(fractionalizer.address, tokenId.toString(), { from: admin });

    // Execute stake
    await fractionalizer.stake(
      I_SecurityToken.address,
      admin,
      "0x0000000000000000000000000000000000000000", // Use POLY as payment token
      nft.address,
      tokenId.toString(),
      fractionsCount,
      fractionPrice,
      { from: admin }
    );
  }

  describe('Staking', () => {
    it('should stake NFT and issue fractions', async () => {
      await initializeAndStake();

      // Verify state
      assert.isTrue(await fractionalizer.staked(), "Staked flag not set");
      assert.equal(await fractionalizer.target(), nft.address, "Target NFT address incorrect");
      assert.equal(await fractionalizer.fractionsCount(), fractionsCount, "Fractions count incorrect");

      // Verify NFT transferred
      assert.equal(await nft.ownerOf(tokenId), fractionalizer.address, "NFT not transferred");

      // Verify fractions issued
      assert.equal(
        await securityToken.balanceOf(staker),
        fractionsCount,
        "Fractions not issued"
      );
    });
  });

  describe('Redeeming', () => {
    beforeEach(async () => {
      await initializeAndStake();
    });

    it('should redeem NFT with POLY payment', async () => {
      // Fund staker with POLY tokens
      const redeemAmount = await fractionalizer.redeemAmountOf(staker);
      await I_PolyToken.mint(staker, redeemAmount, { from: admin });
      await I_PolyToken.approve(fractionalizer.address, redeemAmount, { from: staker });

      const initialStakerBalance = await I_PolyToken.balanceOf(staker);

      // Redeem
      await fractionalizer.redeem(staker, { from: staker });

      // Verify state
      assert.isTrue(await fractionalizer.released(), "Released flag not set");

      // Verify NFT transferred
      assert.equal(await nft.ownerOf(tokenId), staker, "NFT not returned");

      // Verify fractions burned
      assert.equal(await securityToken.balanceOf(staker), 0, "Fractions not burned");

      // Verify payment
      const finalStakerBalance = await I_PolyToken.balanceOf(staker);
      assert.equal(
        initialStakerBalance.sub(finalStakerBalance).toString(),
        redeemAmount.toString(),
        "POLY payment incorrect"
      );
    });
  });

  describe('Claiming', () => {
    beforeEach(async () => {
      await initializeAndStake();

      // Redeem NFT
      const redeemAmount = await fractionalizer.redeemAmountOf(staker);
      await I_PolyToken.mint(staker, redeemAmount, { from: admin });
      await I_PolyToken.approve(fractionalizer.address, redeemAmount, { from: staker });
      await fractionalizer.redeem(staker, { from: staker });

      // Transfer fractions to claimant
      await securityToken.transfer(claimant, fractionsCount / 2, { from: staker });
    });

    it('should distribute POLY to claimants', async () => {
      const initialClaimantBalance = await I_PolyToken.balanceOf(claimant);
      const claimAmount = await fractionalizer.vaultBalanceOf(claimant);

      // Claim
      await fractionalizer.claim(claimant, { from: claimant });

      // Verify fractions burned
      assert.equal(await securityToken.balanceOf(claimant), 0, "Fractions not burned");

      // Verify payment received
      const finalClaimantBalance = await I_PolyToken.balanceOf(claimant);
      assert.equal(
        finalClaimantBalance.sub(initialClaimantBalance).toString(),
        claimAmount.toString(),
        "POLY claim amount incorrect"
      );
    });
  });
});
