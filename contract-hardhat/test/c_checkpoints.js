const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = require("ethers");

// Import helper functions (you'll need to adapt these to work with Hardhat/ethers)
const { latestTime } = require("./helpers/latestTime");
const { duration, ensureException, promisifyLogWatch, latestBlock } = require("./helpers/utils");
const { takeSnapshot, increaseTime, revertToSnapshot } = require("./helpers/time");
const { setUpPolymathNetwork } = require("./helpers/createInstances");
const { catchRevert } = require("./helpers/exceptions");
// const { initializeContracts } = require("../scripts/polymath-deploy");

describe("Checkpoints", function() {
    // Accounts Variable declaration
    let account_polymath;
    let account_issuer;
    let token_owner;
    let account_investor1;
    let account_investor2;
    let account_investor3;
    let account_investor4;
    let account_controller;
    let accounts;

    let message = "Transaction Should Fail!";

    // investor Details
    let fromTime;
    let toTime;
    let expiryTime;

    // Contract Instance Declaration
    let I_GeneralPermissionManagerFactory;
    let I_SecurityTokenRegistryProxy;
    let I_GeneralTransferManagerFactory;
    let I_GeneralPermissionManager;
    let I_GeneralTransferManager;
    let I_ExchangeTransferManager;
    let I_STRProxied;
    let I_MRProxied;
    let I_ModuleRegistry;
    let I_ModuleRegistryProxy;
    let I_FeatureRegistry;
    let I_SecurityTokenRegistry;
    let I_STFactory;
    let I_SecurityToken;
    let I_PolyToken;
    let I_PolymathRegistry;
    let I_STRGetter;
    let I_STGetter;
    let stGetter;

    // Contract factories
    let SecurityToken;
    let GeneralTransferManager;
    let STGetter;

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

    // Initial fee for ticker registry and security token registry
    const initRegFee = ethers.parseEther("1000");

    before(async () => {

        // const contract = await initializeContracts();
        // Get signers
        accounts = await ethers.getSigners();
        
        fromTime = await latestTime();
        toTime = await latestTime();
        expiryTime = toTime + duration.days(15);
        
        // Accounts setup
        account_polymath = accounts[0];
        account_issuer = accounts[1];
        token_owner = account_issuer;
        account_controller = accounts[3];
        account_investor1 = accounts[6];
        account_investor2 = accounts[7];
        account_investor3 = accounts[8];
        account_investor4 = accounts[9];
        
        console.log(token_owner.address, "token_owner.address");
        // const TokenLibFactory = await ethers.getContractFactory("TokenLib");
        // const tokenLib = await TokenLibFactory.deploy();
        // await tokenLib.waitForDeployment();

        // SecurityToken = await ethers.getContractFactory("SecurityToken", {
        // libraries: {
        //     TokenLib: await tokenLib.getAddress(),
        // },
        // });

        // STGetter = await ethers.getContractFactory("STGetter", {
        // libraries: {
        //     TokenLib: await tokenLib.getAddress(),
        // },
        // });

        GeneralTransferManager = await ethers.getContractFactory("GeneralTransferManager");

        // Step 1: Deploy the general PM ecosystem
        let instances = await setUpPolymathNetwork(account_polymath.address, token_owner.address);

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

    describe("Generate the SecurityToken", async () => {
        it("Should register the ticker before the generation of the security token", async () => {
            await I_PolyToken.connect(token_owner).approve(I_STRProxied.target, initRegFee);
            let tx = await I_STRProxied.connect(token_owner).registerNewTicker(token_owner.address, symbol);

            const receipt = await tx.wait();
            const fullReceipt = await ethers.provider.getTransactionReceipt(receipt.hash);
        
        const logs = fullReceipt.logs.filter(log => 
            log.address.toLowerCase() === I_STRProxied.target.toLowerCase()
        );
        
        let eventFound = false;
        for (const log of logs) {
            try {
                const parsed = I_STRProxied.interface.parseLog(log);
                
                if (parsed.name === "RegisterTicker") { 
                    expect(parsed.args._owner).to.equal(token_owner.address);
                    expect(parsed.args._ticker).to.equal(symbol.toUpperCase());
                    eventFound = true;
                    break;
                }
            } catch (err) {
                console.log(`Failed to parse log: ${err.message}`);
            }
        }
        
        expect(eventFound).to.be.true;
        
        });

        it("Should generate the new security token with the same symbol as registered above", async () => {
            await I_PolyToken.connect(token_owner).approve(I_STRProxied.target, initRegFee);

            console.log("after no errors");
            console.log(name, symbol, tokenDetails, false, token_owner.address, "details");

            let tx = await I_STRProxied.connect(token_owner).generateNewSecurityToken(
                name,
                symbol,
                tokenDetails,
                false,
                token_owner.address,
                0
            );
            console.log("Generating the new security token with the symbol:", tx);

            // Wait for transaction and get receipt
            const receipt = await tx.wait();
            const securityTokenEvent = receipt.events?.find(e => e.event === 'NewSecurityToken');
            
            // Verify the successful generation of the security token
            expect(securityTokenEvent.args._ticker).to.equal(symbol.toUpperCase(), "SecurityToken doesn't get deployed");

            I_SecurityToken = SecurityToken.attach(securityTokenEvent.args._securityTokenAddress);
            stGetter = STGetter.attach(I_SecurityToken.address);
            
            // Get ModuleAdded events from the transaction
            const moduleAddedEvents = receipt.events?.filter(e => e.event === 'ModuleAdded');
            const moduleEvent = moduleAddedEvents?.[0];

            // Verify that GeneralTransferManager module get added successfully or not
            expect(moduleEvent.args._types[0]).to.equal(2);
            expect(ethers.utils.parseBytes32String(moduleEvent.args._name).replace(/\0/g, "")).to.equal("GeneralTransferManager");
        });

        it("Should set the controller", async() => {
            await I_SecurityToken.connect(token_owner).setController(account_controller.address);
        });

        it("Should initialize the auto attached modules", async () => {
            let moduleData = (await stGetter.getModulesByType(2))[0];
            I_GeneralTransferManager = GeneralTransferManager.attach(moduleData);
        });
    });

    describe("Buy tokens using on-chain whitelist", async () => {
        it("Should Buy the tokens", async () => {
            // Add the Investor in to the whitelist
            let ltime = BigNumber.from(await latestTime());
            let tx = await I_GeneralTransferManager.connect(account_issuer).modifyKYCData(
                account_investor1.address,
                ltime,
                ltime,
                ltime.add(BigNumber.from(duration.days(10))),
                {
                    gasLimit: 6000000
                }
            );
            
            const receipt = await tx.wait();
            const event = receipt.events?.find(e => e.event === 'ModifyKYCData');
            
            expect(event.args._investor.toLowerCase()).to.equal(
                account_investor1.address.toLowerCase(),
                "Failed in adding the investor in whitelist"
            );

            // Mint some tokens
            await I_SecurityToken.connect(token_owner).issue(
                account_investor1.address, 
                ethers.utils.parseEther("10"), 
                "0x0"
            );

            expect(await I_SecurityToken.balanceOf(account_investor1.address)).to.equal(ethers.utils.parseEther("10"));
        });

        it("Should Buy some more tokens", async () => {
            // Add the Investor in to the whitelist
            let ltime = BigNumber.from(await latestTime());
            let tx = await I_GeneralTransferManager.connect(account_issuer).modifyKYCData(
                account_investor2.address,
                ltime,
                ltime,
                ltime.add(BigNumber.from(duration.days(10))),
                {
                    gasLimit: 6000000
                }
            );

            const receipt = await tx.wait();
            const event = receipt.events?.find(e => e.event === 'ModifyKYCData');

            expect(event.args._investor.toLowerCase()).to.equal(
                account_investor2.address.toLowerCase(),
                "Failed in adding the investor in whitelist"
            );

            // Mint some tokens
            await I_SecurityToken.connect(token_owner).issue(
                account_investor2.address, 
                ethers.utils.parseEther("10"), 
                "0x0"
            );

            expect(await I_SecurityToken.balanceOf(account_investor2.address)).to.equal(ethers.utils.parseEther("10"));
        });

        it("Add a new token holder", async () => {
            let ltime = BigNumber.from(await latestTime());
            let tx = await I_GeneralTransferManager.connect(account_issuer).modifyKYCData(
                account_investor3.address,
                ltime,
                ltime,
                ltime.add(BigNumber.from(duration.days(10))),
                {
                    gasLimit: 6000000
                }
            );

            const receipt = await tx.wait();
            const event = receipt.events?.find(e => e.event === 'ModifyKYCData');

            expect(event.args._investor.toLowerCase()).to.equal(
                account_investor3.address.toLowerCase(),
                "Failed in adding the investor in whitelist"
            );

            // Mint some tokens
            await I_SecurityToken.connect(token_owner).issue(
                account_investor3.address, 
                ethers.utils.parseEther("10"), 
                "0x0"
            );

            expect(await I_SecurityToken.balanceOf(account_investor3.address)).to.equal(ethers.utils.parseEther("10"));
        });

        it("Fuzz test balance checkpoints", async () => {
            await I_SecurityToken.connect(token_owner).changeGranularity(1);
            let cps = [];
            let ts = [];
            
            for (let j = 0; j < 10; j++) {
                let balance1 = await I_SecurityToken.balanceOf(account_investor1.address);
                let balance2 = await I_SecurityToken.balanceOf(account_investor2.address);
                let balance3 = await I_SecurityToken.balanceOf(account_investor3.address);
                let totalSupply = await I_SecurityToken.totalSupply();
                
                cps.push([balance1, balance2, balance3]);
                ts.push(totalSupply);
                
                console.log(
                    "Checkpoint: " +
                        (j + 1) +
                        " Balances: " +
                        JSON.stringify(cps[cps.length - 1]) +
                        " TotalSupply: " +
                        JSON.stringify(totalSupply)
                );
                
                let investorLength = await stGetter.getInvestorCount();
                let tx = await I_SecurityToken.connect(token_owner).createCheckpoint();
                const receipt = await tx.wait();
                const event = receipt.events?.find(e => e.event === 'CheckpointCreated');
                
                expect(event.args[1]).to.equal(investorLength);
                
                let checkpointTimes = await stGetter.getCheckpointTimes();
                expect(checkpointTimes.length).to.equal(j + 1);
                console.log("Checkpoint Times: " + checkpointTimes);
                
                let txs = Math.floor(Math.random() * 3);
                for (let i = 0; i < txs; i++) {
                    let sender;
                    let receiver;
                    let s = Math.random() * 3;
                    if (s < 1) {
                        sender = account_investor1;
                    } else if (s < 2) {
                        sender = account_investor2;
                    } else {
                        sender = account_investor3;
                    }
                    let r = Math.random() * 3;
                    if (r < 1) {
                        receiver = account_investor1;
                    } else if (r < 2) {
                        receiver = account_investor2;
                    } else {
                        receiver = account_investor3;
                    }
                    let m = Math.floor(Math.random() * 10) + 1;
                    let amount;
                    if (m > 8) {
                        console.log("Sending full balance");
                        amount = await I_SecurityToken.balanceOf(sender.address);
                    } else {
                        let senderBalance = await I_SecurityToken.balanceOf(sender.address);
                        amount = senderBalance.mul(BigNumber.from(m)).div(BigNumber.from(10));
                    }
                    console.log("Sender: " + sender.address + " Receiver: " + receiver.address + " Amount: " + amount.toString());
                    await I_SecurityToken.connect(sender).transfer(receiver.address, amount);
                }
                
                if (Math.random() > 0.5) {
                    let n = BigNumber.from(Math.floor(Math.random() * 1000000000000000000).toString());
                    let r = Math.random() * 3;
                    let minter;
                    if (r < 1) {
                        minter = account_investor1;
                    } else if (r < 2) {
                        minter = account_investor2;
                    } else {
                        minter = account_investor3;
                    }
                    console.log("Minting: " + n.toString() + " to: " + minter.address);
                    await I_SecurityToken.connect(token_owner).issue(minter.address, n, "0x0");
                }
                
                if (Math.random() > 0.5) {
                    let n = BigNumber.from(Math.floor(Math.random() * 1000000000000000000).toString());
                    let r = Math.random() * 3;
                    let burner;
                    if (r < 1) {
                        burner = account_investor1;
                    } else if (r < 2) {
                        burner = account_investor2;
                    } else {
                        burner = account_investor3;
                    }
                    let burnerBalance = await I_SecurityToken.balanceOf(burner.address);
                    if (n.gt(burnerBalance.div(BigNumber.from(2)))) {
                        n = burnerBalance.div(BigNumber.from(2));
                    }
                    console.log("Burning: " + n.toString() + " from: " + burner.address);
                    await I_SecurityToken.connect(account_controller).controllerRedeem(burner.address, n, "0x0", "0x0");
                }
                
                console.log("Checking Interim...");
                for (let k = 0; k < cps.length; k++) {
                    let balance1 = await stGetter.balanceOfAt(account_investor1.address, k + 1);
                    let balance2 = await stGetter.balanceOfAt(account_investor2.address, k + 1);
                    let balance3 = await stGetter.balanceOfAt(account_investor3.address, k + 1);
                    let totalSupply = await stGetter.totalSupplyAt(k + 1);
                    let balances = [balance1, balance2, balance3];
                    
                    console.log("Checking TotalSupply: " + totalSupply + " is " + ts[k] + " at checkpoint: " + (k + 1));
                    expect(totalSupply).to.equal(ts[k]);
                    console.log("Checking Balances: " + balances + " is " + cps[k] + " at checkpoint: " + (k + 1));
                    
                    for (let l = 0; l < cps[k].length; l++) {
                        expect(balances[l]).to.equal(cps[k][l]);
                    }
                }
            }
            
            console.log("Checking...");
            for (let k = 0; k < cps.length; k++) {
                let balance1 = await stGetter.balanceOfAt(account_investor1.address, k + 1);
                let balance2 = await stGetter.balanceOfAt(account_investor2.address, k + 1);
                let balance3 = await stGetter.balanceOfAt(account_investor3.address, k + 1);
                let totalSupply = await stGetter.totalSupplyAt(k + 1);
                let balances = [balance1, balance2, balance3];
                
                console.log("Checking TotalSupply: " + totalSupply + " is " + ts[k] + " at checkpoint: " + (k + 1));
                expect(totalSupply).to.equal(ts[k]);
                console.log("Checking Balances: " + balances + " is " + cps[k] + " at checkpoint: " + (k + 1));
                
                for (let l = 0; l < cps[k].length; l++) {
                    expect(balances[l]).to.equal(cps[k][l]);
                }
            }
        });
    });
});