// const { expect } = require("chai");
// const { ethers } = require("hardhat");
// const { BigNumber } = require("ethers");

// // Import helper functions (adapt these to work with Hardhat/ethers)
// const { latestTime } = require("./helpers/latestTime");
// const { duration, ensureException, promisifyLogWatch, latestBlock } = require("./helpers/utils");
// const { takeSnapshot, increaseTime, revertToSnapshot } = require("./helpers/time");
// const { setUpPolymathNetwork, deployUSDTieredSTOAndVerified } = require("./helpers/createInstances");
// const { catchRevert } = require("./helpers/exceptions");

// describe("USDTieredSTO Simulation", function() {
//     // Accounts Variable declaration
//     let POLYMATH, ISSUER, WALLET, TREASURYWALLET;
//     let INVESTOR1, ACCREDITED1, ACCREDITED2, NONACCREDITED1, NONACCREDITED2;
//     let NOTWHITELISTED, NOTAPPROVED;
//     let accounts;

//     const MESSAGE = "Transaction Should Fail!";
//     const GAS_PRICE = ethers.parseUnits("10", "gwei"); // 10 GWEI

//     // Contract Instance Declaration
//     let I_GeneralTransferManagerFactory;
//     let I_USDTieredSTOProxyFactory;
//     let I_SecurityTokenRegistryProxy;
//     let I_GeneralPermissionManager;
//     let I_GeneralTransferManager;
//     let I_ModuleRegistryProxy;
//     let I_ModuleRegistry;
//     let I_FeatureRegistry;
//     let I_SecurityTokenRegistry;
//     let I_USDTieredSTOFactory;
//     let I_USDOracle;
//     let I_POLYOracle;
//     let I_STFactory;
//     let I_MRProxied;
//     let I_STRProxied;
//     let I_SecurityToken;
//     let I_USDTieredSTO_Array = [];
//     let I_PolyToken;
//     let I_DaiToken;
//     let I_PolymathRegistry;
//     let I_STRGetter;
//     let I_STGetter;
//     let stGetter;

//     // Contract factories
//     let USDTieredSTOFactory, USDTieredSTO, MockOracle, SecurityToken;
//     let GeneralTransferManager, GeneralPermissionManager, PolyTokenFaucet, STGetter;

//     // SecurityToken Details for funds raise Type ETH
//     const NAME = "Team";
//     const SYMBOL = "SAP";
//     const TOKENDETAILS = "This is equity type of issuance";
//     const DECIMALS = 18;

//     // Module key
//     const TMKEY = 2;
//     const STOKEY = 3;

//     // Initial fee for ticker registry and security token registry
//     const REGFEE = ethers.parseEther("1000");
//     const STOSetupCost = 0;

//     // MockOracle USD prices
//     const USDETH = ethers.parseEther("500"); // 500 USD/ETH
//     const USDPOLY = ethers.parseUnits("25", 16); // 0.25 USD/POLY

//     // STO Configuration Arrays
//     let _startTime = [];
//     let _endTime = [];
//     let _ratePerTier = [];
//     let _ratePerTierDiscountPoly = [];
//     let _tokensPerTierTotal = [];
//     let _tokensPerTierDiscountPoly = [];
//     let _nonAccreditedLimitUSD = [];
//     let _minimumInvestmentUSD = [];
//     let _fundRaiseTypes = [];
//     let _wallet = [];
//     let _treasuryWallet = [];
//     let _usdToken = [];

//     const address_zero = ethers.ZeroAddress;
//     const one_address = "0x0000000000000000000000000000000000000001";

//     const functionSignature = {
//         name: "configure",
//         type: "function",
//         inputs: [
//             { type: "uint256", name: "_startTime" },
//             { type: "uint256", name: "_endTime" },
//             { type: "uint256[]", name: "_ratePerTier" },
//             { type: "uint256[]", name: "_ratePerTierDiscountPoly" },
//             { type: "uint256[]", name: "_tokensPerTier" },
//             { type: "uint256[]", name: "_tokensPerTierDiscountPoly" },
//             { type: "uint256", name: "_nonAccreditedLimitUSD" },
//             { type: "uint256", name: "_minimumInvestmentUSD" },
//             { type: "uint8[]", name: "_fundRaiseTypes" },
//             { type: "address", name: "_wallet" },
//             { type: "address", name: "_treasuryWallet" },
//             { type: "address[]", name: "_usdTokens" }
//         ]
//     };

//     function getRandomInt(min, max) {
//         let random = Math.floor(Math.random() * 10 ** 10);
//         return BigNumber.from(random)
//             .mul(BigNumber.from(max).add(1).sub(min))
//             .div(BigNumber.from(10).pow(10));
//     }

//     function minBN(a, b) {
//         return a.lt(b) ? a : b;
//     }

//     let currentTime;
//     let e18 = ethers.parseEther("1");
//     let e16 = ethers.parseUnits("1", 16);

//     before(async () => {
//         accounts = await ethers.getSigners();
//         currentTime = await latestTime();
        
//         POLYMATH = accounts[0];
//         ISSUER = accounts[1];
//         WALLET = accounts[2];
//         TREASURYWALLET = WALLET;
//         ACCREDITED1 = accounts[3];
//         ACCREDITED2 = accounts[4];
//         NONACCREDITED1 = accounts[5];
//         NONACCREDITED2 = accounts[6];
//         NOTWHITELISTED = accounts[7];
//         NOTAPPROVED = accounts[8];
//         INVESTOR1 = accounts[9];

//         // Get contract factories
//         USDTieredSTOFactory = await ethers.getContractFactory("USDTieredSTOFactory");
//         USDTieredSTO = await ethers.getContractFactory("USDTieredSTO");
//         MockOracle = await ethers.getContractFactory("MockOracle");
//         const TokenLibFactory = await ethers.getContractFactory("TokenLib");
//         const tokenLib = await TokenLibFactory.deploy();
//         await tokenLib.waitForDeployment();

