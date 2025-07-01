import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { Contract, ContractFactory, LogDescription } from "ethers";

import { latestTime } from "./helpers/latestTime";
import { duration } from "./helpers/utils";
import { deployERC20DividendAndVerifyed, setUpPolymathNetwork } from "./helpers/createInstances";
import { initializeContracts } from "../scripts/polymath-deploy";
import { randomInt } from "crypto";

import { encodeModuleCall } from "./helpers/encodeCall";

import {
    DataStore,
    DataStoreFactory,
    DummySTO,
    DummySTOFactory,
    ERC20DividendCheckpoint,
    ERC20DividendCheckpointFactory,
    EtherDividendCheckpoint,
    EtherDividendCheckpointFactory,
    FeatureRegistry,
    GeneralPermissionManager,
    GeneralPermissionManagerFactory,
    GeneralTransferManager,
    GeneralTransferManagerFactory,
    MockOracle,
    ModuleRegistry,
    ModuleRegistryProxy,
    PolyTokenFaucet,
    PolymathRegistry,
    STFactory,
    STGetter,
    STRGetter,
    SecurityToken,
    SecurityTokenRegistry,
    SecurityTokenRegistryProxy,
    TokenLib,
    USDTieredSTO,
    USDTieredSTOFactory,
    ITradingRestrictionManager, 
} from "../typechain-types";
import { increaseTime } from "./helpers/time";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";

