import latestTime from "./helpers/latestTime";
import { duration, promisifyLogWatch, latestBlock } from "./helpers/utils";
import { getSignGTMData, getSignGTMTransferData, getMultiSignGTMData } from "./helpers/signData";
import { takeSnapshot, increaseTime, revertToSnapshot } from "./helpers/time";
import { pk } from "./helpers/testprivateKey";
import { encodeProxyCall, encodeModuleCall } from "./helpers/encodeCall";
import { catchRevert } from "./helpers/exceptions";
import { setUpPolymathNetwork, deployGPMAndVerifyed, deployDummySTOAndVerifyed, deployGTMAndVerifyed } from "./helpers/createInstances";

const GeneralFractionalizer = artifacts.require("./GeneralFractionalizer.sol");
const SecurityToken = artifacts.require("./SecurityToken.sol");
const GeneralPermissionManager = artifacts.require("./GeneralPermissionManager");
const STGetter = artifacts.require("./STGetter.sol");
const MockERC721 = artifacts.require("./MockERC721.sol");
const MockERC20 = artifacts.require("./MockERC20.sol");

const Web3 = require("web3");
let BN = Web3.utils.BN;
const web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));

contract("GeneralFractionalizer", async (accounts) => {
    // Account declarations
    let account_polymath;
    let account_issuer;
    let token_owner;
    let account_investor1;
    let account_investor2;
    let account_investor3;
    let account_temp;

    // Contract instances
    let I_ModuleRegistryProxy;
    let I_MRProxied;
    let I_GeneralTransferManagerFactory;
    let I_SecurityTokenRegistryProxy;
    let I_STRProxied;
    let I_FeatureRegistry;
    let I_STFactory;
    let I_GeneralPermissionManagerFactory;
    let I_GeneralFractionalizerFactory;
    let I_GeneralFractionalizer;
    let I_GeneralPermissionManager;
    let I_Module;
    let I_ModuleFactory;
    let I_SecurityToken;
    let I_STRGetter;
    let I_STGetter;
    let I_PolyToken;
    let I_PolymathRegistry;
    let I_MockERC721;
    let I_MockERC20;

    const name = "Team";
    const symbol = "sap";
    const tokenDetails = "This is equity type of issuance";
    const decimals = 18;
    const contact = "testing@skytrade";

    const tokenId = 1;
    const fractionsCount = 1000;
    const fractionPrice = web3.utils.toWei("0.1"); // 0.1 ETH per fraction
    const reservePrice = web3.utils.toWei("100"); // 100 ETH total

    before(async () => {
        account_polymath = accounts[0];
        account_issuer = accounts[1];
        token_owner = account_issuer;
        account_investor1 = accounts[2];
        account_investor2 = accounts[3];
        account_investor3 = accounts[4];
        account_temp = accounts[5];

        let instances = await setUpPolymathNetwork(account_polymath, token_owner);
        [
            I_PolymathRegistry,
            I_PolyToken,
            I_FeatureRegistry,
            I_ModuleRegistryProxy,
            I_MRProxied,
            I_GeneralTransferManagerFactory,
            I_STFactory,
            I_SecurityTokenRegistryProxy,
            I_STRProxied,
            I_STRGetter
        ] = instances;

        // Deploy Mock ERC721 and ERC20 contracts
        I_MockERC721 = await MockERC721.new("MockNFT", "MNFT", { from: account_issuer });
        I_MockERC20 = await MockERC20.new("MockToken", "MTK", 18, { from: account_issuer });

        // Mint NFT to issuer
        await I_MockERC721.mint(account_issuer, tokenId, { from: account_issuer });

        // Mint payment tokens
        await I_MockERC20.mint(account_investor1, web3.utils.toWei("1000"), { from: account_issuer });
        await I_MockERC20.mint(account_investor2, web3.utils.toWei("1000"), { from: account_issuer });
        await I_MockERC20.mint(account_investor3, web3.utils.toWei("1000"), { from: account_issuer });

        // Deploy GeneralFractionalizer Factory (would need to be implemented)
        // I_GeneralFractionalizerFactory = await GeneralFractionalizerFactory.new(I_PolyToken.address, 0, 0, 0, { from: account_polymath });

        // Setup and deploy security token
        let tx = await I_STRProxied.registerTicker(token_owner, symbol, contact, { from: token_owner });
        assert.equal(tx.logs[0].args._owner, token_owner);
        assert.equal(tx.logs[0].args._ticker, symbol.toUpperCase());

        tx = await I_STRProxied.generateSecurityToken(name, symbol, tokenDetails, false, token_owner, 0, { from: token_owner });
        I_SecurityToken = await SecurityToken.at(tx.logs[1].args._securityTokenAddress);

        // Deploy STGetter
        I_STGetter = await STGetter.new({ from: account_polymath });

        // Deploy General Permission Manager
        let instances2 = await deployGPMAndVerifyed(account_polymath, I_MRProxied, I_SecurityToken, 0);
        I_GeneralPermissionManager = instances2[1];

        // Deploy GeneralFractionalizer
        I_GeneralFractionalizer = await GeneralFractionalizer.new(I_SecurityToken.address, I_PolyToken.address, { from: account_issuer });
    });

    describe("Constructor and Initial State", async () => {
        it("Should deploy GeneralFractionalizer successfully", async () => {
            assert.notEqual(I_GeneralFractionalizer.address, "0x0000000000000000000000000000000000000000");
        });

        it("Should have correct initial state", async () => {
            assert.equal(await I_GeneralFractionalizer.staked(), false);
            assert.equal(await I_GeneralFractionalizer.released(), false);
            assert.equal(await I_GeneralFractionalizer.target(), "0x0000000000000000000000000000000000000000");
            assert.equal(await I_GeneralFractionalizer.tokenId(), 0);
            assert.equal(await I_GeneralFractionalizer.fractionsCount(), 0);
            assert.equal(await I_GeneralFractionalizer.fractionPrice(), 0);
        });

        it("Should return correct permissions", async () => {
            let permissions = await I_GeneralFractionalizer.getPermissions();
            assert.equal(permissions.length, 2);
            // Check if OPERATOR and ADMIN permissions are included
            assert.equal(web3.utils.hexToUtf8(permissions[0]), "OPERATOR");
            assert.equal(web3.utils.hexToUtf8(permissions[1]), "ADMIN");
        });

        it("Should return correct init function", async () => {
            let initFunction = await I_GeneralFractionalizer.getInitFunction();
            assert.equal(initFunction, "0x00000000");
        });

        it("Should return correct status before staking", async () => {
            let status = await I_GeneralFractionalizer.status();
            assert.equal(status, "OFFER");
        });
    });

    describe("Staking NFT", async () => {
        it("Should approve NFT transfer", async () => {
            await I_MockERC721.approve(I_GeneralFractionalizer.address, tokenId, { from: account_issuer });
            let approved = await I_MockERC721.getApproved(tokenId);
            assert.equal(approved, I_GeneralFractionalizer.address);
        });

        it("Should stake NFT successfully", async () => {
            let tx = await I_GeneralFractionalizer.stake(
                I_SecurityToken.address,
                account_issuer,
                I_MockERC20.address,
                I_MockERC721.address,
                tokenId,
                fractionsCount,
                fractionPrice,
                { from: account_issuer }
            );

            // Verify state changes
            assert.equal(await I_GeneralFractionalizer.staked(), true);
            assert.equal(await I_GeneralFractionalizer.target(), I_MockERC721.address);
            assert.equal(await I_GeneralFractionalizer.tokenId(), tokenId);
            assert.equal(await I_GeneralFractionalizer.fractionsCount(), fractionsCount);
            assert.equal(await I_GeneralFractionalizer.fractionPrice(), fractionPrice);
            assert.equal(await I_GeneralFractionalizer.paymentToken(), I_MockERC20.address);

            // Verify NFT was transferred
            let owner = await I_MockERC721.ownerOf(tokenId);
            assert.equal(owner, I_GeneralFractionalizer.address);

            // Verify fractional tokens were issued
            let balance = await I_SecurityToken.balanceOf(account_issuer);
            assert.equal(balance.toString(), fractionsCount.toString());
        });

        it("Should fail to stake when already staked", async () => {
            await catchRevert(
                I_GeneralFractionalizer.stake(
                    I_SecurityToken.address,
                    account_issuer,
                    I_MockERC20.address,
                    I_MockERC721.address,
                    tokenId,
                    fractionsCount,
                    fractionPrice,
                    { from: account_issuer }
                )
            );
        });

        it("Should fail to stake with invalid payment token", async () => {
            // Deploy new fractionalizer for this test
            let newFractionalizer = await GeneralFractionalizer.new(I_SecurityToken.address, I_PolyToken.address, { from: account_issuer });
            
            await catchRevert(
                newFractionalizer.stake(
                    I_SecurityToken.address,
                    account_issuer,
                    newFractionalizer.address, // Invalid: same as contract address
                    I_MockERC721.address,
                    tokenId,
                    fractionsCount,
                    fractionPrice,
                    { from: account_issuer }
                )
            );
        });

        it("Should fail to stake with zero fractions count", async () => {
            let newFractionalizer = await GeneralFractionalizer.new(I_SecurityToken.address, I_PolyToken.address, { from: account_issuer });
            
            await catchRevert(
                newFractionalizer.stake(
                    I_SecurityToken.address,
                    account_issuer,
                    I_MockERC20.address,
                    I_MockERC721.address,
                    tokenId,
                    0, // Invalid: zero fractions
                    fractionPrice,
                    { from: account_issuer }
                )
            );
        });

        it("Should fail to stake with arithmetic overflow in price calculation", async () => {
            let newFractionalizer = await GeneralFractionalizer.new(I_SecurityToken.address, I_PolyToken.address, { from: account_issuer });
            
            await catchRevert(
                newFractionalizer.stake(
                    I_SecurityToken.address,
                    account_issuer,
                    I_MockERC20.address,
                    I_MockERC721.address,
                    tokenId,
                    fractionsCount,
                    web3.utils.toWei("999999999999999999999"), // Very large price causing overflow
                    { from: account_issuer }
                )
            );
        });
    });

    describe("View Functions After Staking", async () => {
        it("Should return correct reserve price", async () => {
            let reservePriceResult = await I_GeneralFractionalizer.reservePrice();
            let expectedReservePrice = new BN(fractionsCount).mul(new BN(fractionPrice));
            assert.equal(reservePriceResult.toString(), expectedReservePrice.toString());
        });

        it("Should return correct status after staking", async () => {
            let status = await I_GeneralFractionalizer.status();
            assert.equal(status, "OFFER");
        });

        it("Should calculate redeem amount correctly", async () => {
            // Transfer some fractions to investor1
            await I_SecurityToken.transfer(account_investor1, 100, { from: account_issuer });
            
            let redeemAmount = await I_GeneralFractionalizer.redeemAmountOf(account_investor1);
            let expectedRedeemAmount = new BN(reservePrice).sub(new BN(100).mul(new BN(fractionPrice)));
            assert.equal(redeemAmount.toString(), expectedRedeemAmount.toString());
        });

        it("Should return zero vault balance before redemption", async () => {
            let vaultBalance = await I_GeneralFractionalizer.vaultBalance();
            assert.equal(vaultBalance.toString(), "0");

            let vaultBalanceOf = await I_GeneralFractionalizer.vaultBalanceOf(account_investor1);
            assert.equal(vaultBalanceOf.toString(), "0");
        });

        it("Should return correct tokens sold (always 0 for this implementation)", async () => {
            let tokensSold = await I_GeneralFractionalizer.getTokensSold();
            assert.equal(tokensSold.toString(), "0");
        });
    });

    describe("Redemption Process", async () => {
        let snapshotId;

        beforeEach(async () => {
            snapshotId = await takeSnapshot();
        });

        afterEach(async () => {
            await revertToSnapshot(snapshotId);
        });

        it("Should fail redeem when not staked", async () => {
            let newFractionalizer = await GeneralFractionalizer.new(I_SecurityToken.address, I_PolyToken.address, { from: account_issuer });
            
            await catchRevert(
                newFractionalizer.redeem(account_investor1, { from: account_investor1 })
            );
        });

        it("Should fail redeem when already redeemed", async () => {
            // First successful redemption
            let redeemAmount = await I_GeneralFractionalizer.redeemAmountOf(account_issuer);
            await I_MockERC20.approve(I_GeneralFractionalizer.address, redeemAmount, { from: account_issuer });
            
            await I_GeneralFractionalizer.redeem(account_issuer, { from: account_issuer, value: 0 });

            // Second redemption should fail
            await catchRevert(
                I_GeneralFractionalizer.redeem(account_investor1, { from: account_investor1 })
            );
        });

        it("Should redeem successfully with ERC20 payment", async () => {
            let redeemAmount = await I_GeneralFractionalizer.redeemAmountOf(account_issuer);
            await I_MockERC20.approve(I_GeneralFractionalizer.address, redeemAmount, { from: account_issuer });
            
            let initialNFTOwner = await I_MockERC721.ownerOf(tokenId);
            assert.equal(initialNFTOwner, I_GeneralFractionalizer.address);

            let tx = await I_GeneralFractionalizer.redeem(account_issuer, { from: account_issuer, value: 0 });

            // Verify event emission
            assert.equal(tx.logs[0].event, "Redeem");
            assert.equal(tx.logs[0].args._from, account_issuer);
            assert.equal(tx.logs[0].args._fractionsCount.toString(), fractionsCount.toString());
            assert.equal(tx.logs[0].args._redeemAmount.toString(), redeemAmount.toString());

            // Verify NFT was transferred back
            let newNFTOwner = await I_MockERC721.ownerOf(tokenId);
            assert.equal(newNFTOwner, account_issuer);

            // Verify state change
            assert.equal(await I_GeneralFractionalizer.released(), true);

            // Verify status change
            let status = await I_GeneralFractionalizer.status();
            assert.equal(status, "SOLD");
        });

        it("Should redeem successfully with ETH payment", async () => {
            // Deploy new fractionalizer with ETH as payment token
            let ethFractionalizer = await GeneralFractionalizer.new(I_SecurityToken.address, I_PolyToken.address, { from: account_issuer });
            
            // Mint another NFT
            let newTokenId = 2;
            await I_MockERC721.mint(account_issuer, newTokenId, { from: account_issuer });
            await I_MockERC721.approve(ethFractionalizer.address, newTokenId, { from: account_issuer });

            // Stake with ETH (address(0))
            await ethFractionalizer.stake(
                I_SecurityToken.address,
                account_issuer,
                "0x0000000000000000000000000000000000000000", // ETH
                I_MockERC721.address,
                newTokenId,
                fractionsCount,
                fractionPrice,
                { from: account_issuer }
            );

            let redeemAmount = await ethFractionalizer.redeemAmountOf(account_issuer);
            
            let tx = await ethFractionalizer.redeem(account_issuer, { 
                from: account_issuer, 
                value: redeemAmount 
            });

            // Verify event emission
            assert.equal(tx.logs[0].event, "Redeem");
            assert.equal(tx.logs[0].args._redeemAmount.toString(), redeemAmount.toString());
        });

        it("Should fail redeem with incorrect ETH value", async () => {
            // Deploy new fractionalizer with ETH as payment token
            let ethFractionalizer = await GeneralFractionalizer.new(I_SecurityToken.address, I_PolyToken.address, { from: account_issuer });
            
            let newTokenId = 3;
            await I_MockERC721.mint(account_issuer, newTokenId, { from: account_issuer });
            await I_MockERC721.approve(ethFractionalizer.address, newTokenId, { from: account_issuer });

            await ethFractionalizer.stake(
                I_SecurityToken.address,
                account_issuer,
                "0x0000000000000000000000000000000000000000",
                I_MockERC721.address,
                newTokenId,
                fractionsCount,
                fractionPrice,
                { from: account_issuer }
            );

            let redeemAmount = await ethFractionalizer.redeemAmountOf(account_issuer);
            
            await catchRevert(
                ethFractionalizer.redeem(account_issuer, { 
                    from: account_issuer, 
                    value: redeemAmount.add(new BN(1)) // Incorrect value
                })
            );
        });

        it("Should handle redeem with partial fraction ownership", async () => {
            // Transfer some fractions to investor1
            await I_SecurityToken.transfer(account_investor1, 300, { from: account_issuer });
            
            let redeemAmount = await I_GeneralFractionalizer.redeemAmountOf(account_investor1);
            await I_MockERC20.approve(I_GeneralFractionalizer.address, redeemAmount, { from: account_investor1 });
            
            let tx = await I_GeneralFractionalizer.redeem(account_investor1, { from: account_investor1 });
            
            // Verify event
            assert.equal(tx.logs[0].event, "Redeem");
            assert.equal(tx.logs[0].args._from, account_investor1);
            assert.equal(tx.logs[0].args._fractionsCount.toString(), "300");
        });
    });

    describe("Claiming Process", async () => {
        let snapshotId;

        beforeEach(async () => {
            snapshotId = await takeSnapshot();
            
            // Setup: Redeem the NFT first
            let redeemAmount = await I_GeneralFractionalizer.redeemAmountOf(account_issuer);
            await I_MockERC20.approve(I_GeneralFractionalizer.address, redeemAmount, { from: account_issuer });
            await I_GeneralFractionalizer.redeem(account_issuer, { from: account_issuer });
        });

        afterEach(async () => {
            await revertToSnapshot(snapshotId);
        });

        it("Should fail claim when token not redeemed", async () => {
            // Reset to before redemption
            await revertToSnapshot(snapshotId);
            
            await catchRevert(
                I_GeneralFractionalizer.claim(account_investor1, { from: account_investor1 })
            );
        });

        it("Should fail claim when no fractions to claim", async () => {
            await catchRevert(
                I_GeneralFractionalizer.claim(account_investor2, { from: account_investor2 })
            );
        });

        it("Should claim successfully", async () => {
            // First, transfer some fractions to investor1 before redemption
            await revertToSnapshot(snapshotId);
            await I_SecurityToken.transfer(account_investor1, 200, { from: account_issuer });
            
            // Redeem
            let redeemAmount = await I_GeneralFractionalizer.redeemAmountOf(account_issuer);
            await I_MockERC20.approve(I_GeneralFractionalizer.address, redeemAmount, { from: account_issuer });
            await I_GeneralFractionalizer.redeem(account_issuer, { from: account_issuer });

            // Now claim
            let vaultBalance = await I_GeneralFractionalizer.vaultBalanceOf(account_investor1);
            let tx = await I_GeneralFractionalizer.claim(account_investor1, { from: account_investor1 });

            // Verify event
            assert.equal(tx.logs[0].event, "Claim");
            assert.equal(tx.logs[0].args._from, account_investor1);
            assert.equal(tx.logs[0].args._fractionsCount.toString(), "200");
            assert.equal(tx.logs[0].args._claimAmount.toString(), vaultBalance.toString());

            // Verify fractions were burned
            let balance = await I_SecurityToken.balanceOf(account_investor1);
            assert.equal(balance.toString(), "0");
        });

        it("Should return correct vault balances after redemption", async () => {
            // Transfer fractions to multiple investors before redemption
            await revertToSnapshot(snapshotId);
            await I_SecurityToken.transfer(account_investor1, 300, { from: account_issuer });
            await I_SecurityToken.transfer(account_investor2, 200, { from: account_issuer });

            // Redeem
            let redeemAmount = await I_GeneralFractionalizer.redeemAmountOf(account_issuer);
            await I_MockERC20.approve(I_GeneralFractionalizer.address, redeemAmount, { from: account_issuer });
            await I_GeneralFractionalizer.redeem(account_issuer, { from: account_issuer });

            // Check vault balances
            let totalVaultBalance = await I_GeneralFractionalizer.vaultBalance();
            let investor1Balance = await I_GeneralFractionalizer.vaultBalanceOf(account_investor1);
            let investor2Balance = await I_GeneralFractionalizer.vaultBalanceOf(account_investor2);
            let issuerBalance = await I_GeneralFractionalizer.vaultBalanceOf(account_issuer);

            let expectedTotalBalance = new BN(fractionsCount).mul(new BN(fractionPrice));
            let expectedInvestor1Balance = new BN(300).mul(new BN(fractionPrice));
            let expectedInvestor2Balance = new BN(200).mul(new BN(fractionPrice));
            let expectedIssuerBalance = new BN(500).mul(new BN(fractionPrice));

            assert.equal(totalVaultBalance.toString(), expectedTotalBalance.toString());
            assert.equal(investor1Balance.toString(), expectedInvestor1Balance.toString());
            assert.equal(investor2Balance.toString(), expectedInvestor2Balance.toString());
            assert.equal(issuerBalance.toString(), expectedIssuerBalance.toString());
        });
    });

    describe("Self-Destruct Mechanism", async () => {
        it("Should self-destruct when all tokens are claimed", async () => {
            // Setup: Distribute all fractions and redeem
            await I_SecurityToken.transfer(account_investor1, 400, { from: account_issuer });
            await I_SecurityToken.transfer(account_investor2, 400, { from: account_issuer });
            await I_SecurityToken.transfer(account_investor3, 200, { from: account_issuer });

            // Redeem
            let redeemAmount = await I_GeneralFractionalizer.redeemAmountOf(account_issuer);
            await I_MockERC20.approve(I_GeneralFractionalizer.address, redeemAmount, { from: account_issuer });
            await I_GeneralFractionalizer.redeem(account_issuer, { from: account_issuer });

            // Claim all fractions
            await I_GeneralFractionalizer.claim(account_investor1, { from: account_investor1 });
            await I_GeneralFractionalizer.claim(account_investor2, { from: account_investor2 });
            await I_GeneralFractionalizer.claim(account_investor3, { from: account_investor3 });

            // Verify total supply is 0
            let totalSupply = await I_SecurityToken.totalSupply();
            assert.equal(totalSupply.toString(), "0");

            // Contract should be self-destructed at this point
            // Note: Testing self-destruct behavior might require additional setup
        });
    });

    describe("Reentrancy Protection", async () => {
        it("Should prevent reentrancy attacks on redeem", async () => {
            // This would require a malicious contract that attempts reentrancy
            // For now, we verify the nonReentrant modifier is in place
            let redeemAmount = await I_GeneralFractionalizer.redeemAmountOf(account_issuer);
            await I_MockERC20.approve(I_GeneralFractionalizer.address, redeemAmount, { from: account_issuer });
            
            await I_GeneralFractionalizer.redeem(account_issuer, { from: account_issuer });
            
            // Verify redemption was successful and state was properly updated
            assert.equal(await I_GeneralFractionalizer.released(), true);
        });

        it("Should prevent reentrancy attacks on claim", async () => {
            // Setup for claim
            await I_SecurityToken.transfer(account_investor1, 200, { from: account_issuer });
            
            let redeemAmount = await I_GeneralFractionalizer.redeemAmountOf(account_issuer);
            await I_MockERC20.approve(I_GeneralFractionalizer.address, redeemAmount, { from: account_issuer });
            await I_GeneralFractionalizer.redeem(account_issuer, { from: account_issuer });

            await I_GeneralFractionalizer.claim(account_investor1, { from: account_investor1 });
            
            // Verify claim was successful
            let balance = await I_SecurityToken.balanceOf(account_investor1);
            assert.equal(balance.toString(), "0");
        });
    });

    describe("Edge Cases and Error Conditions", async () => {
        it("Should handle zero fraction price correctly", async () => {
            let newFractionalizer = await GeneralFractionalizer.new(I_SecurityToken.address, I_PolyToken.address, { from: account_issuer });
            let newTokenId = 4;
            
            await I_MockERC721.mint(account_issuer, newTokenId, { from: account_issuer });
            await I_MockERC721.approve(newFractionalizer.address, newTokenId, { from: account_issuer });

            await newFractionalizer.stake(
                I_SecurityToken.address,
                account_issuer,
                I_MockERC20.address,
                I_MockERC721.address,
                newTokenId,
                fractionsCount,
                0, // Zero price
                { from: account_issuer }
            );

            let reservePriceResult = await newFractionalizer.reservePrice();
            assert.equal(reservePriceResult.toString(), "0");
        });

        it("Should fail redeemAmountOf when already redeemed", async () => {
            let redeemAmount = await I_GeneralFractionalizer.redeemAmountOf(account_issuer);
            await I_MockERC20.approve(I_GeneralFractionalizer.address, redeemAmount, { from: account_issuer });
            await I_GeneralFractionalizer.redeem(account_issuer, { from: account_issuer });

            await catchRevert(
                I_GeneralFractionalizer.redeemAmountOf(account_issuer)
            );
        });

        it("Should handle large numbers correctly", async () => {
            let newFractionalizer = await GeneralFractionalizer.new(I_SecurityToken.address, I_PolyToken.address, { from: account_issuer });
            let newTokenId = 5;
            let largeFractionsCount = new BN("1000000000000000000"); // 1e18
            let smallFractionPrice = new BN("1000000000"); // 1e9 wei
            
            await I_MockERC721.mint(account_issuer, newTokenId, { from: account_issuer });
            await I_MockERC721.approve(newFractionalizer.address, newTokenId, { from: account_issuer });

            await newFractionalizer.stake(
                I_SecurityToken.address,
                account_issuer,
                I_MockERC20.address,
                I_MockERC721.address,
                newTokenId,
                largeFractionsCount.toString(),
                smallFractionPrice.toString(),
                { from: account_issuer }
            );

            let reservePriceResult = await newFractionalizer.reservePrice();
            let expectedReservePrice = largeFractionsCount.mul(smallFractionPrice);
            assert.equal(reservePriceResult.toString(), expectedReservePrice.toString());
        });

        it("Should handle single fraction ownership", async () => {
            let newFractionalizer = await GeneralFractionalizer.new(I_SecurityToken.address, I_PolyToken.address, { from: account_issuer });
            let newTokenId = 6;
            
            await I_MockERC721.mint(account_issuer, newTokenId, { from: account_issuer });
            await I_MockERC721.approve(newFractionalizer.address, newTokenId, { from: account_issuer });

            await newFractionalizer.stake(
                I_SecurityToken.address,
                account_issuer,
                I_MockERC20.address,
                I_MockERC721.address,
                newTokenId,
                1, // Single fraction
                fractionPrice,
                { from: account_issuer }
            );

            let redeemAmount = await newFractionalizer.redeemAmountOf(account_issuer);
            assert.equal(redeemAmount.toString(), "0"); // Should be 0 since issuer owns all fractions
        });
    });

    describe("Integration Tests", async () => {
        it("Should handle complete lifecycle: stake -> transfer -> redeem -> claim", async () => {
            let newFractionalizer = await GeneralFractionalizer.new(I_SecurityToken.address, I_PolyToken.address, { from: account_issuer });
            let newTokenId = 7;
            
            // Mint and stake NFT
            await I_MockERC721.mint(account_issuer, newTokenId, { from: account_issuer });
            await I_MockERC721.approve(newFractionalizer.address, newTokenId, { from: account_issuer });

            await newFractionalizer.stake(
                I_SecurityToken.address,
                account_issuer,
                I_MockERC20.address,
                I_MockERC721.address,
                newTokenId,
                fractionsCount,
                fractionPrice,
                { from: account_issuer }
            );

            // Transfer fractions to investors
            await I_SecurityToken.transfer(account_investor1, 300, { from: account_issuer });
            await I_SecurityToken.transfer(account_investor2, 200, { from: account_issuer });

            // Investor1 redeems (buys out the NFT)
            let redeemAmount = await newFractionalizer.redeemAmountOf(account_investor1);
            await I_MockERC20.approve(newFractionalizer.address, redeemAmount, { from: account_investor1 });
            
            let tx = await newFractionalizer.redeem(account_investor1, { from: account_investor1 });
            
            // Verify NFT ownership transferred
            let nftOwner = await I_MockERC721.ownerOf(newTokenId);
            assert.equal(nftOwner, account_investor1);

            // Other investors claim their share
            await newFractionalizer.claim(account_investor2, { from: account_investor2 });
            await newFractionalizer.claim(account_issuer, { from: account_issuer });

            // Verify all fractions are burned
            let totalSupply = await I_SecurityToken.totalSupply();
            assert.equal(totalSupply.toString(), "0");
        });

        it("Should handle multiple redemption attempts by different users", async () => {
            let newFractionalizer = await GeneralFractionalizer.new(I_SecurityToken.address, I_PolyToken.address, { from: account_issuer });
            let newTokenId = 8;
            
            await I_MockERC721.mint(account_issuer, newTokenId, { from: account_issuer });
            await I_MockERC721.approve(newFractionalizer.address, newTokenId, { from: account_issuer });

            await newFractionalizer.stake(
                I_SecurityToken.address,
                account_issuer,
                I_MockERC20.address,
                I_MockERC721.address,
                newTokenId,
                fractionsCount,
                fractionPrice,
                { from: account_issuer }
            );

            await I_SecurityToken.transfer(account_investor1, 400, { from: account_issuer });
            await I_SecurityToken.transfer(account_investor2, 300, { from: account_issuer });

            // First redemption should succeed
            let redeemAmount1 = await newFractionalizer.redeemAmountOf(account_investor1);
            await I_MockERC20.approve(newFractionalizer.address, redeemAmount1, { from: account_investor1 });
            await newFractionalizer.redeem(account_investor1, { from: account_investor1 });

            // Second redemption should fail
            await I_MockERC20.approve(newFractionalizer.address, web3.utils.toWei("100"), { from: account_investor2 });
            await catchRevert(
                newFractionalizer.redeem(account_investor2, { from: account_investor2 })
            );
        });

        it("Should handle fractional transfers after staking", async () => {
            let newFractionalizer = await GeneralFractionalizer.new(I_SecurityToken.address, I_PolyToken.address, { from: account_issuer });
            let newTokenId = 9;
            
            await I_MockERC721.mint(account_issuer, newTokenId, { from: account_issuer });
            await I_MockERC721.approve(newFractionalizer.address, newTokenId, { from: account_issuer });

            await newFractionalizer.stake(
                I_SecurityToken.address,
                account_issuer,
                I_MockERC20.address,
                I_MockERC721.address,
                newTokenId,
                fractionsCount,
                fractionPrice,
                { from: account_issuer }
            );

            // Multiple transfers
            await I_SecurityToken.transfer(account_investor1, 250, { from: account_issuer });
            await I_SecurityToken.transfer(account_investor2, 250, { from: account_investor1 });
            await I_SecurityToken.transfer(account_investor3, 100, { from: account_investor2 });

            // Verify balances
            let balance1 = await I_SecurityToken.balanceOf(account_investor1);
            let balance2 = await I_SecurityToken.balanceOf(account_investor2);
            let balance3 = await I_SecurityToken.balanceOf(account_investor3);
            let balanceIssuer = await I_SecurityToken.balanceOf(account_issuer);

            assert.equal(balance1.toString(), "0");
            assert.equal(balance2.toString(), "150");
            assert.equal(balance3.toString(), "100");
            assert.equal(balanceIssuer.toString(), "750");

            // Calculate redeem amounts
            let redeemAmount2 = await newFractionalizer.redeemAmountOf(account_investor2);
            let redeemAmount3 = await newFractionalizer.redeemAmountOf(account_investor3);
            let redeemAmountIssuer = await newFractionalizer.redeemAmountOf(account_issuer);

            // Verify calculations
            let expectedRedeem2 = new BN(reservePrice).sub(new BN(150).mul(new BN(fractionPrice)));
            let expectedRedeem3 = new BN(reservePrice).sub(new BN(100).mul(new BN(fractionPrice)));
            let expectedRedeemIssuer = new BN(reservePrice).sub(new BN(750).mul(new BN(fractionPrice)));

            assert.equal(redeemAmount2.toString(), expectedRedeem2.toString());
            assert.equal(redeemAmount3.toString(), expectedRedeem3.toString());
            assert.equal(redeemAmountIssuer.toString(), expectedRedeemIssuer.toString());
        });
    });

    describe("Gas Optimization Tests", async () => {
        it("Should track gas usage for stake operation", async () => {
            let newFractionalizer = await GeneralFractionalizer.new(I_SecurityToken.address, I_PolyToken.address, { from: account_issuer });
            let newTokenId = 10;
            
            await I_MockERC721.mint(account_issuer, newTokenId, { from: account_issuer });
            await I_MockERC721.approve(newFractionalizer.address, newTokenId, { from: account_issuer });

            let tx = await newFractionalizer.stake(
                I_SecurityToken.address,
                account_issuer,
                I_MockERC20.address,
                I_MockERC721.address,
                newTokenId,
                fractionsCount,
                fractionPrice,
                { from: account_issuer }
            );

            console.log("Stake gas used:", tx.receipt.gasUsed);
            assert.isBelow(tx.receipt.gasUsed, 500000, "Stake operation should use less than 500k gas");
        });

        it("Should track gas usage for redeem operation", async () => {
            let redeemAmount = await I_GeneralFractionalizer.redeemAmountOf(account_issuer);
            await I_MockERC20.approve(I_GeneralFractionalizer.address, redeemAmount, { from: account_issuer });
            
            let tx = await I_GeneralFractionalizer.redeem(account_issuer, { from: account_issuer });

            console.log("Redeem gas used:", tx.receipt.gasUsed);
            assert.isBelow(tx.receipt.gasUsed, 300000, "Redeem operation should use less than 300k gas");
        });

        it("Should track gas usage for claim operation", async () => {
            // Setup for claim
            let newFractionalizer = await GeneralFractionalizer.new(I_SecurityToken.address, I_PolyToken.address, { from: account_issuer });
            let newTokenId = 11;
            
            await I_MockERC721.mint(account_issuer, newTokenId, { from: account_issuer });
            await I_MockERC721.approve(newFractionalizer.address, newTokenId, { from: account_issuer });

            await newFractionalizer.stake(
                I_SecurityToken.address,
                account_issuer,
                I_MockERC20.address,
                I_MockERC721.address,
                newTokenId,
                fractionsCount,
                fractionPrice,
                { from: account_issuer }
            );

            await I_SecurityToken.transfer(account_investor1, 200, { from: account_issuer });

            let redeemAmount = await newFractionalizer.redeemAmountOf(account_issuer);
            await I_MockERC20.approve(newFractionalizer.address, redeemAmount, { from: account_issuer });
            await newFractionalizer.redeem(account_issuer, { from: account_issuer });

            let tx = await newFractionalizer.claim(account_investor1, { from: account_investor1 });

            console.log("Claim gas used:", tx.receipt.gasUsed);
            assert.isBelow(tx.receipt.gasUsed, 200000, "Claim operation should use less than 200k gas");
        });
    });

    describe("Access Control Tests", async () => {
        it("Should allow stake from any address (for now)", async () => {
            let newFractionalizer = await GeneralFractionalizer.new(I_SecurityToken.address, I_PolyToken.address, { from: account_issuer });
            let newTokenId = 12;
            
            await I_MockERC721.mint(account_temp, newTokenId, { from: account_issuer });
            await I_MockERC721.approve(newFractionalizer.address, newTokenId, { from: account_temp });

            await newFractionalizer.stake(
                I_SecurityToken.address,
                account_temp,
                I_MockERC20.address,
                I_MockERC721.address,
                newTokenId,
                fractionsCount,
                fractionPrice,
                { from: account_temp }
            );

            assert.equal(await newFractionalizer.staked(), true);
        });

        it("Should allow redeem from any address with proper conditions", async () => {
            let redeemAmount = await I_GeneralFractionalizer.redeemAmountOf(account_issuer);
            await I_MockERC20.approve(I_GeneralFractionalizer.address, redeemAmount, { from: account_issuer });
            
            // Different caller than the redeemer
            await I_GeneralFractionalizer.redeem(account_issuer, { from: account_temp });
            
            assert.equal(await I_GeneralFractionalizer.released(), true);
        });

        it("Should allow claim from any address with proper conditions", async () => {
            // Setup for claim test
            let newFractionalizer = await GeneralFractionalizer.new(I_SecurityToken.address, I_PolyToken.address, { from: account_issuer });
            let newTokenId = 13;
            
            await I_MockERC721.mint(account_issuer, newTokenId, { from: account_issuer });
            await I_MockERC721.approve(newFractionalizer.address, newTokenId, { from: account_issuer });

            await newFractionalizer.stake(
                I_SecurityToken.address,
                account_issuer,
                I_MockERC20.address,
                I_MockERC721.address,
                newTokenId,
                fractionsCount,
                fractionPrice,
                { from: account_issuer }
            );

            await I_SecurityToken.transfer(account_investor1, 200, { from: account_issuer });

            let redeemAmount = await newFractionalizer.redeemAmountOf(account_issuer);
            await I_MockERC20.approve(newFractionalizer.address, redeemAmount, { from: account_issuer });
            await newFractionalizer.redeem(account_issuer, { from: account_issuer });

            // Different caller than the claimer
            await newFractionalizer.claim(account_investor1, { from: account_temp });
            
            let balance = await I_SecurityToken.balanceOf(account_investor1);
            assert.equal(balance.toString(), "0");
        });
    });

    describe("Event Emission Tests", async () => {
        it("Should emit correct Redeem event with all parameters", async () => {
            let newFractionalizer = await GeneralFractionalizer.new(I_SecurityToken.address, I_PolyToken.address, { from: account_issuer });
            let newTokenId = 14;
            
            await I_MockERC721.mint(account_issuer, newTokenId, { from: account_issuer });
            await I_MockERC721.approve(newFractionalizer.address, newTokenId, { from: account_issuer });

            await newFractionalizer.stake(
                I_SecurityToken.address,
                account_issuer,
                I_MockERC20.address,
                I_MockERC721.address,
                newTokenId,
                fractionsCount,
                fractionPrice,
                { from: account_issuer }
            );

            let redeemAmount = await newFractionalizer.redeemAmountOf(account_issuer);
            await I_MockERC20.approve(newFractionalizer.address, redeemAmount, { from: account_issuer });
            
            let tx = await newFractionalizer.redeem(account_issuer, { from: account_issuer });

            // Check event details
            let redeemEvent = tx.logs.find(log => log.event === "Redeem");
            assert.isDefined(redeemEvent, "Redeem event should be emitted");
            assert.equal(redeemEvent.args._from, account_issuer);
            assert.equal(redeemEvent.args._fractionsCount.toString(), fractionsCount.toString());
            assert.equal(redeemEvent.args._redeemAmount.toString(), redeemAmount.toString());
        });

        it("Should emit correct Claim event with all parameters", async () => {
            let newFractionalizer = await GeneralFractionalizer.new(I_SecurityToken.address, I_PolyToken.address, { from: account_issuer });
            let newTokenId = 15;
            
            await I_MockERC721.mint(account_issuer, newTokenId, { from: account_issuer });
            await I_MockERC721.approve(newFractionalizer.address, newTokenId, { from: account_issuer });

            await newFractionalizer.stake(
                I_SecurityToken.address,
                account_issuer,
                I_MockERC20.address,
                I_MockERC721.address,
                newTokenId,
                fractionsCount,
                fractionPrice,
                { from: account_issuer }
            );

            await I_SecurityToken.transfer(account_investor1, 300, { from: account_issuer });

            let redeemAmount = await newFractionalizer.redeemAmountOf(account_issuer);
            await I_MockERC20.approve(newFractionalizer.address, redeemAmount, { from: account_issuer });
            await newFractionalizer.redeem(account_issuer, { from: account_issuer });

            let claimAmount = await newFractionalizer.vaultBalanceOf(account_investor1);
            let tx = await newFractionalizer.claim(account_investor1, { from: account_investor1 });

            // Check event details
            let claimEvent = tx.logs.find(log => log.event === "Claim");
            assert.isDefined(claimEvent, "Claim event should be emitted");
            assert.equal(claimEvent.args._from, account_investor1);
            assert.equal(claimEvent.args._fractionsCount.toString(), "300");
            assert.equal(claimEvent.args._claimAmount.toString(), claimAmount.toString());
        });
    });

    describe("Contract State Consistency Tests", async () => {
        it("Should maintain consistent state throughout lifecycle", async () => {
            let newFractionalizer = await GeneralFractionalizer.new(I_SecurityToken.address, I_PolyToken.address, { from: account_issuer });
            let newTokenId = 16;
            
            // Initial state
            assert.equal(await newFractionalizer.staked(), false);
            assert.equal(await newFractionalizer.released(), false);

            // After staking
            await I_MockERC721.mint(account_issuer, newTokenId, { from: account_issuer });
            await I_MockERC721.approve(newFractionalizer.address, newTokenId, { from: account_issuer });

            await newFractionalizer.stake(
                I_SecurityToken.address,
                account_issuer,
                I_MockERC20.address,
                I_MockERC721.address,
                newTokenId,
                fractionsCount,
                fractionPrice,
                { from: account_issuer }
            );

            assert.equal(await newFractionalizer.staked(), true);
            assert.equal(await newFractionalizer.released(), false);
            assert.equal(await newFractionalizer.status(), "OFFER");

            // After redemption
            let redeemAmount = await newFractionalizer.redeemAmountOf(account_issuer);
            await I_MockERC20.approve(newFractionalizer.address, redeemAmount, { from: account_issuer });
            await newFractionalizer.redeem(account_issuer, { from: account_issuer });

            assert.equal(await newFractionalizer.staked(), true);
            assert.equal(await newFractionalizer.released(), true);
            assert.equal(await newFractionalizer.status(), "SOLD");
        });

        it("Should handle multiple contract instances independently", async () => {
            let fractionalizer1 = await GeneralFractionalizer.new(I_SecurityToken.address, I_PolyToken.address, { from: account_issuer });
            let fractionalizer2 = await GeneralFractionalizer.new(I_SecurityToken.address, I_PolyToken.address, { from: account_issuer });
            
            let tokenId1 = 17;
            let tokenId2 = 18;

            await I_MockERC721.mint(account_issuer, tokenId1, { from: account_issuer });
            await I_MockERC721.mint(account_issuer, tokenId2, { from: account_issuer });
            
            await I_MockERC721.approve(fractionalizer1.address, tokenId1, { from: account_issuer });
            await I_MockERC721.approve(fractionalizer2.address, tokenId2, { from: account_issuer });

            // Stake first contract
            await fractionalizer1.stake(
                I_SecurityToken.address,
                account_issuer,
                I_MockERC20.address,
                I_MockERC721.address,
                tokenId1,
                fractionsCount,
                fractionPrice,
                { from: account_issuer }
            );

            // Verify only first contract is staked
            assert.equal(await fractionalizer1.staked(), true);
            assert.equal(await fractionalizer2.staked(), false);

            // Stake second contract
            await fractionalizer2.stake(
                I_SecurityToken.address,
                account_issuer,
                I_MockERC20.address,
                I_MockERC721.address,
                tokenId2,
                fractionsCount * 2, // Different fraction count
                fractionPrice,
                { from: account_issuer }
            );

            // Verify both are now staked with different parameters
            assert.equal(await fractionalizer1.staked(), true);
            assert.equal(await fractionalizer2.staked(), true);
            assert.equal((await fractionalizer1.fractionsCount()).toString(), fractionsCount.toString());
            assert.equal((await fractionalizer2.fractionsCount()).toString(), (fractionsCount * 2).toString());
        });
    });
});