//         SecurityToken = await ethers.getContractFactory("SecurityToken", {
//         libraries: {
//             TokenLib: await tokenLib.getAddress(),
//         },
//         });
//         GeneralTransferManager = await ethers.getContractFactory("GeneralTransferManager");
//         GeneralPermissionManager = await ethers.getContractFactory("GeneralPermissionManager");
//         PolyTokenFaucet = await ethers.getContractFactory("PolyTokenFaucet");
//         STGetter = await ethers.getContractFactory("STGetter", {
//             libraries: {
//                 TokenLib: await tokenLib.getAddress(),
//             },
//         });

//         // Deploy DAI token
//         I_DaiToken = await PolyTokenFaucet.deploy();
//         await I_DaiToken.waitForDeployment();

//         // Step:1 Create the polymath ecosystem contract instances
//         let instances = await setUpPolymathNetwork(POLYMATH.address, ISSUER.address);

//         [
//             I_PolymathRegistry,
//             I_PolyToken,
//             I_FeatureRegistry,
//             I_ModuleRegistry,
//             I_ModuleRegistryProxy,
//             I_MRProxied,
//             I_GeneralTransferManagerFactory,
//             I_STFactory,
//             I_SecurityTokenRegistry,
//             I_SecurityTokenRegistryProxy,
//             I_STRProxied,
//             I_STRGetter,
//             I_STGetter
//         ] = instances;

//         // STEP 5: Deploy the USDTieredSTOFactory
//         [I_USDTieredSTOFactory] = await deployUSDTieredSTOAndVerified(POLYMATH.address, I_MRProxied, STOSetupCost);

//         // Step 12: Deploy & Register Mock Oracles
//         I_USDOracle = await MockOracle.deploy(
//             address_zero, 
//             ethers.encodeBytes32String("ETH"), 
//             ethers.encodeBytes32String("USD"), 
//             USDETH
//         );
//         await I_USDOracle.waitForDeployment();

//         I_POLYOracle = await MockOracle.deploy(
//             await I_PolyToken.getAddress(), 
//             ethers.encodeBytes32String("POLY"), 
//             ethers.encodeBytes32String("USD"), 
//             USDPOLY
//         );
//         await I_POLYOracle.waitForDeployment();

//         await I_PolymathRegistry.connect(POLYMATH).changeAddress("EthUsdOracle", await I_USDOracle.getAddress());
//         await I_PolymathRegistry.connect(POLYMATH).changeAddress("PolyUsdOracle", await I_POLYOracle.getAddress());

//         // Printing all the contract addresses
//         console.log(`
//         --------------------- Polymath Network Smart Contracts: ---------------------
//         PolymathRegistry:                  ${await I_PolymathRegistry.getAddress()}
//         SecurityTokenRegistryProxy:        ${await I_SecurityTokenRegistryProxy.getAddress()}
//         SecurityTokenRegistry:             ${await I_SecurityTokenRegistry.getAddress()}
//         ModuleRegistryProxy:               ${await I_ModuleRegistryProxy.getAddress()}
//         ModuleRegistry:                    ${await I_ModuleRegistry.getAddress()}
//         FeatureRegistry:                   ${await I_FeatureRegistry.getAddress()}

//         STFactory:                         ${await I_STFactory.getAddress()}
//         GeneralTransferManagerFactory:     ${await I_GeneralTransferManagerFactory.getAddress()}

//         USDOracle:                         ${await I_USDOracle.getAddress()}
//         POLYOracle:                        ${await I_POLYOracle.getAddress()}
//         USDTieredSTOFactory:               ${await I_USDTieredSTOFactory.getAddress()}
//         -----------------------------------------------------------------------------
//         `);
//     });

//     describe("Deploy the STO", async () => {
//         it("Should register the ticker before the generation of the security token", async () => {
//             await I_PolyToken.connect(ISSUER).getTokens(REGFEE, ISSUER.address);
//             await I_PolyToken.connect(ISSUER).approve(await I_STRProxied.getAddress(), REGFEE);
            
//             let tx = await I_STRProxied.connect(ISSUER).registerNewTicker(ISSUER.address, SYMBOL);
//             const receipt = await tx.wait();
            
//             // Find the RegisterTicker event
//             const events = receipt.logs.filter(async log => 
//                 log.address.toLowerCase() === (await I_STRProxied.getAddress()).toLowerCase()
//             );
            
//             let eventFound = false;
//             for (const log of events) {
//                 try {
//                     const parsed = I_STRProxied.interface.parseLog(log);
//                     if (parsed.name === "RegisterTicker") {
//                         expect(parsed.args._owner).to.equal(ISSUER.address);
//                         expect(parsed.args._ticker).to.equal(SYMBOL.toUpperCase());
//                         eventFound = true;
//                         break;
//                     }
//                 } catch (err) {
//                     // Continue if log parsing fails
//                 }
//             }
//             expect(eventFound).to.be.true;
//         });

//         it("Should generate the new security token with the same symbol as registered above", async () => {
//             await I_PolyToken.connect(ISSUER).getTokens(REGFEE, ISSUER.address);
//             await I_PolyToken.connect(ISSUER).approve(await I_STRProxied.getAddress(), REGFEE);

//             let tx = await I_STRProxied.connect(ISSUER).generateNewSecurityToken(
//                 NAME, 
//                 SYMBOL, 
//                 TOKENDETAILS, 
//                 true, 
//                 ISSUER.address, 
//                 0
//             );
//             const receipt = await tx.wait();
            
//             // Find NewSecurityToken event
//             const events = receipt.logs.filter(async log => 
//                 log.address.toLowerCase() === (await I_STRProxied.getAddress()).toLowerCase()
//             );
            
