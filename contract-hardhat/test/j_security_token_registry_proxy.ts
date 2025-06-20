import { expect } from "chai";
import { ethers, network } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { Contract, LogDescription, ZeroAddress, decodeBytes32String, id } from "ethers";

import { takeSnapshot, revertToSnapshot } from "./helpers/time";
import { setUpPolymathNetwork } from "./helpers/createInstances";
import { encodeProxyCall, encodeCall } from "./helpers/encodeCall";
import { catchRevert } from "./helpers/exceptions";

describe("SecurityTokenRegistryProxy", function () {
    // Contract Instances
    let I_SecurityTokenRegistry: Contract;
    let I_SecurityTokenRegistryProxy: Contract;
    let I_GeneralTransferManagerFactory: Contract;
    let I_SecurityTokenRegistryMock: Contract;
    let I_STFactory: Contract;
    let I_PolymathRegistry: Contract;
    let I_ModuleRegistryProxy: Contract;
    let I_PolyToken: Contract;
    let I_STRProxied: Contract;
    let I_MRProxied: Contract;
    let I_SecurityToken: Contract;
    let I_ModuleRegistry: Contract;
    let I_FeatureRegistry: Contract;
    let I_STRGetter: Contract;
    let I_Getter: Contract; // Used for the upgraded proxy
    let I_STGetter: Contract;
    let stGetter: Contract;

    // Accounts
    let account_polymath: HardhatEthersSigner;
    let account_temp: HardhatEthersSigner;
    let token_owner: HardhatEthersSigner;
    let account_polymath_new: HardhatEthersSigner;
    let accounts: HardhatEthersSigner[];

    // Constants
    const initRegFee = ethers.parseEther("250");
    const initRegFeePOLY = ethers.parseEther("1000");

    // SecurityToken Details
    const name = "Team";
    const symbol = "SAP";
    const tokenDetails = "This is equity type of issuance";

    const transferManagerKey = 2;
    const address_zero = ZeroAddress;
    const STRProxyParameters = ["address", "uint256", "uint256", "address", "address"];

    async function readStorage(contractAddress: string, slot: string | number) {
        return await ethers.provider.getStorage(contractAddress, slot);
    }

    before(async () => {
        accounts = await ethers.getSigners();
        account_polymath = accounts[0];
        account_temp = accounts[1];
        token_owner = accounts[2];
        account_polymath_new = accounts[3];

        // Step 1: Deploy the Polymath ecosystem
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
            I_SecurityTokenRegistry, // This is the implementation contract
            , // Placeholder for I_SecurityTokenRegistryProxy which is deployed manually below
            I_STRProxied, // This will be reassigned after proxy setup
            I_STRGetter,
            I_STGetter
        ] = instances;

        // Manually deploy the proxy contract
        const SecurityTokenRegistryProxyFactory = await ethers.getContractFactory("SecurityTokenRegistryProxy");
        I_SecurityTokenRegistryProxy = await SecurityTokenRegistryProxyFactory.connect(account_polymath).deploy();

        // Register the proxy with the PolymathRegistry
        await I_PolymathRegistry.connect(account_polymath).changeAddress("SecurityTokenRegistry", await I_SecurityTokenRegistryProxy.getAddress());
        // Update the Module Registry to be aware of the new STR address
        await I_MRProxied.connect(account_polymath).updateFromRegistry();

        // Printing all the contract addresses
        console.log(`
         --------------------- Polymath Network Smart Contracts: ---------------------
         PolymathRegistry:                  ${await I_PolymathRegistry.getAddress()}
         SecurityTokenRegistryProxy:        ${await I_SecurityTokenRegistryProxy.getAddress()}
         SecurityTokenRegistry (Logic):     ${await I_SecurityTokenRegistry.getAddress()}

         STFactory:                         ${await I_STFactory.getAddress()}
         GeneralTransferManagerFactory:     ${await I_GeneralTransferManagerFactory.getAddress()}
         -----------------------------------------------------------------------------
         `);
    });

    describe("Attach the implementation address", async () => {
        // Storage slots for OpenZeppelin's Unstructured Storage
        const IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
        const VERSION_SLOT = "0x7050c9e0f4ca769c69bd3aa8c9c506ce90e716c1b445a7df824000e9409e884e";
        
        it("Should attach the implementation and version", async () => {
            const STRGetterFactory = await ethers.getContractFactory("STRGetter");
            I_STRGetter = await STRGetterFactory.connect(account_polymath).deploy();

            let bytesProxy = encodeProxyCall(STRProxyParameters, [
                await I_PolymathRegistry.getAddress(),
                initRegFee,
                initRegFee,
                account_polymath.address,
                await I_STRGetter.getAddress()
            ]);

            await I_SecurityTokenRegistryProxy.connect(account_polymath).upgradeToAndCall("1.0.0", await I_SecurityTokenRegistry.getAddress(), bytesProxy);
            
            const proxyAddress = await I_SecurityTokenRegistryProxy.getAddress();
            const implAddress = await readStorage(proxyAddress, IMPLEMENTATION_SLOT);
            const version = await readStorage(proxyAddress, VERSION_SLOT);
            
            // The implementation address is stored in the lower 20 bytes of the slot.
            expect(ethers.getAddress(implAddress.slice(-40))).to.equal(await I_SecurityTokenRegistry.getAddress());
            expect(decodeBytes32String(version).replace(/\u0000/g, "").replace(/\n/, "")).to.equal("1.0.0");
            
            I_STRProxied = await ethers.getContractAt("SecurityTokenRegistry", proxyAddress);
            I_STRGetter = await ethers.getContractAt("STRGetter", proxyAddress);

            await I_STRProxied.connect(account_polymath).setProtocolFactory(await I_STFactory.getAddress(), 3, 0, 0);
            await I_STRProxied.connect(account_polymath).setLatestVersion(3, 0, 0);
        });
        
        it("Verify the initialize data", async () => {
            expect(await I_STRProxied.getUintValue(id("expiryLimit"))).to.equal(60 * 24 * 60 * 60);
            expect(await I_STRProxied.getUintValue(id("tickerRegFee"))).to.equal(initRegFee);
        });
        
        it("Upgrade the proxy again and change getter", async () => {
          let snapId = await takeSnapshot();
          
          const MockSTRGetterFactory = await ethers.getContractFactory("MockSTRGetter");
          const I_MockSTRGetter = await MockSTRGetterFactory.connect(account_polymath).deploy();

          const SecurityTokenRegistryFactory = await ethers.getContractFactory("SecurityTokenRegistry");
          const I_MockSecurityTokenRegistry = await SecurityTokenRegistryFactory.connect(account_polymath).deploy();
          
          const bytesProxy = encodeCall("setGetterRegistry", ["address"], [await I_MockSTRGetter.getAddress()]);

          console.log("Getter: " + await I_MockSTRGetter.getAddress());
          console.log("Registry: " + await I_MockSecurityTokenRegistry.getAddress());
          console.log("STRProxy: " + await I_SecurityTokenRegistryProxy.getAddress());

          await I_SecurityTokenRegistryProxy.connect(account_polymath).upgradeToAndCall("2.0.0", await I_MockSecurityTokenRegistry.getAddress(), bytesProxy);
          
          const proxyAddress = await I_SecurityTokenRegistryProxy.getAddress();
          const implAddress = await readStorage(proxyAddress, IMPLEMENTATION_SLOT);
          const version = await readStorage(proxyAddress, VERSION_SLOT);
          
          expect(ethers.getAddress(implAddress.slice(-40))).to.equal(await I_MockSecurityTokenRegistry.getAddress());
          expect(decodeBytes32String(version).replace(/\u0000/g, "").replace(/\n/, "")).to.equal("2.0.0");

          const I_MockSecurityTokenRegistryProxy = await ethers.getContractAt("SecurityTokenRegistry", proxyAddress);
          const I_MockSTRGetterProxy = await ethers.getContractAt("MockSTRGetter", proxyAddress);

          await I_MockSecurityTokenRegistryProxy.connect(account_polymath).setProtocolFactory(await I_STFactory.getAddress(), 3, 1, 0);
          await I_MockSecurityTokenRegistryProxy.connect(account_polymath).setLatestVersion(3, 1, 0);

          let newValue = await I_MockSTRGetterProxy.newFunction();
          expect(newValue).to.equal(99);

          await revertToSnapshot(snapId);
        });
    });

    describe("Feed some data in storage", async () => {
        it("Register the ticker", async () => {
            await I_PolyToken.getTokens(ethers.parseEther("8000"), token_owner.address);
            await I_PolyToken.connect(token_owner).approve(await I_STRProxied.getAddress(), initRegFeePOLY);
            let tx = await I_STRProxied.connect(token_owner).registerNewTicker(token_owner.address, symbol);
            
            const receipt = await tx.wait();
            const event = receipt!.logs.map(log => {
                try { return I_STRProxied.interface.parseLog(log) } catch (e) { return null }
            }).find(e => e?.name === "RegisterTicker");

            expect(event!.args._owner).to.equal(token_owner.address, "Owner should be the same as registered with the ticker");
            expect(event!.args._ticker).to.equal(symbol, "Same as the symbol registered in the registerTicker function call");
        });

        it("Should generate the new security token with the same symbol as registered above", async () => {
            await I_PolyToken.connect(token_owner).approve(await I_STRProxied.getAddress(), initRegFeePOLY);

            let tx = await I_STRProxied.connect(token_owner).generateNewSecurityToken(name, symbol, tokenDetails, false, token_owner.address, 0);
            const receipt = await tx.wait();

            // Verify the successful generation of the security token
            const newSTEvent = receipt!.logs.map(log => {
                try { return I_STRProxied.interface.parseLog(log) } catch (e) { return null }
            }).find(e => e?.name === "NewSecurityToken");
            
            expect(newSTEvent!.args._ticker).to.equal(symbol, "SecurityToken doesn't get deployed");

            I_SecurityToken = await ethers.getContractAt("SecurityToken", newSTEvent!.args._securityTokenAddress);
            stGetter = await ethers.getContractAt("STGetter", await I_SecurityToken.getAddress());
            expect(await stGetter.getTreasuryWallet()).to.equal(token_owner.address, "Incorrect wallet set");
            
            // Verify that GeneralTransferManager module get added successfully or not
            const moduleAddedEvent = receipt!.logs.map(log => {
                try { return I_SecurityToken.interface.parseLog(log) } catch (e) { return null }
            }).find(e => e?.name === "ModuleAdded");

            expect(moduleAddedEvent!.args._types[0]).to.equal(transferManagerKey);
            expect(decodeBytes32String(moduleAddedEvent!.args._name)).to.equal("GeneralTransferManager");
        });
    });

    describe("Upgrade the implementation address", async () => {
        it("Should upgrade the version and implementation address -- fail bad owner", async () => {
            const SecurityTokenRegistryMockFactory = await ethers.getContractFactory("SecurityTokenRegistryMock");
            I_SecurityTokenRegistryMock = await SecurityTokenRegistryMockFactory.connect(account_polymath).deploy();
            await catchRevert(I_SecurityTokenRegistryProxy.connect(account_temp).upgradeTo("1.1.0", await I_SecurityTokenRegistryMock.getAddress()));
        });

        it("Should upgrade the version and implementation address -- Implementaion address should be a contract address", async () => {
            await catchRevert(I_SecurityTokenRegistryProxy.connect(account_polymath).upgradeTo("1.1.0", account_temp.address));
        });

        it("Should upgrade the version and implementation address -- Implemenation address should not be 0x", async () => {
            await catchRevert(I_SecurityTokenRegistryProxy.connect(account_polymath).upgradeTo("1.1.0", address_zero));
        });

        it("Should upgrade the version and implementation address -- Implemenation address should not be the same address", async () => {
            const currentImplementation = await I_SecurityTokenRegistryProxy.implementation();
            await catchRevert(I_SecurityTokenRegistryProxy.connect(account_polymath).upgradeTo("1.1.0", currentImplementation));
        });

        it("Should upgrade the version and implementation address -- same version as previous is not allowed", async () => {
            const currentVersion = await I_SecurityTokenRegistryProxy.version();
            await catchRevert(I_SecurityTokenRegistryProxy.connect(account_polymath).upgradeTo(currentVersion, await I_SecurityTokenRegistryMock.getAddress()));
        });

        it("Should upgrade the version and implementation address -- empty version string is not allowed", async () => {
            await catchRevert(I_SecurityTokenRegistryProxy.connect(account_polymath).upgradeTo("", await I_SecurityTokenRegistryMock.getAddress()));
        });

        it("Should upgrade the version and the implementation address successfully", async () => {
            await I_SecurityTokenRegistryProxy.connect(account_polymath).upgradeTo("1.1.0", await I_SecurityTokenRegistryMock.getAddress());

            const proxyAddress = await I_SecurityTokenRegistryProxy.getAddress();
            const version = await readStorage(proxyAddress, VERSION_SLOT);
            const implAddress = await readStorage(proxyAddress, IMPLEMENTATION_SLOT);
            
            expect(decodeBytes32String(version).replace(/\u0000/g, "").replace(/\n/, "")).to.equal("1.1.0", "Version mis-match");
            expect(ethers.getAddress(implAddress.slice(-40))).to.equal(await I_SecurityTokenRegistryMock.getAddress(), "Implemented address is not matched");

            I_STRProxied = await ethers.getContractAt("SecurityTokenRegistryMock", proxyAddress);
            I_Getter = await ethers.getContractAt("STRGetter", proxyAddress);
        });
    });

    describe("Execute functionality of the implementation contract on the earlier storage", async () => {
        it("Should get the previous data", async () => {
            let _tokenAddress = await I_Getter.getSecurityTokenAddress(symbol);
            let _data = await I_Getter.getSecurityTokenData(_tokenAddress);
            expect(_data[0]).to.equal(symbol, "Symbol should match with registered symbol");
            expect(_data[1]).to.equal(token_owner.address, "Owner should be the deployer of token");
            expect(_data[2]).to.equal(tokenDetails, "Token details should matched with deployed ticker");
        });

        it("Should alter the old storage", async () => {
            await I_STRProxied.connect(account_polymath).changeTheFee(0);
            let feesToken = await I_STRProxied.getFees("0xd677304bb45536bb7fdfa6b9e47a3c58fe413f9e8f01474b0a4b9c6e0275baf2");
            console.log(feesToken);
            // Original assertions were commented out, kept for reference
            // expect(feesToken[0].toString()).to.equal(origPriceUSD.toString());
            // expect(feesToken[1].toString()).to.equal(origPricePOLY.toString());
        });
    });

    describe("Transfer the ownership of the proxy contract", async () => {
        it("Should change the ownership of the contract -- because of bad owner", async () => {
            await catchRevert(I_SecurityTokenRegistryProxy.connect(account_temp).transferProxyOwnership(account_polymath_new.address));
        });

        it("Should change the ownership of the contract -- new address should not be 0x", async () => {
            await catchRevert(I_SecurityTokenRegistryProxy.connect(account_polymath).transferProxyOwnership(address_zero));
        });

        it("Should change the ownership of the contract", async () => {
            await I_SecurityTokenRegistryProxy.connect(account_polymath).transferProxyOwnership(account_polymath_new.address);
            let _currentOwner = await I_SecurityTokenRegistryProxy.proxyOwner();
            expect(_currentOwner).to.equal(account_polymath_new.address, "Should equal to the new owner");
        });

        it("Should change the implementation contract and version by the new owner", async () => {
            const SecurityTokenRegistryFactory = await ethers.getContractFactory("SecurityTokenRegistry");
            I_SecurityTokenRegistry = await SecurityTokenRegistryFactory.connect(account_polymath).deploy();

            await I_SecurityTokenRegistryProxy.connect(account_polymath_new).upgradeTo("1.2.0", await I_SecurityTokenRegistry.getAddress());
            
            const proxyAddress = await I_SecurityTokenRegistryProxy.getAddress();
            const version = await readStorage(proxyAddress, VERSION_SLOT);
            const implAddress = await readStorage(proxyAddress, IMPLEMENTATION_SLOT);

            expect(decodeBytes32String(version).replace(/\u0000/g, "").replace(/\n/, "")).to.equal("1.2.0", "Version mis-match");
            expect(ethers.getAddress(implAddress.slice(-40))).to.equal(await I_SecurityTokenRegistry.getAddress(), "Implemented address is not matched");
            
            I_STRProxied = await ethers.getContractAt("SecurityTokenRegistry", proxyAddress);
        });

        it("Should get the version", async () => {
            expect(await I_SecurityTokenRegistryProxy.connect(account_polymath_new).version()).to.equal("1.2.0");
        });

        it("Should get the implementation address", async () => {
            expect(await I_SecurityTokenRegistryProxy.connect(account_polymath_new).implementation()).to.equal(await I_SecurityTokenRegistry.getAddress());
        });
    });
});