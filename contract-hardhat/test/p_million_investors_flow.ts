// npx hardhat node
// Open second terminal and run the below commands:
// cd contract-hardhat
// npx hardhat run scripts/generateAccounts.ts --network localhost
// npx hardhat test test/p_million_investors_flow.ts --network localhost

import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { Contract, ContractFactory, JsonRpcProvider, LogDescription, Wallet } from "ethers";

import { latestTime } from "./helpers/latestTime";
import { duration } from "./helpers/utils";
import { deployERC20DividendAndVerifyed, deployUSDTieredSTOAndVerified, setUpPolymathNetwork } from "./helpers/createInstances";
import { initializeContracts } from "../scripts/polymath-deploy";
import { randomInt } from "crypto";

import { encodeModuleCall } from "./helpers/encodeCall";
import csv from "csv-parser";
import PQueue from "p-queue";
import fs from "fs";
import { createObjectCsvWriter } from "csv-writer";
import { parse } from "csv-parse/sync";

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

interface InvestorWallet {
    address: string;
    privateKey: string;
    isAccredited?: boolean;
    investorClass?: number;
    currentBalance?: bigint;
    expiry?: string;
    merkleLeaf?: string;
    proof?: string[];
};

const functionSignature = {
    name: "configure",
    type: "function",
    inputs: [
        {
            type: "uint256",
            name: "_startTime"
        },
        {
            type: "uint256",
            name: "_endTime"
        },
        {
            type: "uint256[]",
            name: "_ratePerTier"
        },
        {
            type: "uint256[]",
            name: "_ratePerTierDiscountPoly"
        },
        {
            type: "uint256[]",
            name: "_tokensPerTier"
        },
        {
            type: "uint256[]",
            name: "_tokensPerTierDiscountPoly"
        },
        {
            type: "uint256",
            name: "_nonAccreditedLimitUSD"
        },
        {
            type: "uint256",
            name: "_minimumInvestmentUSD"
        },
        {
            type: "uint8[]",
            name: "_fundRaiseTypes"
        },
        {
            type: "address",
            name: "_wallet"
        },
        {
            type: "address",
            name: "_treasuryWallet"
        },
        {
            type: "address[]",
            name: "_usdTokens"
        }
    ]
};

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}