//             let securityTokenAddress;
//             for (const log of events) {
//                 try {
//                     const parsed = I_STRProxied.interface.parseLog(log);
//                     if (parsed.name === "NewSecurityToken") {
//                         expect(parsed.args._ticker).to.equal(SYMBOL.toUpperCase(), "SecurityToken doesn't get deployed");
//                         securityTokenAddress = parsed.args._securityTokenAddress;
//                         break;
//                     }
//                 } catch (err) {
//                     // Continue if log parsing fails
//                 }
//             }

//             I_SecurityToken = SecurityToken.attach(securityTokenAddress);
//             stGetter = STGetter.attach(securityTokenAddress);
            
//             expect(await stGetter.getTreasuryWallet()).to.equal(ISSUER.address, "Incorrect wallet set");

//             // Find ModuleAdded event
//             const moduleEvents = receipt.logs.filter(log => 
//                 log.address.toLowerCase() === securityTokenAddress.toLowerCase()
//             );
            
//             for (const log of moduleEvents) {
//                 try {
//                     const parsed = I_SecurityToken.interface.parseLog(log);
//                     if (parsed.name === "ModuleAdded") {
//                         expect(parsed.args._types[0]).to.equal(TMKEY);
//                         expect(ethers.decodeBytes32String(parsed.args._name).replace(/\0/g, "")).to.equal("GeneralTransferManager");
//                         break;
//                     }
//                 } catch (err) {
//                     // Continue if log parsing fails
//                 }
//             }
//         });

//         it("Should initialize the auto attached modules", async () => {
//             let moduleData = (await stGetter.getModulesByType(TMKEY))[0];
//             I_GeneralTransferManager = GeneralTransferManager.attach(moduleData);
//         });

//         it("Should successfully attach the first STO module to the security token", async () => {
//             let stoId = 0;

//             _startTime.push(currentTime + (duration.days(2)));
//             _endTime.push(_startTime[stoId] + (duration.days(100)));
//             _ratePerTier.push([
//                 ethers.parseUnits("50", 16).toString(), 
//                 ethers.parseUnits("130", 16).toString(), 
//                 ethers.parseUnits("170", 16).toString()
//             ]); // [ 0.05 USD/Token, 0.13 USD/Token, 0.17 USD/Token ]
//             _ratePerTierDiscountPoly.push([
//                 ethers.parseUnits("50", 16).toString(), 
//                 ethers.parseUnits("80", 16).toString(), 
//                 ethers.parseUnits("130", 16).toString()
//             ]); // [ 0.05 USD/Token, 0.08 USD/Token, 0.13 USD/Token ]
//             _tokensPerTierTotal.push([
//                 ethers.parseEther("200").toString(), 
//                 ethers.parseEther("500").toString(), 
//                 ethers.parseEther("300").toString()
//             ]); // [ 200 Token, 500 Token, 300 Token ]
//             _tokensPerTierDiscountPoly.push([
//                 "0", 
//                 ethers.parseEther("50").toString(), 
//                 ethers.parseEther("300").toString()
//             ]); // [ 0 Token, 50 Token, 300 Token ]
//             _nonAccreditedLimitUSD.push(ethers.parseEther("10")); // 10 USD
//             _minimumInvestmentUSD.push(BigNumber.from(0)); // 0 USD
//             _fundRaiseTypes.push([0, 1, 2]);
//             _wallet.push(WALLET.address);
//             _treasuryWallet.push(TREASURYWALLET.address);
//             _usdToken.push(await I_DaiToken.getAddress());

//             let config = [
//                 _startTime[stoId].toString(),
//                 _endTime[stoId].toString(),
//                 _ratePerTier[stoId],
//                 _ratePerTierDiscountPoly[stoId],
//                 _tokensPerTierTotal[stoId],
//                 _tokensPerTierDiscountPoly[stoId],
//                 _nonAccreditedLimitUSD[stoId].toString(),
//                 _minimumInvestmentUSD[stoId].toString(),
//                 _fundRaiseTypes[stoId],
//                 _wallet[stoId],
//                 _treasuryWallet[stoId],
//                 [_usdToken[stoId]]
//             ];

//             // Convert string arrays back to BigNumber arrays for internal use
//             _ratePerTier = [];
//             _ratePerTierDiscountPoly = [];
//             _tokensPerTierTotal = [];
//             _tokensPerTierDiscountPoly = [];
//             _ratePerTier.push([
//                 ethers.parseUnits("50", 16), 
//                 ethers.parseUnits("130", 16), 
//                 ethers.parseUnits("170", 16)
//             ]);
//             _ratePerTierDiscountPoly.push([
//                 ethers.parseUnits("50", 16), 
//                 ethers.parseUnits("80", 16), 
//                 ethers.parseUnits("130", 16)
//             ]);
//             _tokensPerTierTotal.push([
//                 ethers.parseEther("200"), 
//                 ethers.parseEther("500"), 
//                 ethers.parseEther("300")
//             ]);
//             _tokensPerTierDiscountPoly.push([
//                 BigNumber.from(0), 
//                 ethers.parseEther("50"), 
//                 ethers.parseEther("300")
//             ]);

//             // Encode function call data
//             const iface = new ethers.Interface([functionSignature]);
//             let bytesSTO = iface.encodeFunctionData("configure", config);
            
//             let tx = await I_SecurityToken.connect(ISSUER).addModule(
//                 await I_USDTieredSTOFactory.getAddress(), 
//                 bytesSTO, 
//                 0, 
//                 0, 
//                 false,
//                 { gasPrice: GAS_PRICE }
//             );
//             const receipt = await tx.wait();
//             console.log("          Gas addModule: ".grey + receipt.gasUsed.toString().grey);

//             // Find ModuleAdded event
//             const events = receipt.logs.filter(async log => 
//                 log.address.toLowerCase() === (await I_SecurityToken.getAddress()).toLowerCase()
//             );
            