describe("Checkpoints", function() {
    this.timeout(18000000);

    // Accounts Variable declaration
    let account_polymath: HardhatEthersSigner;
    let account_issuer: HardhatEthersSigner;
    let token_owner: HardhatEthersSigner;
    let wallet: HardhatEthersSigner;
    let account_controller: HardhatEthersSigner;
    let account_manager: HardhatEthersSigner;
    let account_temp: HardhatEthersSigner;
    let accounts: HardhatEthersSigner[];
    let smallInvestors: HardhatEthersSigner[];
    let largeInvestors: HardhatEthersSigner[];
    let allInvestors: HardhatEthersSigner[];

    const message = "Transaction Should Fail!";
    const dividendName = "0x546573744469766964656e640000000000000000000000000000000000000000";

    // investor Details
    let fromTime: number;
    let toTime: number;
    let expiryTime: number;

    // Contract Instance Declaration
    let I_GeneralPermissionManagerFactory: Contract;
    let I_SecurityTokenRegistryProxy: SecurityTokenRegistryProxy;
    let I_ERC20DividendCheckpointFactory: any;
    let P_ERC20DividendCheckpointFactory: any;
    let P_ERC20DividendCheckpoint: any;
    let I_ERC20DividendCheckpoint: any;
    let I_GeneralTransferManagerFactory: GeneralTransferManagerFactory;
    let I_GeneralPermissionManager: Contract;
    let I_GeneralTransferManager: GeneralTransferManager;
    let I_ExchangeTransferManager: Contract;
    let I_STRProxied: any;
    let I_MRProxied: Contract;
    let I_ModuleRegistry: Contract;
    let I_ModuleRegistryProxy: Contract;
    let I_FeatureRegistry: Contract;
    let I_SecurityTokenRegistry: Contract;
    let I_STFactory: Contract;
    let I_SecurityToken: Contract;
    let I_TradingRestrictionManager: ITradingRestrictionManager;
    let I_PolyToken: Contract;
    let I_PolymathRegistry: Contract;
    let I_STRGetter: Contract;
    let I_STGetter: Contract;
    let stGetter: Contract;
    
    
    

    // Contract factories
    let SecurityToken: ContractFactory;
    let GeneralTransferManager: ContractFactory;
    let STGetter: ContractFactory;
    let GeneralTransferManagerFactory: any;
    let ERC20DividendCheckpointFactory: any;
    let TradingRestrictionManagerFactory: any;

    // SecurityToken Details
    const name = "Team";
    const symbol = "SAP";
    const tokenDetails = "This is equity type of issuance";
    const decimals = 18;
    const contact = "team@polymath.network";

    // Module key
    const delegateManagerKey = 1;
    const transferManagerKey = 2;
    const stoKey = 3;
    const checkpointKey = 4;

    // Manager details
    const managerDetails = ethers.encodeBytes32String("Hello");

    // Initial fee for ticker registry and security token registry
    const initRegFee = ethers.parseEther("1000");

    const one_address = "0x0000000000000000000000000000000000000001";
    const address_zero = ethers.ZeroAddress;

    let currentTime: number;
    let snapId: string;
    
    const DividendParameters = ["address"];
    
    let issuedAmounts: Record<string, bigint> = {}; // track issued amounts for yield math later
    let values: [string, bigint, boolean][] = [];
    let investorClassMap: Record<string, number> = {};
    enum InvestorClass {
        NonUS = 0,
        US = 1
    }

    function getRandomInvestorClass(): number {
        return Math.random() < 0.5 ? InvestorClass.NonUS : InvestorClass.US;
    }

    before(async () => {

        await initializeContracts();
        // Get signers
        accounts = await ethers.getSigners();
        
        fromTime = await latestTime();
        toTime = await latestTime();
        expiryTime = toTime + duration.days(15);
        
        // Accounts setup
        account_polymath = accounts[0];
        account_issuer = accounts[1];
        token_owner = account_issuer;
        account_temp = accounts[2];
        wallet = accounts[3];
        account_manager = accounts[5];
        account_controller = accounts[3];
        
        console.log(token_owner.address, "token_owner.address");


        GeneralTransferManager = await ethers.getContractFactory("GeneralTransferManager");
        GeneralTransferManagerFactory = await ethers.getContractFactory("GeneralTransferManager");
        ERC20DividendCheckpointFactory = await ethers.getContractFactory("ERC20DividendCheckpoint");
        TradingRestrictionManagerFactory = await ethers.getContractFactory("TradingRestrictionManager");

        // Step 1: Deploy the general PM ecosystem
        const instances = await setUpPolymathNetwork(account_polymath.address, token_owner.address);

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
        ] = instances;

        // Deploy ERC20DividendCheckpoint factories
        [P_ERC20DividendCheckpointFactory] = await deployERC20DividendAndVerifyed(
            account_polymath.address,
            I_MRProxied,
            ethers.parseEther("500")
        );
        
        [I_ERC20DividendCheckpointFactory] = await deployERC20DividendAndVerifyed(
            account_polymath.address, 
            I_MRProxied, 
            0n
        );

        // Deploy TradingRestrictionManager and assign to I_TradingRestrictionManager
        const tradingRestrictionManager = await TradingRestrictionManagerFactory.connect(token_owner).deploy();
        await tradingRestrictionManager.waitForDeployment();
        I_TradingRestrictionManager = tradingRestrictionManager;
        

        const tradingRestrictionManagerConcrete = TradingRestrictionManagerFactory.attach(I_TradingRestrictionManager.target);
        // Grant operator role to account_issuer
        await tradingRestrictionManagerConcrete.connect(token_owner).grantOperator(account_issuer.address);

        // Printing all the contract addresses
        console.log(`
        --------------------- Polymath Network Smart Contracts: ---------------------
        PolymathRegistry:                  ${I_PolymathRegistry.target}
        SecurityTokenRegistryProxy:        ${I_SecurityTokenRegistryProxy.target}
        SecurityTokenRegistry:             ${I_SecurityTokenRegistry.target}
        ModuleRegistryProxy:               ${I_ModuleRegistryProxy.target}
        ModuleRegistry:                    ${I_ModuleRegistry.target}
        FeatureRegistry:                   ${I_FeatureRegistry.target}

        STFactory:                         ${I_STFactory.target}
        GeneralTransferManagerFactory:     ${I_GeneralTransferManagerFactory.target}
        -----------------------------------------------------------------------------
        `);
    });

    describe("ST-20 Token Flow with Yield Simulation", async () => {
        it("Should register the ticker before the generation of the security token", async () => {
            console.log("Registering the ticker before the generation of the security token", I_STRProxied);
            await I_PolyToken.connect(token_owner).approve(I_STRProxied.target, initRegFee);
            const tx = await I_STRProxied.connect(token_owner).registerNewTicker(token_owner.address, symbol);

            const receipt = await tx.wait();
            const fullReceipt = await ethers.provider.getTransactionReceipt(receipt!.hash);
            const strProxiedAddress = await I_STRProxied.getAddress();
        
            const logs = fullReceipt!.logs.filter(log => 
                log.address.toLowerCase() === strProxiedAddress.toLowerCase()
            );
        
            let eventFound = false;
            for (const log of logs) {
                try {
                    const parsed = I_STRProxied.interface.parseLog(log);
                    
                    if (parsed && parsed.name === "RegisterTicker") { 
                        expect(parsed.args._owner).to.equal(token_owner.address);
                        expect(parsed.args._ticker).to.equal(symbol.toUpperCase());
                        eventFound = true;
                        break;
                    }
                } catch (err: any) {
                    console.log(`Failed to parse log: ${err.message}`);
                }
            }
        
            expect(eventFound).to.be.true;
        });

        it("Should generate the new security token with the same symbol as registered above", async () => {
            await I_PolyToken.connect(token_owner).approve(I_STRProxied.target, initRegFee);

            const tx = await I_STRProxied.connect(token_owner).generateNewSecurityToken(
                name,
                symbol,
                tokenDetails,
                false,
                token_owner.address,
                0
            );
            const receipt = await tx.wait();
            let securityTokenEvent: LogDescription | null = null;

            for (const log of receipt!.logs) {
                try {
                    const parsed = I_STRProxied.interface.parseLog(log);
                    
                    if (parsed && parsed.name === "NewSecurityToken") {
                        console.log("Parsed log:", parsed);
                        securityTokenEvent = parsed;
                        break;
                    }
                } catch (err: any) {
                    console.log(`Failed to parse log with STRProxied: ${err.message}`);
                }
            }

            expect(securityTokenEvent).to.not.be.null;
            expect(securityTokenEvent!.args._ticker).to.equal(symbol.toUpperCase(), "SecurityToken doesn't get deployed");

            I_SecurityToken = await ethers.getContractAt("SecurityToken", securityTokenEvent!.args._securityTokenAddress);
            stGetter = await ethers.getContractAt("STGetter", I_SecurityToken.target);

            for (const log of receipt!.logs) {
                try {
                    const parsed = I_SecurityToken.interface.parseLog(log);
                    
                    if (parsed && parsed.name === "ModuleAdded") {
                        securityTokenEvent = parsed;
                        break;
                    }
                } catch (err: any) {
                    console.log(`Failed to parse log with STRProxied: ${err.message}`);
                }
            }

            expect(securityTokenEvent).to.not.be.null;
            const nameBytes32 = ethers.decodeBytes32String(securityTokenEvent!.args._name).replace(/\u0000/g, '');
            expect(nameBytes32).to.equal("GeneralTransferManager", "SecurityToken doesn't have the transfer manager module");
        });

        it("Should set the controller", async() => {
            await I_SecurityToken.connect(token_owner).setController(account_controller.address);
        });

        it("Should initialize the auto attached modules", async () => {
            const moduleData: string[] = await stGetter.getModulesByType(transferManagerKey);
            console.log("Module Data:", moduleData[0], moduleData);

            I_GeneralTransferManager = GeneralTransferManager.attach(moduleData[0]);
        });

        it("Should successfully attach the ERC20DividendCheckpoint with the security token", async () => {
            const bytesDividend = encodeModuleCall(DividendParameters, [address_zero]);
            const tx = await I_SecurityToken.connect(token_owner).addModule(
                I_ERC20DividendCheckpointFactory.target,
                bytesDividend,
                0n,
                0n,
                false
            );

            const receipt = await tx.wait();
            const moduleAddedEvent = receipt!.logs
                .map(log => {
                    try {
                        return I_SecurityToken.interface.parseLog(log);
                    } catch {
                        return null;
                    }
                })
                .find(parsed => parsed && parsed.name === "ModuleAdded");

            expect(moduleAddedEvent).to.not.be.null;
            expect(moduleAddedEvent!.args._types[0]).to.equal(checkpointKey);
            const moduleName = ethers.decodeBytes32String(moduleAddedEvent!.args._name).replace(/\u0000/g, "");
            expect(moduleName).to.equal("ERC20DividendCheckpoint");

            I_ERC20DividendCheckpoint = await ethers.getContractAt("ERC20DividendCheckpoint", moduleAddedEvent!.args._module);
        });
    });

    describe("Buy tokens using on-chain whitelist", async () => {
        
        it("should set trading restriction manager", async () => { 
            const tx = await I_GeneralTransferManager.connect(token_owner).setTradingRestrictionManager(I_TradingRestrictionManager.target);

            const receipt = await tx.wait();
            let tradingRestrictionEvent: LogDescription | null = null;

            for (const log of receipt!.logs) {
                try {
                    const parsed = I_GeneralTransferManager.interface.parseLog(log);
                    
                    if (parsed && parsed.name === "TradingRestrictionManagerUpdated") {
                        tradingRestrictionEvent = parsed;
                        break;
                    }
                } catch (err: any) {
                    console.log(`Failed to parse log with STRProxied: ${err.message}`);
                }
            }

            expect(tradingRestrictionEvent).to.not.be.null;
            expect(tradingRestrictionEvent!.args.newManager).to.equal(I_TradingRestrictionManager.target, "TradingRestrictionManager not set correctly");
        });
        it("Should whitelist and issue tokens to many investors", async () => {
            const ltime = await latestTime();
            const expiry = ltime + duration.days(300);

            smallInvestors = accounts.slice(1, 901); // 900 small
            largeInvestors = accounts.slice(901, 1001); // 100 large
            allInvestors = [...smallInvestors, ...largeInvestors];
            console.log(`Whitelisting ${allInvestors.length} investors...`);

            for (const investor of allInvestors) {
                const isAccredited = Math.random() < 0.5; // random accreditation
                const investorClass = getRandomInvestorClass();
                investorClassMap[investor.address.toLowerCase()] = investorClass;

                values.push([investor.address, BigInt(expiry), isAccredited]);
            }


            const merkleTree = StandardMerkleTree.of(values, ["address", "uint64", "bool"]);
            const merkleRoot = merkleTree.root;

            await I_TradingRestrictionManager.connect(token_owner).modifyKYCData(merkleRoot);

            for (const [index, [address, expiry, isAccredited]] of merkleTree.entries()) {

                const proof = merkleTree.getProof(index);
                const signer = accounts.find(acc => acc.address === address)!;

                const investorClass = investorClassMap[address.toLowerCase()];
                // Whitelist investor
                await expect(
                    I_TradingRestrictionManager.connect(signer).verifyInvestor(
                        proof,
                        address,
                        expiry,
                        isAccredited,
                        investorClass
                    )
                ).to.not.be.reverted;

                //Issue tokens based on group
                const rawAmount = smallInvestors.includes(signer)
                    ? randomInt(10, 5000)         // small: 10–5,000
                    : randomInt(10_000, 500_000);  // large holder

                const amount = ethers.parseEther(rawAmount.toString());

                await I_SecurityToken.connect(token_owner).issue(
                    address,
                    amount,
                    "0x"
                );

                //validate balance
                const balance = await I_SecurityToken.balanceOf(address);
                expect(balance).to.equal(amount);

                issuedAmounts[address.toLowerCase()] = amount;
            }

            console.log(`Verified & issued tokens to ${allInvestors.length} investors using Merkle Tree.`);
        });

        it("Should allow existing investors to buy more tokens", async () => {
            const ltime = await latestTime();
            const expiry = ltime + duration.days(300);

            for (const investor of allInvestors) {
                const isAccredited = Math.random() < 0.5; // random accreditation
                const investorClass = getRandomInvestorClass();
                investorClassMap[investor.address.toLowerCase()] = investorClass;

                values.push([investor.address, BigInt(expiry), isAccredited]);
            }


            const merkleTree = StandardMerkleTree.of(values, ["address", "uint64", "bool"]);
            const merkleRoot = merkleTree.root;

            await I_TradingRestrictionManager.connect(token_owner).modifyKYCData(merkleRoot);

            for (const [index, [address, expiry, isAccredited]] of merkleTree.entries()) {

                const proof = merkleTree.getProof(index);
                const signer = accounts.find(acc => acc.address === address)!;

                const investorClass = investorClassMap[address.toLowerCase()];
                // Whitelist investor
                await expect(
                    I_TradingRestrictionManager.connect(signer).verifyInvestor(
                        proof,
                        address,
                        expiry,
                        isAccredited,
                        investorClass
                    )
                ).to.not.be.reverted;

                //Issue tokens based on group
                const rawAmount = smallInvestors.includes(signer)
                    ? randomInt(10, 5000)         // small: 10–5,000
                    : randomInt(10_000, 500_000);  // large holder

                const amount = ethers.parseEther(rawAmount.toString());

                const prevBalance = await I_SecurityToken.balanceOf(address);

                await I_SecurityToken.connect(token_owner).issue(
                    address,
                    amount,
                    "0x"
                );

                //validate balance
                const newBalance = await I_SecurityToken.balanceOf(address);
                expect(newBalance).to.equal(prevBalance + amount);

                // Save issued amount (add to cumulative if needed)
                issuedAmounts[address.toLowerCase()] = (issuedAmounts[address.toLowerCase()] || 0n) + amount;
            }

            console.log("All existing investors bought more tokens successfully.");
        });

        // it("Should add new token holders after initial distribution", async () => {
        //     const ltime = await latestTime();
        //     const expiry = ltime + duration.days(300);
        //     const values: [string, bigint, boolean][] = [];

        //     // Add 20 new investors
        //     const newInvestors = accounts.slice(1001, 1021);
        //     allInvestors.push(...newInvestors)

        //     for (const investor of newInvestors) {
        //         const isAccredited = Math.random() < 0.5; // random accreditation
        //         const investorClass = getRandomInvestorClass();
        //         investorClassMap[investor.address.toLowerCase()] = investorClass;

        //         values.push([investor.address, BigInt(expiry), isAccredited]);
        //     }


        //     const merkleTree = StandardMerkleTree.of(values, ["address", "uint64", "bool"]);
        //     const merkleRoot = merkleTree.root;

        //     await I_TradingRestrictionManager.connect(token_owner).modifyKYCData(merkleRoot);

        //     for (const [index, [address, expiry, isAccredited]] of merkleTree.entries()) {

        //         const proof = merkleTree.getProof(index);
        //         const signer = accounts.find(acc => acc.address === address)!;

        //         const investorClass = investorClassMap[address.toLowerCase()];
        //         // Whitelist investor
        //         await expect(
        //             I_TradingRestrictionManager.connect(signer).verifyInvestor(
        //                 proof,
        //                 address,
        //                 expiry,
        //                 isAccredited,
        //                 investorClass
        //             )
        //         ).to.not.be.reverted;

        //         //Issue tokens based on group
        //         const rawAmount = smallInvestors.includes(signer)
        //             ? randomInt(10, 5000)         // small: 10–5,000
        //             : randomInt(10_000, 500_000);  // large holder

        //         const amount = ethers.parseEther(rawAmount.toString());

        //         await I_SecurityToken.connect(token_owner).issue(
        //             address,
        //             amount,
        //             "0x"
        //         );

        //         //validate balance
        //         const balance = await I_SecurityToken.balanceOf(address);
        //         expect(balance).to.equal(amount);

        //         issuedAmounts[address.toLowerCase()] = amount;
        //     }

        //     console.log(`Added and funded ${newInvestors.length} new investors after initial distribution`);
        // });

        it("Fuzz test balance checkpoints for many investors", async () => {
            await I_SecurityToken.connect(token_owner).changeGranularity(1);

            const checkpointBalances: Record<number, Record<string, bigint>> = {};
            const totalSupplies: Record<number, bigint> = {};
            // const allInvestors = accounts.slice(1, 1021);
            
            for (let j = 0; j < 10; j++) {
                const checkpointIndex = j + 1;

                // Capture balances at this point
                const balancesAtCheckpoint: Record<string, bigint> = {};
                for (const investor of allInvestors) {
                balancesAtCheckpoint[investor.address.toLowerCase()] = await I_SecurityToken.balanceOf(investor.address);
                }
                const totalSupply = await I_SecurityToken.totalSupply();
                console.log("total supply: ", totalSupply)
                
                checkpointBalances[checkpointIndex] = balancesAtCheckpoint;
                totalSupplies[checkpointIndex] = totalSupply;

                console.log(`\nCheckpoint ${checkpointIndex} Created:`);
                console.log(`TotalSupply: ${totalSupply.toString()}`);
                
                const investorLength = await stGetter.getInvestorCount();
                const tx = await I_SecurityToken.connect(token_owner).createCheckpoint();
                const receipt = await tx.wait();
                
                // Validate CheckpointCreated event
                let checkpointEvent: LogDescription | null = null;
                for (const log of receipt!.logs) {
                    try {
                        const parsed = I_SecurityToken.interface.parseLog(log);
                        
                        if (parsed && parsed.name === "CheckpointCreated") {
                            checkpointEvent = parsed;
                            break;
                        }
                    } catch (err: any) {
                        console.log(`Failed to parse checkpoint event: ${err.message}`);
                    }
                }
                
                expect(checkpointEvent).to.not.be.null;
                expect(checkpointEvent!.args[1]).to.equal(investorLength);
                
                const checkpointTimes: bigint[] = await stGetter.getCheckpointTimes();
                expect(checkpointTimes.length).to.equal(j + 1);
                console.log("Checkpoint Times: " + checkpointTimes.map(t => t.toString()));
                
                // Perform some random transfers
                const transferCount = Math.floor(Math.random() * 10);
                for (let i = 0; i < transferCount; i++) {
                    const sender = allInvestors[Math.floor(Math.random() * allInvestors.length)];
                    const receiver = allInvestors[Math.floor(Math.random() * allInvestors.length)];

                    if (sender.address === receiver.address) continue;

                    // Check both are whitelisted and valid
                    const isSenderWhitelisted = await I_TradingRestrictionManager.isExistingInvestor(sender.address);
                    const isReceiverWhitelisted = await I_TradingRestrictionManager.isExistingInvestor(receiver.address);
                    if (!isSenderWhitelisted || !isReceiverWhitelisted) {
                        // Optionally log or count skipped transfers
                        continue;
                    }

                    const senderBalance = await I_SecurityToken.balanceOf(sender.address);
                    if (senderBalance === 0n) continue;

                    const percentage = Math.floor(Math.random() * 10) + 1;
                    const amount = (senderBalance * BigInt(percentage)) / 10n;

                    console.log(`Transfer: ${amount} from ${sender.address} to ${receiver.address}`);
                    await I_TradingRestrictionManager.setTradingRestrictionPeriod(I_SecurityToken.target, 0, 0, 1);
                    const kycDataSender = await I_TradingRestrictionManager.getInvestorKYCData(sender.address, I_SecurityToken.target);
const kycDataReceiver = await I_TradingRestrictionManager.getInvestorKYCData(receiver.address, I_SecurityToken.target);
console.log("Sender KYC:", sender.address, kycDataSender);
console.log("Receiver KYC:", receiver.address, kycDataReceiver);
                    await I_SecurityToken.connect(sender).transfer(receiver.address, amount);
                }
                
                // Mint
                if (Math.random() > 0.5) {
                    const minter = allInvestors[Math.floor(Math.random() * allInvestors.length)];
                    const min = 1_000_000_000_000_000n;                    // 0.001
                    const maxDelta = 100_000_000_000_000n;                 // add up to 0.1
                    const delta = BigInt(randomInt(0, Number(maxDelta)));
                    const mintAmount = min + delta;

                    console.log(`Minting ${mintAmount} to ${minter.address}`);
                    await I_SecurityToken.connect(token_owner).issue(minter.address, mintAmount, "0x");
                }

                // burn
                if (Math.random() > 0.5) {
                    const burner = allInvestors[Math.floor(Math.random() * allInvestors.length)];
                    const burnerBalance = await I_SecurityToken.balanceOf(burner.address);
                    if (burnerBalance > 0n) {
                        const min = 1_000_000_000_000_000n;
                        const maxDelta = 100_000_000_000_000n;
                        let burnAmount = min + BigInt(randomInt(0, Number(maxDelta)));

                        if (burnAmount > burnerBalance / 2n) {
                        burnAmount = burnerBalance / 2n;
                        }

                        console.log(`Burning ${burnAmount} from ${burner.address}`);
                        await I_SecurityToken.connect(account_controller).controllerRedeem(burner.address, burnAmount, "0x", "0x");
                    }
                }
                
                // Interim Check
                console.log("Checking Interim...");
                for (let k = 1; k <= j + 1; k++) {
                    const totalSupply = await stGetter.totalSupplyAt(k);
                    expect(totalSupply).to.equal(totalSupplies[k]);
                    console.log(`Checking TotalSupply: ${totalSupply.toString()} is ${totalSupplies[k].toString()} at checkpoint: ${k}`);

                    const expectedBalances = checkpointBalances[k];
                    for (const investor of allInvestors) {
                        const expected = expectedBalances[investor.address.toLowerCase()] ?? 0n;
                        const actual = await stGetter.balanceOfAt(investor.address, k);
                        expect(actual).to.equal(expected);
                    }
                }
            }
            
            // Final Check of all checkpoint data
            console.log("\nFinal Full Check...");
            for (const [checkpointIndex, balances] of Object.entries(checkpointBalances)) {
                const index = parseInt(checkpointIndex);
                const totalSupply = await stGetter.totalSupplyAt(index);
                expect(totalSupply).to.equal(totalSupplies[index]);
                console.log(`\nVerifying Checkpoint ${index}`);
                console.log(`Expected TotalSupply: ${totalSupplies[index]}, Found: ${totalSupply}`);

                for (const [address, expectedBalance] of Object.entries(balances)) {
                const actualBalance = await stGetter.balanceOfAt(address, index);
                expect(actualBalance).to.equal(expectedBalance);
                }
            }

            console.log("All checkpoints validated successfully for large investor set");
        });
    });

    describe("Check Dividend payouts", async () => {
        it("Should create a dividend", async () => {
            const maturity = await latestTime() + 10;
            const expiry = maturity + duration.days(10);
            const dividendAmount = ethers.parseEther("10000");

            //Make sure token_owner has enough POLY tokens
            await I_PolyToken.connect(token_owner).getTokens(dividendAmount, token_owner.address);

            //Approve spending
            await I_PolyToken.connect(token_owner).approve(I_ERC20DividendCheckpoint.target, dividendAmount);

            //Create dividend
            const tx = await I_ERC20DividendCheckpoint.connect(token_owner).createDividend(
                maturity,
                expiry,
                I_PolyToken.target,
                dividendAmount,
                dividendName
            );

            const receipt = await tx.wait();
            const event = receipt.logs
                .map(log => {
                try {
                    return I_ERC20DividendCheckpoint.interface.parseLog(log);
                } catch {
                    return null;
                }
                })
                .find(e => e && e.name === "ERC20DividendDeposited");

            expect(event).to.not.be.null;
            const dividendIndex = event!.args._dividendIndex;

            // Check internal dividend data
            const data = await I_ERC20DividendCheckpoint.getDividendsData();
            expect(data[1][Number(dividendIndex)]).to.equal(BigInt(maturity));
            expect(data[2][Number(dividendIndex)]).to.equal(BigInt(expiry));
            expect(data[3][Number(dividendIndex)]).to.equal(dividendAmount);
            expect(data[4][Number(dividendIndex)]).to.equal(0n); // nothing claimed yet
            expect(data[5][Number(dividendIndex)]).to.equal(dividendName);

            console.log(`Dividend #${dividendIndex} created and verified`);
        });

        it("Issuer should push full dividend to all token holders in batches and verify correct payout distribution", async () => {

            const dividendIndex = 0; // assuming this is the first dividend
            const totalInvestors  = Number(await stGetter.getInvestorCount());
            const batchSize = 5;
            const lastIndex = totalInvestors - 1;

            // Record balances before pushing
            const balancesBefore: Record<string, bigint> = {};
            for (const investor of allInvestors) {
                balancesBefore[investor.address] = await I_PolyToken.balanceOf(investor.address);
            }
            
            console.log(`Total investors: ${totalInvestors}`);

            // Simulate time passing beyond maturity
            await increaseTime(11);

            // Push dividends in chunks
            for (let start = 0; start <= lastIndex; start += batchSize) {
                const remaining = totalInvestors - start;
                const count = Math.min(batchSize, remaining);
                const endIndex = start + count - 1;

                // Avoid out-of-bounds by clamping to lastIndex
                const safeEndIndex = Math.min(endIndex, lastIndex);

                console.log(`Pushed dividend from ${start} to ${safeEndIndex}`);

                const tx = await I_ERC20DividendCheckpoint.connect(token_owner).pushDividendPayment(
                    dividendIndex,
                    BigInt(start),
                    BigInt(safeEndIndex)
                );
                await tx.wait();

                console.log(`Pushed dividend from ${start} to  ${start + count - 1}`);
            }
            // Check balances after
            const totalSupply = await I_SecurityToken.totalSupply();
            const totalDividendAmount = ethers.parseEther("10000");

            for (const investor of allInvestors) {
                const balance = await I_SecurityToken.balanceOf(investor.address);
                const expectedShare = (balance * totalDividendAmount) / totalSupply;
                const newBalance = await I_PolyToken.balanceOf(investor.address);
                const claimed = newBalance - balancesBefore[investor.address];


                expect(claimed).to.equal(expectedShare);
            }

            // Verify the dividend was marked fully claimed
            const dividendData = await I_ERC20DividendCheckpoint.dividends(dividendIndex);
            const tolerance = BigInt(20); // allow up to 20 wei rounding error
            expect(
            (dividendData.claimedAmount >= totalDividendAmount - tolerance) &&
            (dividendData.claimedAmount <= totalDividendAmount)
            ).to.be.true;

            console.log("Pushed dividend to all investors successfully");
        });

        it("Should perform random transfers between investors", async () => {

            const transferCount = 200; // total number of transfers

            for (let i = 0; i < transferCount; i++) {
                const senderIndex = Math.floor(Math.random() * allInvestors.length);
                let receiverIndex = Math.floor(Math.random() * allInvestors.length);

                // Ensure sender ≠ receiver
                while (receiverIndex === senderIndex) {
                receiverIndex = Math.floor(Math.random() * allInvestors.length);
                }

                const sender = allInvestors[senderIndex];
                const receiver = allInvestors[receiverIndex];
                const senderBalance = await I_SecurityToken.balanceOf(sender.address);

                if (senderBalance === 0n) continue; // skip if no balance

                // Transfer 10% to 50% of balance
                const percentage = Math.floor(Math.random() * 40) + 10; // 10–50%
                const amount = (senderBalance * BigInt(percentage)) / 100n;

                await I_SecurityToken.connect(sender).transfer(receiver.address, amount);

                console.log(`Transfer #${i + 1}: ${ethers.formatEther(amount)} tokens from ${sender.address} to ${receiver.address}`);
            }

            console.log("Random transfers completed");
        });

        it("Should create a second dividend after transfers", async () => {
            const maturity = await latestTime() + 10;
            const expiry = maturity + duration.days(10);
            const secondDividendAmount = ethers.parseEther("20000");
            const secondDividendName = ethers.encodeBytes32String("Dividend #2");;

            // Ensure token_owner has enough POLY tokens
            await I_PolyToken.connect(token_owner).getTokens(secondDividendAmount, token_owner.address);

            // Approve spending for dividend
            await I_PolyToken.connect(token_owner).approve(I_ERC20DividendCheckpoint.target, secondDividendAmount);

            // Create the second dividend
            const tx = await I_ERC20DividendCheckpoint.connect(token_owner).createDividend(
                maturity,
                expiry,
                I_PolyToken.target,
                secondDividendAmount,
                secondDividendName
            );

            const receipt = await tx.wait();
            const event = receipt.logs
                .map(log => {
                try {
                    return I_ERC20DividendCheckpoint.interface.parseLog(log);
                } catch {
                    return null;
                }
                })
                .find(e => e && e.name === "ERC20DividendDeposited");

            expect(event).to.not.be.null;
            const dividendIndex = event!.args._dividendIndex;

            // ✅ Verify dividend data
            const data = await I_ERC20DividendCheckpoint.getDividendsData();
            expect(data[1][Number(dividendIndex)]).to.equal(BigInt(maturity));
            expect(data[2][Number(dividendIndex)]).to.equal(BigInt(expiry));
            expect(data[3][Number(dividendIndex)]).to.equal(secondDividendAmount);
            expect(data[4][Number(dividendIndex)]).to.equal(0n); // unclaimed initially
            expect(data[5][Number(dividendIndex)]).to.equal(secondDividendName);

            console.log(`Second dividend #${dividendIndex} created and validated`);
        });

        it("Issuer should push full second dividend to all token holders in batches and verify correct payout distribution", async () => {
            const dividendIndex = 1; // second dividend
            const totalDividendAmount = ethers.parseEther("20000"); 
            const totalInvestors  = Number(await stGetter.getInvestorCount());
            const batchSize = 5;
            const lastIndex = totalInvestors - 1;

            // Record balances before push
            const balancesBefore: Record<string, bigint> = {};

            for (const investor of allInvestors) {
                balancesBefore[investor.address] = await I_PolyToken.balanceOf(investor.address);
            }

            console.log(`Total investors: ${totalInvestors}`);

            // Simulate time passing beyond maturity
            await increaseTime(15); // assuming > maturity

            // Push dividends in chunks
            for (let start = 0; start <= lastIndex; start += batchSize) {
                const remaining = totalInvestors - start;
                const count = Math.min(batchSize, remaining);
                const endIndex = start + count - 1;

                // Avoid out-of-bounds by clamping to lastIndex
                const safeEndIndex = Math.min(endIndex, lastIndex);

                console.log(`Pushed dividend from ${start} to ${safeEndIndex}`);

                const tx = await I_ERC20DividendCheckpoint.connect(token_owner).pushDividendPayment(
                    dividendIndex,
                    BigInt(start),
                    BigInt(safeEndIndex)
                );
                await tx.wait();

                console.log(`Pushed dividend from ${start} to  ${start + count - 1}`);
            }

            // Confirm correct payouts
            const totalSupply = await I_SecurityToken.totalSupply();

            for (const investor of allInvestors) {
                const balance = await I_SecurityToken.balanceOf(investor.address);
                const expectedShare = (balance * totalDividendAmount) / totalSupply;

                const after = await I_PolyToken.balanceOf(investor.address);
                const claimed = after - balancesBefore[investor.address];

                expect(claimed).to.equal(expectedShare);
            }

            // Confirm total claim recorded
            const dividendData = await I_ERC20DividendCheckpoint.dividends(dividendIndex);
            const tolerance = ethers.parseUnits("0.000000000000000020", 18); // 20 wei
            const diff = dividendData.claimedAmount > totalDividendAmount
                ? dividendData.claimedAmount - totalDividendAmount
                : totalDividendAmount - dividendData.claimedAmount;

            expect(diff <= tolerance).to.be.true;

            console.log("Pushed second dividend to all investors successfully");
        });
    });
});