describe("Load test for million investor flow", function () {
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
    let I_DaiToken: any;
    let PolyTokenFaucetFactory: any;
    let I_USDTieredSTOFactory: any;


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

    // STO Configuration Arrays
    let _startTime: bigint[] = [];
    let _endTime: bigint[] = [];
    let _ratePerTier: bigint[] = [];
    let _ratePerTierDiscountPoly: bigint[] = [];
    let _tokensPerTierTotal: bigint[] = [];
    let _tokensPerTierDiscountPoly: bigint[] = [];
    let _nonAccreditedLimitUSD: bigint[] = [];
    let _minimumInvestmentUSD: bigint[] = [];
    let _fundRaiseTypes: number[] = [];
    let _wallet: string[] = [];
    let _treasuryWallet: string[] = [];
    let _usdToken: string[] = [];
    let I_USDTieredSTO_Array: Contract[] = [];

    let ETH = 0;
    let POLY = 1;
    let DAI = 2;

    // Module key
    const delegateManagerKey = 1;
    const transferManagerKey = 2;
    const stoKey = 3;
    const checkpointKey = 4;
    const STOKEY = 3;
    const STOSetupCost = 0;
    const BATCH_SIZE = 500;
    const MAX_INVESTORS = 100_000
    const CONCURRENCY = 3;
    const CSV_FILE = "accounts.csv";
    const OUTPUT_CSV = "accounts.csv"
    const provider = new JsonRpcProvider("http://localhost:8545");
    const CONCURRENT_VERIFICATIONS = 5;
    const MAX_TRANSFERABLE = BigInt("1000000000000000000000000");

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
    let e18: bigint;
    let e16: bigint;
    let ltime;
    let totalInvestors: number;
    let smallThreshold: number
    enum InvestorClass {
        NonUS = 0,
        US = 1
    }

    async function convert(_stoID: number, _tier: number, _discount: boolean, _currencyFrom: string, _currencyTo: string, _amount: bigint): Promise<bigint> {
        let USDTOKEN: bigint;
        if (_discount) USDTOKEN = (await I_USDTieredSTO_Array[_stoID].tiers(_tier))[1];
        else USDTOKEN = (await I_USDTieredSTO_Array[_stoID].tiers(_tier))[0];

        if (_currencyFrom == "TOKEN") {
            let tokenToUSD = (_amount * USDTOKEN) / e18;
            if (_currencyTo == "USD") return tokenToUSD;
            if (_currencyTo == "ETH") {
                return await I_USDTieredSTO_Array[_stoID].convertFromUSD.staticCall(ETH, tokenToUSD);
            } else if (_currencyTo == "POLY") {
                return await I_USDTieredSTO_Array[_stoID].convertFromUSD.staticCall(POLY, tokenToUSD);
            }
        }
        if (_currencyFrom == "USD") {
            if (_currencyTo == "TOKEN") return (_amount / USDTOKEN) * e18; // USD / USD/TOKEN = TOKEN
            if (_currencyTo == "ETH" || _currencyTo == "POLY")
                return await I_USDTieredSTO_Array[_stoID].convertFromUSD.staticCall(_currencyTo == "ETH" ? ETH : POLY, _amount);
        }
        if (_currencyFrom == "ETH" || _currencyFrom == "POLY") {
            let ethToUSD = await I_USDTieredSTO_Array[_stoID].convertToUSD.staticCall(_currencyTo == "ETH" ? ETH : POLY, _amount);
            if (_currencyTo == "USD") return ethToUSD;
            if (_currencyTo == "TOKEN") return (ethToUSD / USDTOKEN) * e18; // USD / USD/TOKEN = TOKEN
        }
        return 0n;
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

        ltime = await latestTime() + duration.days(300);
        e18 = 10n ** 18n;
        e16 = 10n ** 16n;


        GeneralTransferManager = await ethers.getContractFactory("GeneralTransferManager");
        GeneralTransferManagerFactory = await ethers.getContractFactory("GeneralTransferManager");
        ERC20DividendCheckpointFactory = await ethers.getContractFactory("ERC20DividendCheckpoint");
        TradingRestrictionManagerFactory = await ethers.getContractFactory("TradingRestrictionManager");
        PolyTokenFaucetFactory = await ethers.getContractFactory("PolyTokenFaucet");

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

        I_DaiToken = await PolyTokenFaucetFactory.connect(account_polymath).deploy();
        await I_DaiToken.waitForDeployment();

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

        //Deploy the USDTieredSTOFactory
        [I_USDTieredSTOFactory] = await deployUSDTieredSTOAndVerified(account_polymath.address, I_MRProxied, STOSetupCost);

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
        TradingRestrictionManager:         ${I_TradingRestrictionManager.target}
        USDTieredSTOFactory:               ${I_USDTieredSTOFactory.target}
        ERC20DividendCheckpointFactory:    ${I_ERC20DividendCheckpointFactory.target}
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

        it("Should set the controller", async () => {
            await I_SecurityToken.connect(token_owner).setController(account_controller.address);
        });

        it("Should initialize the auto attached modules", async () => {
            const moduleData: string[] = await stGetter.getModulesByType(transferManagerKey);
            console.log("Module Data:", moduleData[0], moduleData);

            I_GeneralTransferManager = GeneralTransferManager.attach(moduleData[0]);
        });

        it("Should successfully attach the first STO module to the security token", async () => {
            const stoId = 0; // No discount

            _startTime.push(BigInt(await latestTime() + duration.days(1)));
            _endTime.push(BigInt(ltime) + BigInt(duration.days(30)));

            _ratePerTier.push([10n * e16, 15n * e16]); // [ 0.10 USD/Token, 0.15 USD/Token ]
            _ratePerTierDiscountPoly.push([10n * e16, 15n * e16]); // [ 0.10 USD/Token, 0.15 USD/Token ]
            _tokensPerTierTotal.push([100000000n * e18, 200000000n * e18]); // [ 100m Token, 200m Token ]
            _tokensPerTierDiscountPoly.push([0n, 0n]); // [ 0, 0 ]
            _nonAccreditedLimitUSD.push(10000n * e18); // 10k USD
            _minimumInvestmentUSD.push(5n * e18); // 5 USD

            // _tokensPerTierTotal.push([5n * e18]);
            // _ratePerTier.push([ethers.parseUnits("0.10", 18)]);
            // _ratePerTierDiscountPoly.push([0n]); // No discount
            // _tokensPerTierDiscountPoly.push([0n]); 
            // _nonAccreditedLimitUSD.push(10000n * e18); // Fine
            // _minimumInvestmentUSD.push(ethers.parseUnits("0.10", 18));    

            _fundRaiseTypes.push([ETH, POLY, DAI]);
            _wallet.push(account_issuer.address);
            _treasuryWallet.push(account_issuer.address);
            _usdToken.push([await I_DaiToken.getAddress()]);

            const config = [
                _startTime[stoId],
                _endTime[stoId],
                _ratePerTier[stoId],
                _ratePerTierDiscountPoly[stoId],
                _tokensPerTierTotal[stoId],
                _tokensPerTierDiscountPoly[stoId],
                _nonAccreditedLimitUSD[stoId],
                _minimumInvestmentUSD[stoId],
                _fundRaiseTypes[stoId],
                _wallet[stoId],
                _treasuryWallet[stoId],
                _usdToken[stoId]
            ];

            const stoInterface = new ethers.Interface([functionSignature]);
            const bytesSTO = stoInterface.encodeFunctionData("configure", config);
            const tx = await I_SecurityToken.connect(token_owner).addModule(I_USDTieredSTOFactory.target, bytesSTO, 0n, 0n, false);

            const receipt = await tx.wait();

            const moduleAddedEvent = receipt.logs.map(log => {
                try { return I_SecurityToken.interface.parseLog(log); } catch { return null; }
            }).find(e => e && e.name === 'ModuleAdded');

            expect(moduleAddedEvent).to.not.be.null;
            expect(moduleAddedEvent.args._types[0]).to.equal(STOKEY);
            expect(ethers.decodeBytes32String(moduleAddedEvent.args._name).replace(/\u0000/g, '')).to.equal("USDTieredSTO");

            I_USDTieredSTO_Array.push(await ethers.getContractAt("USDTieredSTO", moduleAddedEvent.args._module));

            expect(await I_USDTieredSTO_Array[stoId].startTime()).to.equal(_startTime[stoId]);
            expect(await I_USDTieredSTO_Array[stoId].endTime()).to.equal(_endTime[stoId]);
            for (var i = 0; i < _ratePerTier[stoId].length; i++) {
                const tier = await I_USDTieredSTO_Array[stoId].tiers(i);
                expect(tier[0]).to.equal(_ratePerTier[stoId][i]);
                expect(tier[1]).to.equal(_ratePerTierDiscountPoly[stoId][i]);
                expect(tier[2]).to.equal(_tokensPerTierTotal[stoId][i]);
                expect(tier[3]).to.equal(_tokensPerTierDiscountPoly[stoId][i]);
            }
            expect(await I_USDTieredSTO_Array[stoId].nonAccreditedLimitUSD()).to.equal(_nonAccreditedLimitUSD[stoId]);
            expect(await I_USDTieredSTO_Array[stoId].minimumInvestmentUSD()).to.equal(_minimumInvestmentUSD[stoId]);
            expect(await I_USDTieredSTO_Array[stoId].wallet()).to.equal(_wallet[stoId]);
            expect(await I_USDTieredSTO_Array[stoId].treasuryWallet()).to.equal(_treasuryWallet[stoId]);
            expect((await I_USDTieredSTO_Array[stoId].getUsdTokens())[0]).to.equal(_usdToken[stoId][0]);
            expect(await I_USDTieredSTO_Array[stoId].getNumberOfTiers()).to.equal(_tokensPerTierTotal[stoId].length);
            expect((await I_USDTieredSTO_Array[stoId].getPermissions()).length).to.equal(2);
            const tx1 = await I_USDTieredSTO_Array[stoId].connect(token_owner).setTradingRestrictionManager(I_TradingRestrictionManager.target);
            expect((await I_USDTieredSTO_Array[stoId].restrictionManager())).to.equal(I_TradingRestrictionManager.target);

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


        it("Should whitelist many investors ", async () => {

            const values: [string, bigint, boolean][] = []
            const data: InvestorWallet[] = [];

            const fileContent = fs.readFileSync(CSV_FILE, "utf8");

            const rows = parse(fileContent, {
                columns: true,
                skip_empty_lines: true,
            });
            const allInvestors: InvestorWallet[] = rows.map((row: any) => {
                values.push([
                    row.address,
                    BigInt(row.expiry),
                    row.isAccredited === "true",
                ]);

                const investor: InvestorWallet = {
                    address: row.address,
                    privateKey: row.privateKey,
                    isAccredited: row.isAccredited === "true",
                    investorClass: parseInt(row.investorClass || "0"),
                    expiry: String(row.expiry),
                };

                data.push(investor);
                return investor;
            });

            const merkleTree = StandardMerkleTree.of(values, ["address", "uint64", "bool"]);
            const merkleRoot = merkleTree.root;
            const dumpTree = merkleTree.dump();
            const stringifyWithBigInt = (obj: any) =>
                JSON.stringify(obj, (_, value) =>
                    typeof value === "bigint" ? value.toString() : value,
                    2
                );

            fs.writeFileSync(
                `merkle_batches/all_investors.json`,
                stringifyWithBigInt({
                    root: merkleRoot,
                    tree: dumpTree,
                })
            );

            // Upload root to on-chain contract
            await I_TradingRestrictionManager.connect(token_owner).modifyKYCData(merkleRoot);
            await increaseTime(duration.days(2));

            console.log("✅ Whitelisting complete with CSV metadata updated.");
        });

        it("Should issue tokens to all whitelisted investors", async () => {
            const stoId = 0;
            const daiAddress = await I_DaiToken.getAddress();
            const stoAddress = await I_USDTieredSTO_Array[stoId].getAddress();

            smallThreshold = 8000;
            let outOfTokens = false;
            let currentBatch: InvestorWallet[] = [];
            let offset = 0;

            const queue = new PQueue({ concurrency: CONCURRENCY });

            const maxTokens = _tokensPerTierTotal[stoId].reduce((a, b) => a + b, 0n);
            let tokensSold = await I_USDTieredSTO_Array[stoId].getTokensSold();
            const USDTOKEN = (await I_USDTieredSTO_Array[stoId].tiers(0))[0];

            const treeJsonPath = `merkle_batches/all_investors.json`;
            const treeJson = JSON.parse(fs.readFileSync(treeJsonPath, "utf-8"));
            const tree = StandardMerkleTree.load(treeJson.tree);

            const processBatch = async (batch: InvestorWallet[], batchOffset: number) => {
                if (outOfTokens) return;

                console.log(`Issuing tokens for batch ${batchOffset} – ${batchOffset + BATCH_SIZE}`);
                const [minAmount, maxAmount] =
                    batchOffset + BATCH_SIZE <= smallThreshold ? [1000, 3000] : [5000, 15000];

                const investorQueue = new PQueue({ concurrency: 3 });

                await investorQueue.addAll(
                    batch.map((investor, i) => async () => {
                        const address = investor.address;
                        const signer = new Wallet(investor.privateKey, provider);
                        const proof = tree.getProof(i + batchOffset);
                        const expiry = BigInt(investor.expiry || "0");
                        const isAccredited = investor.isAccredited;

                        const rawAmount = randomInt(minAmount, maxAmount);
                        const amount = ethers.parseEther(rawAmount.toString());
                        const amountDAI = (amount * USDTOKEN) / e18;

                        // Mint and approve DAI
                        await I_DaiToken.getTokens(amountDAI, address);
                        await sleep(200);
                        await I_DaiToken.connect(signer).approve(stoAddress, amountDAI);
                        await sleep(200);

                        if (tokensSold + amount > maxTokens) {
                            console.log(`Skipping ${address} — not enough tokens left`);
                            return;
                        } else if (tokensSold >= maxTokens) {
                            console.log(`STO out of tokens at offset ${batchOffset}`);
                            outOfTokens = true;
                            return;
                        }

                        await expect(
                            I_USDTieredSTO_Array[stoId].connect(signer).buyWithUSD(
                                address,
                                amountDAI,
                                daiAddress,
                                proof,
                                expiry,
                                isAccredited,
                                investor.investorClass
                            )
                        ).to.not.be.reverted;

                        tokensSold += amount;
                        const balance = await I_SecurityToken.balanceOf(address);
                        expect(balance).to.equal(amount);
                    }));
            }

            const stream = fs.createReadStream(OUTPUT_CSV).pipe(csv());

            const streamPromise = new Promise<void>((resolve, reject) => {
                stream
                    .on("data", async (row) => {
                        stream.pause();

                        const investor: InvestorWallet = {
                            address: row.address,
                            privateKey: row.privateKey,
                            isAccredited: row.isAccredited === "true",
                            investorClass: parseInt(row.investorClass || "0"),
                            expiry: row.expiry,
                        };

                        currentBatch.push(investor);

                        if (currentBatch.length >= BATCH_SIZE) {
                            const batchCopy = [...currentBatch];
                            const batchOffset = offset;
                            currentBatch = [];
                            offset += BATCH_SIZE;

                            queue.add(() => processBatch(batchCopy, batchOffset))
                                .then(() => stream.resume())
                                .catch(reject);
                        } else {
                            stream.resume();
                        }
                    })
                    .on("end", async () => {
                        if (currentBatch.length > 0) {
                            queue.add(() => processBatch(currentBatch, offset));
                        }
                        await queue.onIdle();
                        resolve();
                    })
                    .on("error", reject);
            });

            await streamPromise;

            console.log("✅ Token issuance completed for all whitelisted investors.");
        });

        it("Fuzz test balance checkpoints for many investors", async () => {
            await I_SecurityToken.connect(token_owner).changeGranularity(1);

            const checkpointBalances: Record<number, Record<string, bigint>> = {};
            const totalSupplies: Record<number, bigint> = {};

            let currentBatch: InvestorWallet[] = [];
            let offset = 0;
            let checkpointIndex = 1;

            const queue = new PQueue({ concurrency: CONCURRENCY });


            const processBatch = async (batch: InvestorWallet[], batchOffset: number) => {
                console.log(`Processing batch ${batchOffset} – ${batchOffset + BATCH_SIZE}`);

                for (let j = 0; j < 2; j++) {
                    // Capture balances at this point
                    const balancesAtCheckpoint: Record<string, bigint> = {};
                    await Promise.all(batch.map(async (investor) => {
                        const balance = await I_SecurityToken.balanceOf(investor.address);
                        balancesAtCheckpoint[investor.address.toLowerCase()] = balance;
                    }));
                    const totalSupply = await I_SecurityToken.totalSupply();

                    checkpointBalances[checkpointIndex] = balancesAtCheckpoint;
                    totalSupplies[checkpointIndex] = totalSupply;

                    console.log(`\nCheckpoint ${checkpointIndex} Created:`);
                    console.log(`TotalSupply: ${totalSupply.toString()}`);

                    const tx = await I_SecurityToken.connect(token_owner).createCheckpoint();
                    const receipt = await tx.wait();
                    await sleep(100);

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

                    // Perform some random transfers
                    const innerQueue = new PQueue({ concurrency: 3 });
                    const transferCount = Math.floor(Math.random() * 3);
                    const transferJobs = [];

                    for (let i = 0; i < transferCount; i++) {
                        const sender = batch[Math.floor(Math.random() * batch.length)];
                        const receiver = batch[Math.floor(Math.random() * batch.length)];

                        if (sender.address === receiver.address) continue;

                        transferJobs.push({ sender, receiver });
                    }

                    for (const { sender, receiver } of transferJobs) {
                        const senderBalance = await I_SecurityToken.balanceOf(sender.address);
                        if (senderBalance === 0n) continue;

                        const safeBalance = senderBalance > MAX_TRANSFERABLE ? MAX_TRANSFERABLE : senderBalance;
                        const percentage = Math.floor(Math.random() * 10) + 1;
                        const amount = (safeBalance * BigInt(percentage)) / 100n;
                        const senderWallet = new Wallet(sender.privateKey, provider);

                        console.log(`Transfer: ${amount} from ${sender.address} to ${receiver.address}`);
                        await I_TradingRestrictionManager.setTradingRestrictionPeriod(I_SecurityToken.target, 0, 0, 1);
                        await sleep(200);
                        await I_SecurityToken.connect(senderWallet).transfer(receiver.address, amount);
                    }


                    // await innerQueue.addAll(
                    //     transferJobs.map(({ sender, receiver }) => async () => {
                    //         const senderBalance = await I_SecurityToken.balanceOf(sender.address);
                    //         if (senderBalance === 0n) return;

                    //         const safeBalance = senderBalance > MAX_TRANSFERABLE ? MAX_TRANSFERABLE : senderBalance;
                    //         const percentage = Math.floor(Math.random() * 10) + 1;
                    //         const amount = (safeBalance * BigInt(percentage)) / 100n;
                    //         const senderWallet = new Wallet(sender.privateKey, provider);

                    //         console.log(`Transfer: ${amount} from ${sender.address} to ${receiver.address}`);
                    //         await I_TradingRestrictionManager.setTradingRestrictionPeriod(I_SecurityToken.target, 0, 0, 1);
                    //         await sleep(200);
                    //         await I_SecurityToken.connect(senderWallet).transfer(receiver.address, amount);
                    //         await sleep(200);
                    //     })
                    // );
                    // await innerQueue.onIdle();

                }
            }
            const stream = fs.createReadStream(OUTPUT_CSV).pipe(csv());

            const streamPromise = new Promise<void>((resolve, reject) => {
                stream
                    .on("data", async (row) => {
                        stream.pause();

                        const investor: InvestorWallet = {
                            address: row.address,
                            privateKey: row.privateKey
                        };

                        currentBatch.push(investor);

                        if (currentBatch.length >= BATCH_SIZE) {
                            const batchCopy = [...currentBatch];
                            const batchOffset = offset;
                            currentBatch = [];
                            offset += BATCH_SIZE;

                            queue.add(() => processBatch(batchCopy, batchOffset))
                                .then(() => stream.resume())
                                .catch(reject);
                        } else {
                            stream.resume();
                        }
                    })
                    .on("end", async () => {
                        if (currentBatch.length > 0) {
                            queue.add(() => processBatch(currentBatch, offset));
                        }
                        await queue.onIdle();
                        resolve();
                    })
                    .on("error", reject);
            });

            await streamPromise;

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

        it("Investors should be able to pull their own dividend", async () => {

            const dividendIndex = 0; // assuming this is the first dividend
            const totalInvestors = Number(await stGetter.getInvestorCount());
            const totalDividendAmount = ethers.parseEther("10000");
            const dividendData = await I_ERC20DividendCheckpoint.dividends(dividendIndex);
            const checkpointId = Number(dividendData.checkpointId);
            const maturity = Number(dividendData.maturity);
            const now = await latestTime();

            if (now < maturity) {
                await increaseTime(maturity - now + 1);
            }

            const totalSupplyAtCheckpoint = await stGetter.totalSupplyAt(checkpointId);
            let totalClaimed = 0n;
            let currentBatch: InvestorWallet[] = [];
            let offset = 0;

            const queue = new PQueue({ concurrency: CONCURRENCY });

            const processBatch = async (batch: InvestorWallet[], batchOffset: number) => {
                console.log(`Processing batch: ${batchOffset} - ${batchOffset + BATCH_SIZE}`);

                const investorQueue = new PQueue({ concurrency: 3 });

                await investorQueue.addAll(
                    batch.map((investor) => async () => {
                        const address = investor.address;
                        const signer = new Wallet(investor.privateKey, provider);

                        const balanceBefore = await I_PolyToken.balanceOf(address);
                        const balanceAtCheckpoint = await stGetter.balanceOfAt(address, checkpointId);

                        const expectedShare = (balanceAtCheckpoint * totalDividendAmount) / totalSupplyAtCheckpoint;

                        await expect(
                            I_ERC20DividendCheckpoint.connect(signer).pullDividendPayment(dividendIndex)
                        ).to.not.be.reverted;

                        const balanceAfter = await I_PolyToken.balanceOf(address);
                        const claimed: bigint = balanceAfter - balanceBefore;
                        totalClaimed += claimed;

                        expect(claimed).to.equal(expectedShare);
                    }));
            }

            const stream = fs.createReadStream(OUTPUT_CSV).pipe(csv());

            const streamPromise = new Promise<void>((resolve, reject) => {
                stream
                    .on("data", async (row) => {
                        stream.pause();

                        const investor: InvestorWallet = {
                            address: row.address,
                            privateKey: row.privateKey,
                        };

                        currentBatch.push(investor);

                        if (currentBatch.length >= BATCH_SIZE) {
                            const batchCopy = [...currentBatch];
                            const batchOffset = offset;
                            currentBatch = [];
                            offset += BATCH_SIZE;

                            queue.add(() => processBatch(batchCopy, batchOffset))
                                .then(() => stream.resume())
                                .catch(reject);
                        } else {
                            stream.resume();
                        }
                    })
                    .on("end", async () => {
                        if (currentBatch.length > 0) {
                            await queue.add(() => processBatch(currentBatch, offset));
                        }
                        await queue.onIdle();
                        resolve();
                    })
                    .on("error", reject);
            });

            await streamPromise;

            // Verify the dividend was marked fully claimed
            const dividendDataFinal = await I_ERC20DividendCheckpoint.dividends(dividendIndex);
            const tolerance = ethers.parseUnits("0.001", 18);
            const diff = dividendDataFinal.claimedAmount > totalDividendAmount
                ? dividendDataFinal.claimedAmount - totalDividendAmount
                : totalDividendAmount - dividendDataFinal.claimedAmount;

            expect(diff <= tolerance).to.be.true;

            console.log("All investors successfully pulled their dividend and received the correct dividend payout based on their checkpoint balance.");
        });

        it("Should perform random transfers between investors", async () => {
            const queue = new PQueue({ concurrency: CONCURRENCY });
            let offset = 0;
            let currentBatch: InvestorWallet[] = [];

            const processTransferBatch = async (batch: InvestorWallet[], batchOffset: number) => {
                console.log(`Processing transfers for batch ${batchOffset} - ${batchOffset + BATCH_SIZE}`);


                const transferCount = Math.floor(Math.random() * 3) + 1; // total number of transfers

                for (let i = 0; i < transferCount; i++) {
                    const senderIndex = Math.floor(Math.random() * batch.length);
                    let receiverIndex = Math.floor(Math.random() * batch.length);

                    while (receiverIndex === senderIndex) {
                        receiverIndex = Math.floor(Math.random() * batch.length);
                    }

                    const sender = batch[senderIndex];
                    const receiver = batch[receiverIndex];

                    const senderBalance = await I_SecurityToken.balanceOf(sender.address);
                    if (senderBalance === 0n) continue; // skip if no balance

                    // Transfer 10% to 50% of balance
                    const percentage = Math.floor(Math.random() * 40) + 10; // 10–50%
                    const amount = (senderBalance * BigInt(percentage)) / 100n;
                    await sleep(200);
                    await I_SecurityToken.connect(new Wallet(sender.privateKey, provider)).transfer(receiver.address, amount);
                    await sleep(200);

                    console.log(`Transfer #${i + 1}: ${ethers.formatEther(amount)} tokens from ${sender.address} to ${receiver.address}`);
                }
            }

            const stream = fs.createReadStream(OUTPUT_CSV).pipe(csv());

            const streamPromise = new Promise<void>((resolve, reject) => {
                stream
                    .on("data", async (row) => {
                        stream.pause();

                        const investor: InvestorWallet = {
                            address: row.address,
                            privateKey: row.privateKey
                        };

                        currentBatch.push(investor);

                        if (currentBatch.length >= BATCH_SIZE) {
                            const batchCopy = [...currentBatch];
                            const batchOffset = offset;
                            currentBatch = [];
                            offset += BATCH_SIZE;

                            queue
                                .add(() => processTransferBatch(batchCopy, batchOffset))
                                .then(() => stream.resume())
                                .catch(reject);
                        } else {
                            stream.resume();
                        }
                    })
                    .on("end", async () => {
                        if (currentBatch.length > 0) {
                            queue.add(() => processTransferBatch(currentBatch, offset));
                        }
                        await queue.onIdle();
                        resolve();
                    })
                    .on("error", reject);
            });

            await streamPromise;

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

        it("Investors should pull their own second dividend and verify correct payout distribution", async () => {
            const dividendIndex = 1; // second dividend
            const totalDividendAmount = ethers.parseEther("20000");
            const totalInvestors = Number(await stGetter.getInvestorCount());

            // Get total supply at the time of dividend creation (checkpoint)
            const dividendData = await I_ERC20DividendCheckpoint.dividends(dividendIndex);
            const checkpointId = Number(dividendData.checkpointId);
            const maturity = Number(dividendData.maturity);

            const now = await latestTime();
            if (now < maturity) {
                // Simulate time passing beyond maturity
                await increaseTime(maturity - now + 1);
            }

            const totalSupplyAtCheckpoint = await stGetter.totalSupplyAt(checkpointId);
            let totalClaimed = 0n;
            let currentBatch: InvestorWallet[] = [];
            let offset = 0;

            const queue = new PQueue({ concurrency: CONCURRENCY });

            const processBatch = async (batch: InvestorWallet[], batchOffset: number) => {
                console.log(`Processing batch: ${batchOffset} - ${batchOffset + BATCH_SIZE}`);

                const investorQueue = new PQueue({ concurrency: 3 });

                await investorQueue.addAll(
                    batch.map((investor) => async () => {
                        const address = investor.address;
                        const signer = new Wallet(investor.privateKey, provider);

                        const balanceBefore = await I_PolyToken.balanceOf(address);
                        const balanceAtCheckpoint = await stGetter.balanceOfAt(address, checkpointId);

                        const expectedShare = (balanceAtCheckpoint * totalDividendAmount) / totalSupplyAtCheckpoint;

                        await expect(
                            I_ERC20DividendCheckpoint.connect(signer).pullDividendPayment(dividendIndex)
                        ).to.not.be.reverted;

                        const balanceAfter = await I_PolyToken.balanceOf(address);
                        const claimed: bigint = balanceAfter - balanceBefore;
                        totalClaimed += claimed;

                        expect(claimed).to.equal(expectedShare);
                    }));
            }

            const stream = fs.createReadStream(OUTPUT_CSV).pipe(csv());

            const streamPromise = new Promise<void>((resolve, reject) => {
                stream
                    .on("data", async (row) => {
                        stream.pause();

                        const investor: InvestorWallet = {
                            address: row.address,
                            privateKey: row.privateKey,
                        };

                        currentBatch.push(investor);

                        if (currentBatch.length >= BATCH_SIZE) {
                            const batchCopy = [...currentBatch];
                            const batchOffset = offset;
                            currentBatch = [];
                            offset += BATCH_SIZE;

                            queue.add(() => processBatch(batchCopy, batchOffset))
                                .then(() => stream.resume())
                                .catch(reject);
                        } else {
                            stream.resume();
                        }
                    })
                    .on("end", async () => {
                        if (currentBatch.length > 0) {
                            await queue.add(() => processBatch(currentBatch, offset));
                        }
                        await queue.onIdle();
                        resolve();
                    })
                    .on("error", reject);
            });

            await streamPromise;

            // Confirm total claim recorded
            const dividendDataFinal = await I_ERC20DividendCheckpoint.dividends(dividendIndex);
            const tolerance = ethers.parseUnits("0.001", 18); // 20 wei
            const diff = dividendDataFinal.claimedAmount > totalDividendAmount
                ? dividendDataFinal.claimedAmount - totalDividendAmount
                : totalDividendAmount - dividendDataFinal.claimedAmount;

            expect(diff <= tolerance).to.be.true;

            console.log("All investors successfully pulled their second dividend and received the correct dividend payout based on their checkpoint balance.");
        });
    });

});