//             let stoAddress;
//             for (const log of events) {
//                 try {
//                     const parsed = I_SecurityToken.interface.parseLog(log);
//                     if (parsed.name === "ModuleAdded") {
//                         expect(parsed.args._types[0]).to.equal(STOKEY, "USDTieredSTO doesn't get deployed");
//                         expect(ethers.decodeBytes32String(parsed.args._name).replace(/\0/g, "")).to.equal("USDTieredSTO", "USDTieredSTOFactory module was not added");
//                         stoAddress = parsed.args._module;
//                         break;
//                     }
//                 } catch (err) {
//                     // Continue if log parsing fails
//                 }
//             }

//             I_USDTieredSTO_Array.push(USDTieredSTO.attach(stoAddress));

//             // Verify STO configuration
//             expect((await I_USDTieredSTO_Array[stoId].startTime()).toString()).to.equal(_startTime[stoId].toString(), "Incorrect _startTime in config");
//             expect((await I_USDTieredSTO_Array[stoId].endTime()).toString()).to.equal(_endTime[stoId].toString(), "Incorrect _endTime in config");
            
//             for (var i = 0; i < _ratePerTier[stoId].length; i++) {
//                 const tier = await I_USDTieredSTO_Array[stoId].tiers(i);
//                 expect(tier[0].toString()).to.equal(_ratePerTier[stoId][i].toString(), "Incorrect _ratePerTier in config");
//                 expect(tier[1].toString()).to.equal(_ratePerTierDiscountPoly[stoId][i].toString(), "Incorrect _ratePerTierDiscountPoly in config");
//                 expect(tier[2].toString()).to.equal(_tokensPerTierTotal[stoId][i].toString(), "Incorrect _tokensPerTierTotal in config");
//                 expect(tier[3].toString()).to.equal(_tokensPerTierDiscountPoly[stoId][i].toString(), "Incorrect _tokensPerTierDiscountPoly in config");
//             }
            
//             expect((await I_USDTieredSTO_Array[stoId].nonAccreditedLimitUSD()).toString()).to.equal(_nonAccreditedLimitUSD[stoId].toString(), "Incorrect _nonAccreditedLimitUSD in config");
//             expect((await I_USDTieredSTO_Array[stoId].minimumInvestmentUSD()).toString()).to.equal(_minimumInvestmentUSD[stoId].toString(), "Incorrect _minimumInvestmentUSD in config");
//             expect(await I_USDTieredSTO_Array[stoId].wallet()).to.equal(_wallet[stoId], "Incorrect _wallet in config");
//             expect(await I_USDTieredSTO_Array[stoId].treasuryWallet()).to.equal(_treasuryWallet[stoId], "Incorrect _reserveWallet in config");
//             expect(await I_USDTieredSTO_Array[stoId].getNumberOfTiers()).to.equal(_tokensPerTierTotal[stoId].length, "Incorrect number of tiers");
//             expect((await I_USDTieredSTO_Array[stoId].getPermissions()).length).to.equal(2, "Incorrect number of permissions");
//         });

//         it("Should successfully prepare the STO", async () => {
//             let stoId = 0;

//             // Start STO
//             await increaseTime(duration.days(3));

//             // Whitelist
//             let fromTime = (await latestTime()) + duration.days(15);
//             let toTime = (await latestTime()) + duration.days(15);
//             let expiryTime = toTime + duration.days(100);

//             await I_GeneralTransferManager.connect(ISSUER).modifyKYCData(ACCREDITED1.address, fromTime, toTime, expiryTime);
//             await I_GeneralTransferManager.connect(ISSUER).modifyInvestorFlag(ACCREDITED1.address, 0, true);
//             await I_GeneralTransferManager.connect(ISSUER).modifyKYCData(ACCREDITED2.address, fromTime, toTime, expiryTime);
//             await I_GeneralTransferManager.connect(ISSUER).modifyInvestorFlag(ACCREDITED2.address, 0, true);
//             await I_GeneralTransferManager.connect(ISSUER).modifyKYCData(NONACCREDITED1.address, fromTime, toTime, expiryTime);
//             await I_GeneralTransferManager.connect(ISSUER).modifyKYCData(NONACCREDITED2.address, fromTime, toTime, expiryTime);
//             await I_GeneralTransferManager.connect(ISSUER).modifyKYCData(NOTAPPROVED.address, fromTime, toTime, expiryTime);
//             await I_GeneralTransferManager.connect(ISSUER).modifyInvestorFlag(NOTAPPROVED.address, 1, true);

//             await increaseTime(duration.days(3));

//             // Accreditation
//             await I_GeneralTransferManager.connect(ISSUER).modifyInvestorFlag(ACCREDITED1.address, 0, true);
//             await I_GeneralTransferManager.connect(ISSUER).modifyInvestorFlag(ACCREDITED2.address, 0, true);
//         });
//     });

//     describe("Simulate purchasing", async () => {
//         it("Should successfully complete simulation", async () => {
//             let stoId = 0;

//             console.log(`
//         ------------------- Investor Addresses -------------------
//         ACCREDITED1:    ${ACCREDITED1.address}
//         ACCREDITED2:    ${ACCREDITED2.address}
//         NONACCREDITED1: ${NONACCREDITED1.address}
//         NONACCREDITED2: ${NONACCREDITED2.address}
//         NOTWHITELISTED: ${NOTWHITELISTED.address}
//         NOTAPPROVED:    ${NOTAPPROVED.address}
//         ----------------------------------------------------------
//             `);

//             let totalTokens = BigNumber.from(0);
//             for (var i = 0; i < _tokensPerTierTotal[stoId].length; i++) {
//                 totalTokens = totalTokens.add(_tokensPerTierTotal[stoId][i]);
//             }
//             let tokensSold = BigNumber.from(0);
            
//             // Limit simulation rounds for testing purposes
//             let maxRounds = 50;
//             let roundCount = 0;
            
//             while (roundCount < maxRounds) {
//                 let rn = getRandomInt(0, 5);
//                 let rno = rn.toNumber();
//                 switch (rno) {
//                     case 0: // ACCREDITED1
//                         await invest(ACCREDITED1, true);
//                         break;
//                     case 1: // ACCREDITED2
//                         await invest(ACCREDITED2, true);
//                         break;
//                     case 2: // NONACCREDITED1
//                         let usd_NONACCREDITED1 = await I_USDTieredSTO_Array[stoId].investorInvestedUSD(NONACCREDITED1.address);
//                         if (_nonAccreditedLimitUSD[stoId].gt(usd_NONACCREDITED1))
//                             await invest(NONACCREDITED1, false);
//                         else await investFAIL(NONACCREDITED1);
//                         break;
//                     case 3: // NONACCREDITED2
//                         let usd_NONACCREDITED2 = await I_USDTieredSTO_Array[stoId].investorInvestedUSD(NONACCREDITED2.address);
//                         if (_nonAccreditedLimitUSD[stoId].gt(usd_NONACCREDITED2))
//                             await invest(NONACCREDITED2, false);
//                         else await investFAIL(NONACCREDITED2);
//                         break;
//                     case 4: // NOTWHITELISTED
//                         await investFAIL(NOTWHITELISTED);
//                         break;
//                     case 5: // NOTAPPROVED
//                         await investFAIL(NOTAPPROVED);
//                         break;
//                 }
//                 console.log("Next round");
//                 tokensSold = await I_USDTieredSTO_Array[stoId].getTokensSold();
//                 console.log("Tokens Sold: " + ethers.formatEther(tokensSold));
                
//                 roundCount++;
//                 if (tokensSold.gte(totalTokens.sub(1))) {
//                     console.log(`${tokensSold} tokens sold, simulation completed successfully!`);
//                     break;
//                 }
//             }

//             async function invest(_investor, _isAccredited) {
//                 let USD_remaining;
//                 if (!_isAccredited) {
//                     let USD_to_date = await I_USDTieredSTO_Array[stoId].investorInvestedUSD(_investor.address);
//                     USD_remaining = _nonAccreditedLimitUSD[stoId].sub(USD_to_date);
//                 } else {
//                     USD_remaining = totalTokens.mul(2);
//                 }

//                 let log_remaining = USD_remaining;
//                 let isPoly = Math.random() >= 0.33;
//                 let isDai = Math.random() >= 0.33;

//                 let Token_counter = getRandomInt(
//                     BigNumber.from(10).pow(10), 
//                     BigNumber.from(5).mul(BigNumber.from(10).pow(11))
//                 ).mul(BigNumber.from(10).pow(8));
                
//                 let investment_USD = BigNumber.from(0);
//                 let investment_ETH = BigNumber.from(0);
//                 let investment_POLY = BigNumber.from(0);
//                 let investment_DAI = BigNumber.from(0);
//                 let investment_Token = BigNumber.from(0);

//                 let Tokens_total = [];
//                 let Tokens_discount = [];
//                 for (var i = 0; i < _ratePerTier[stoId].length; i++) {
//                     let tierData = await I_USDTieredSTO_Array[stoId].tiers(i);
//                     Tokens_total.push(BigNumber.from(tierData[2]).sub(tierData[4]));
//                     Tokens_discount.push(BigNumber.from(tierData[3]).sub(tierData[5]));
//                 }

//                 let tier = 0;
//                 let Token_Tier;
//                 let USD_Tier;
//                 let POLY_Tier;
//                 let ETH_Tier;
//                 let DAI_Tier;
//                 let USD_overflow;
//                 let Token_overflow;

//                 while (Token_counter.gt(0)) {
//                     if (tier == _ratePerTier[stoId].length) {
//                         break;
//                     }
//                     if (Tokens_total[tier].gt(0)) {
//                         if (isPoly) {
//                             // 1. POLY and discount (consume up to cap then move to regular)
//                             if (Tokens_discount[tier].gt(0)) {
//                                 Token_Tier = minBN(minBN(Tokens_total[tier], Tokens_discount[tier]), Token_counter);
//                                 USD_Tier = Token_Tier.mul(_ratePerTierDiscountPoly[stoId][tier]).div(e18);
//                                 if (USD_Tier.gte(USD_remaining)) {
//                                     USD_overflow = USD_Tier.sub(USD_remaining);
//                                     Token_overflow = USD_overflow.mul(e18).div(_ratePerTierDiscountPoly[stoId][tier]);
//                                     USD_Tier = USD_Tier.sub(USD_overflow);
//                                     Token_Tier = Token_Tier.sub(Token_overflow);
//                                     Token_counter = BigNumber.from(0);
//                                 }
//                                 POLY_Tier = USD_Tier.mul(e18).div(USDPOLY);
//                                 USD_remaining = USD_remaining.sub(USD_Tier);
//                                 Tokens_total[tier] = Tokens_total[tier].sub(Token_Tier);
//                                 Tokens_discount[tier] = Tokens_discount[tier].sub(Token_Tier);
//                                 Token_counter = Token_counter.sub(Token_Tier);
//                                 investment_Token = investment_Token.add(Token_Tier);
//                                 investment_USD = investment_USD.add(USD_Tier);
//                                 investment_POLY = investment_POLY.add(POLY_Tier);
//                             }
//                             // 2. POLY and regular (consume up to cap then skip to next tier)
//                             // 2. POLY and regular (consume up to cap then skip to next tier)
//                             if (Tokens_total[tier].gt(BigNumber.from(0)) && Token_counter.gt(BigNumber.from(0))) {
//                                 Token_Tier = minBN(Tokens_total[tier], Token_counter);
//                                 USD_Tier = Token_Tier.mul(_ratePerTier[stoId][tier]).div(e18);
//                                 if (USD_Tier.gte(USD_remaining)) {
//                                     USD_overflow = USD_Tier.sub(USD_remaining);
//                                     Token_overflow = USD_overflow.mul(e18).div(_ratePerTier[stoId][tier]);
//                                     USD_Tier = USD_Tier.sub(USD_overflow);
//                                     Token_Tier = Token_Tier.sub(Token_overflow);
//                                     Token_counter = BigNumber.from(0);
//                                 }
//                                 POLY_Tier = USD_Tier.mul(e18).div(USDPOLY);
//                                 USD_remaining = USD_remaining.sub(USD_Tier);
//                                 Tokens_total[tier] = Tokens_total[tier].sub(Token_Tier);
//                                 Token_counter = Token_counter.sub(Token_Tier);
//                                 investment_Token = investment_Token.add(Token_Tier);
//                                 investment_USD = investment_USD.add(USD_Tier);
//                                 investment_POLY = investment_POLY.add(POLY_Tier);
//                             }
//                         } else if (isDai) {
//                             // 3. DAI (consume up to cap then skip to next tier)
//                             Token_Tier = minBN(Tokens_total[tier], Token_counter);
//                             USD_Tier = Token_Tier.mul(_ratePerTier[stoId][tier]).div(e18);
//                             if (USD_Tier.gte(USD_remaining)) {
//                                 USD_overflow = USD_Tier.sub(USD_remaining);
//                                 Token_overflow = USD_overflow.mul(e18).div(_ratePerTier[stoId][tier]);
//                                 USD_Tier = USD_Tier.sub(USD_overflow);
//                                 Token_Tier = Token_Tier.sub(Token_overflow);
//                                 Token_counter = BigNumber.from(0);
//                             }
//                             DAI_Tier = USD_Tier;
//                             USD_remaining = USD_remaining.sub(USD_Tier);
//                             Tokens_total[tier] = Tokens_total[tier].sub(Token_Tier);
//                             Token_counter = Token_counter.sub(Token_Tier);
//                             investment_Token = investment_Token.add(Token_Tier);
//                             investment_USD = investment_USD.add(USD_Tier);
//                             investment_DAI = investment_USD;
//                         } else {
//                             // 4. ETH (consume up to cap then skip to next tier)
//                             Token_Tier = minBN(Tokens_total[tier], Token_counter);
//                             USD_Tier = Token_Tier.mul(_ratePerTier[stoId][tier]).div(e18);
//                             if (USD_Tier.gte(USD_remaining)) {
//                                 USD_overflow = USD_Tier.sub(USD_remaining);
//                                 Token_overflow = USD_overflow.mul(e18).div(_ratePerTier[stoId][tier]);
//                                 USD_Tier = USD_Tier.sub(USD_overflow);
//                                 Token_Tier = Token_Tier.sub(Token_overflow);
//                                 Token_counter = BigNumber.from(0);
//                             }
//                             ETH_Tier = USD_Tier.mul(e18).div(USDETH);
//                             USD_remaining = USD_remaining.sub(USD_Tier);
//                             Tokens_total[tier] = Tokens_total[tier].sub(Token_Tier);
//                             Token_counter = Token_counter.sub(Token_Tier);
//                             investment_Token = investment_Token.add(Token_Tier);
//                             investment_USD = investment_USD.add(USD_Tier);
//                             investment_ETH = investment_ETH.add(ETH_Tier);
//                         }
//                     }
//                     tier = tier + 1;
//                 }

//                 await processInvestment(
//                     _investor,
//                     investment_Token,
//                     investment_USD,
//                     investment_POLY,
//                     investment_DAI,
//                     investment_ETH,
//                     isPoly,
//                     isDai,
//                     log_remaining,
//                     Tokens_total,
//                     Tokens_discount,
//                     tokensSold
//                 );
//             }

//             async function investFAIL(_investor) {
//                 let isPoly = Math.random() >= 0.3;
//                 let isDAI = Math.random() >= 0.3;
//                 let investment_POLY = ethers.parseEther("40"); // 10 USD = 40 POLY
//                 let investment_ETH = ethers.parseUnits("20", 16); // 10 USD = 0.02 ETH
//                 let investment_DAI = ethers.parseEther("10"); // 10 USD = 10 DAI

//                 if (isPoly) {
//                     await I_PolyToken.connect(_investor).getTokens(investment_POLY, _investor.address);
//                     await I_PolyToken.connect(_investor).approve(await I_USDTieredSTO_Array[stoId].getAddress(), investment_POLY);
//                     await expect(
//                         I_USDTieredSTO_Array[stoId].connect(_investor).buyWithPOLY(_investor.address, investment_POLY, { gasPrice: GAS_PRICE })
//                     ).to.be.reverted;
//                 } else if (isDAI) {
//                     await I_DaiToken.connect(_investor).getTokens(investment_DAI, _investor.address);
//                     await I_DaiToken.connect(_investor).approve(await I_USDTieredSTO_Array[stoId].getAddress(), investment_DAI);
//                     await expect(
//                         I_USDTieredSTO_Array[stoId].connect(_investor).buyWithUSD(_investor.address, investment_DAI, await I_DaiToken.getAddress(), { gasPrice: GAS_PRICE })
//                     ).to.be.reverted;
//                 } else {
//                     await expect(
//                         I_USDTieredSTO_Array[stoId].connect(_investor).buyWithETH(_investor.address, { value: investment_ETH, gasPrice: GAS_PRICE })
//                     ).to.be.reverted;
//                 }
//             }

//             async function processInvestment(
//                 _investor,
//                 investment_Token,
//                 investment_USD,
//                 investment_POLY,
//                 investment_DAI,
//                 investment_ETH,
//                 isPoly,
//                 isDai,
//                 log_remaining,
//                 Tokens_total,
//                 Tokens_discount,
//                 tokensSold
//             ) {
//                 console.log(`
//             ------------------- New Investment -------------------
//             Investor:               ${_investor.address}
//             N-A USD Remaining:      ${ethers.formatEther(log_remaining)}
//             Total Cap Remaining:    ${Tokens_total.map(t => ethers.formatEther(t))}
//             Discount Cap Remaining: ${Tokens_discount.map(t => ethers.formatEther(t))}
//             Total Tokens Sold:      ${ethers.formatEther(tokensSold)}
//             Token Investment:       ${ethers.formatEther(investment_Token)}
//             USD Investment:         ${ethers.formatEther(investment_USD)}
//             POLY Investment:        ${ethers.formatEther(investment_POLY)}
//             DAI Investment:         ${ethers.formatEther(investment_DAI)}
//             ETH Investment:         ${ethers.formatEther(investment_ETH)}
//             ------------------------------------------------------
//                 `);

//                 if (isPoly) {
//                     await I_PolyToken.connect(_investor).getTokens(investment_POLY, _investor.address);
//                     await I_PolyToken.connect(_investor).approve(await I_USDTieredSTO_Array[stoId].getAddress(), investment_POLY);
//                 } else if (isDai) {
//                     await I_DaiToken.connect(_investor).getTokens(investment_DAI, _investor.address);
//                     await I_DaiToken.connect(_investor).approve(await I_USDTieredSTO_Array[stoId].getAddress(), investment_DAI);
//                 }

//                 let init_TokenSupply = await I_SecurityToken.totalSupply();
//                 let init_InvestorTokenBal = await I_SecurityToken.balanceOf(_investor.address);
//                 let init_InvestorETHBal = await ethers.provider.getBalance(_investor.address);
//                 let init_InvestorPOLYBal = await I_PolyToken.balanceOf(_investor.address);
//                 let init_InvestorDAIBal = await I_DaiToken.balanceOf(_investor.address);
//                 let init_STOTokenSold = await I_USDTieredSTO_Array[stoId].getTokensSold();
//                 let init_STOETHBal = await ethers.provider.getBalance(await I_USDTieredSTO_Array[stoId].getAddress());
//                 let init_STOPOLYBal = await I_PolyToken.balanceOf(await I_USDTieredSTO_Array[stoId].getAddress());
//                 let init_STODAIBal = await I_DaiToken.balanceOf(await I_USDTieredSTO_Array[stoId].getAddress());
//                 let init_RaisedUSD = await I_USDTieredSTO_Array[stoId].fundsRaisedUSD();
//                 let init_RaisedETH = await I_USDTieredSTO_Array[stoId].fundsRaised(0);
//                 let init_RaisedPOLY = await I_USDTieredSTO_Array[stoId].fundsRaised(1);
//                 let init_RaisedDAI = await I_USDTieredSTO_Array[stoId].fundsRaised(2);
//                 let init_WalletETHBal = await ethers.provider.getBalance(WALLET.address);
//                 let init_WalletPOLYBal = await I_PolyToken.balanceOf(WALLET.address);
//                 let init_WalletDAIBal = await I_DaiToken.balanceOf(WALLET.address);

//                 let tx;
//                 let gasCost = BigNumber.from(0);

//                 if (isPoly && investment_POLY.gt(BigNumber.from(10))) {
//                     tx = await I_USDTieredSTO_Array[stoId].connect(_investor).buyWithPOLY(_investor.address, investment_POLY, {
//                         gasPrice: GAS_PRICE
//                     });
//                     const receipt = await tx.wait();
//                     gasCost = GAS_PRICE.mul(receipt.gasUsed);
//                     console.log(
//                         `buyWithPOLY: ${ethers.formatEther(investment_Token)} tokens for ${ethers.formatEther(investment_POLY)} POLY by ${_investor.address}`
//                     );
//                 } else if (isDai && investment_DAI.gt(BigNumber.from(10))) {
//                     tx = await I_USDTieredSTO_Array[stoId].connect(_investor).buyWithUSD(_investor.address, investment_DAI, await I_DaiToken.getAddress(), { gasPrice: GAS_PRICE });
//                     const receipt = await tx.wait();
//                     gasCost = GAS_PRICE.mul(receipt.gasUsed);
//                     console.log(
//                         `buyWithUSD: ${ethers.formatEther(investment_Token)} tokens for ${ethers.formatEther(investment_DAI)} DAI by ${_investor.address}`
//                     );
//                 } else if (investment_ETH.gt(BigNumber.from(0))) {
//                     tx = await I_USDTieredSTO_Array[stoId].connect(_investor).buyWithETH(_investor.address, {
//                         value: investment_ETH,
//                         gasPrice: GAS_PRICE
//                     });
//                     const receipt = await tx.wait();
//                     gasCost = GAS_PRICE.mul(receipt.gasUsed);
//                     console.log(
//                         `buyWithETH: ${ethers.formatEther(investment_Token)} tokens for ${ethers.formatEther(investment_ETH)} ETH by ${_investor.address}`
//                     );
//                 }

//                 let final_TokenSupply = await I_SecurityToken.totalSupply();
//                 let final_InvestorTokenBal = await I_SecurityToken.balanceOf(_investor.address);
//                 let final_InvestorETHBal = await ethers.provider.getBalance(_investor.address);
//                 let final_InvestorPOLYBal = await I_PolyToken.balanceOf(_investor.address);
//                 let final_InvestorDAIBal = await I_DaiToken.balanceOf(_investor.address);
//                 let final_STOTokenSold = await I_USDTieredSTO_Array[stoId].getTokensSold();
//                 let final_STOETHBal = await ethers.provider.getBalance(await I_USDTieredSTO_Array[stoId].getAddress());
//                 let final_STOPOLYBal = await I_PolyToken.balanceOf(await I_USDTieredSTO_Array[stoId].getAddress());
//                 let final_STODAIBal = await I_DaiToken.balanceOf(await I_USDTieredSTO_Array[stoId].getAddress());
//                 let final_RaisedUSD = await I_USDTieredSTO_Array[stoId].fundsRaisedUSD();
//                 let final_RaisedETH = await I_USDTieredSTO_Array[stoId].fundsRaised(0);
//                 let final_RaisedPOLY = await I_USDTieredSTO_Array[stoId].fundsRaised(1);
//                 let final_RaisedDAI = await I_USDTieredSTO_Array[stoId].fundsRaised(2);
//                 let final_WalletETHBal = await ethers.provider.getBalance(WALLET.address);
//                 let final_WalletPOLYBal = await I_PolyToken.balanceOf(WALLET.address);
//                 let final_WalletDAIBal = await I_DaiToken.balanceOf(WALLET.address);

//                 if (isPoly) {
//                     assertIsNear(final_TokenSupply, init_TokenSupply.add(investment_Token), "Token Supply not changed as expected");
//                     assertIsNear(final_InvestorTokenBal, init_InvestorTokenBal.add(investment_Token), "Investor Token Balance not changed as expected");
//                     assertIsNear(final_InvestorETHBal, init_InvestorETHBal.sub(gasCost), "Investor ETH Balance not changed as expected");
//                     assertIsNear(final_InvestorPOLYBal, init_InvestorPOLYBal.sub(investment_POLY), "Investor POLY Balance not changed as expected");
//                     assertIsNear(final_STOTokenSold, init_STOTokenSold.add(investment_Token), "STO Token Sold not changed as expected");
//                     assertIsNear(final_STOETHBal, init_STOETHBal, "STO ETH Balance not changed as expected");
//                     assertIsNear(final_STOPOLYBal, init_STOPOLYBal, "STO POLY Balance not changed as expected");
//                     assertIsNear(final_RaisedUSD, init_RaisedUSD.add(investment_USD), "Raised USD not changed as expected");
//                     assertIsNear(final_RaisedETH, init_RaisedETH, "Raised ETH not changed as expected");
//                     assertIsNear(final_RaisedPOLY, init_RaisedPOLY.add(investment_POLY), "Raised POLY not changed as expected");
//                     assertIsNear(final_WalletETHBal, init_WalletETHBal, "Wallet ETH Balance not changed as expected");
//                     assertIsNear(final_WalletPOLYBal, init_WalletPOLYBal.add(investment_POLY), "Wallet POLY Balance not changed as expected");
//                 } else if (isDai) {
//                     assertIsNear(final_TokenSupply, init_TokenSupply.add(investment_Token), "Token Supply not changed as expected");
//                     assertIsNear(final_InvestorTokenBal, init_InvestorTokenBal.add(investment_Token), "Investor Token Balance not changed as expected");
//                     assertIsNear(final_InvestorETHBal, init_InvestorETHBal.sub(gasCost), "Investor ETH Balance not changed as expected");
//                     assertIsNear(final_InvestorDAIBal, init_InvestorDAIBal.sub(investment_DAI), "Investor DAI Balance not changed as expected");
//                     assertIsNear(final_STOTokenSold, init_STOTokenSold.add(investment_Token), "STO Token Sold not changed as expected");
//                     assertIsNear(final_STOETHBal, init_STOETHBal, "STO ETH Balance not changed as expected");
//                     assertIsNear(final_STODAIBal, init_STODAIBal, "STO DAI Balance not changed as expected");
//                     assertIsNear(final_RaisedUSD, init_RaisedUSD.add(investment_USD), "Raised USD not changed as expected");
//                     assertIsNear(final_RaisedETH, init_RaisedETH, "Raised ETH not changed as expected");
//                     assertIsNear(final_RaisedDAI, init_RaisedDAI.add(investment_DAI), "Raised DAI not changed as expected");
//                     assertIsNear(final_WalletETHBal, init_WalletETHBal, "Wallet ETH Balance not changed as expected");
//                     assertIsNear(final_WalletDAIBal, init_WalletDAIBal.add(investment_DAI), "Wallet DAI Balance not changed as expected");
//                 } else {
//                     assertIsNear(final_TokenSupply, init_TokenSupply.add(investment_Token), "Token Supply not changed as expected");
//                     assertIsNear(final_InvestorTokenBal, init_InvestorTokenBal.add(investment_Token), "Investor Token Balance not changed as expected");
//                     assertIsNear(final_InvestorETHBal, init_InvestorETHBal.sub(gasCost).sub(investment_ETH), "Investor ETH Balance not changed as expected");
//                     assertIsNear(final_InvestorPOLYBal, init_InvestorPOLYBal, "Investor POLY Balance not changed as expected");
//                     assertIsNear(final_STOTokenSold, init_STOTokenSold.add(investment_Token), "STO Token Sold not changed as expected");
//                     assertIsNear(final_STOETHBal, init_STOETHBal, "STO ETH Balance not changed as expected");
//                     assertIsNear(final_STOPOLYBal, init_STOPOLYBal, "STO POLY Balance not changed as expected");
//                     assertIsNear(final_RaisedUSD, init_RaisedUSD.add(investment_USD), "Raised USD not changed as expected");
//                     assertIsNear(final_RaisedETH, init_RaisedETH.add(investment_ETH), "Raised ETH not changed as expected");
//                     assertIsNear(final_RaisedPOLY, init_RaisedPOLY, "Raised POLY not changed as expected");
//                     assertIsNear(final_WalletETHBal, init_WalletETHBal.add(investment_ETH), "Wallet ETH Balance not changed as expected");
//                     assertIsNear(final_WalletPOLYBal, init_WalletPOLYBal, "Wallet POLY Balance not changed as expected");
//                 }
//             }
//         });
//     });
// });

// function assertIsNear(a, b, reason) {
//     const diff = a.gt(b) ? a.sub(b) : b.sub(a);
//     expect(diff.lte(BigNumber.from(4))).to.be.true;
// }