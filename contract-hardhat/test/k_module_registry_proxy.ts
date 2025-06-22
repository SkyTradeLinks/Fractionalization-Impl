import { ethers } from "hardhat";
import { expect } from "chai";
import { Contract } from "ethers";
import { setUpPolymathNetwork } from "./helpers/createInstances";

// Helper to read storage
const readStorage = async (address: string, slot: number) => {
    return await ethers.provider.getStorageAt(address, slot);
};

describe("ModuleRegistryProxy", () => {
    // Contract instances
    let I_SecurityTokenRegistry: Contract;
    let I_SecurityTokenRegistryProxy: Contract;
    let I_GeneralTransferManagerFactory: Contract;
    let I_GeneralPermissionManagerfactory: Contract;
    let I_GeneralPermissionManagerLogic: Contract;
    let I_MockModuleRegistry: Contract;
    let I_STFactory: Contract;
    let I_PolymathRegistry: Contract;
    let I_ModuleRegistryProxy: Contract;
    let I_PolyToken: Contract;
    let I_MRProxied: Contract;
    let I_ModuleRegistry: Contract;
    let I_FeatureRegistry: Contract;
    let I_STRGetter: Contract;
    let I_STGetter: Contract;

    // Signers
    let account_polymath;
    let account_temp;
    let token_owner;
    let account_polymath_new;

    // Constants
    const address_zero = ethers.ZeroAddress;

    before(async () => {
        [account_polymath, account_temp, token_owner, account_polymath_new] = await ethers.getSigners();

        // Step 1: Deploy the general PM ecosystem
        let instances = await setUpPolymathNetwork(account_polymath.address, token_owner.address);

        [
            I_PolymathRegistry,
            I_PolyToken,
            I_FeatureRegistry,
            I_ModuleRegistry,
            I_ModuleRegistryProxy, // This will be replaced by a new deployment
            I_MRProxied,
            I_GeneralTransferManagerFactory,
            I_STFactory,
            I_SecurityTokenRegistry,
            I_SecurityTokenRegistryProxy,
            // I_STRProxied, // Not used in this file
            I_STRGetter,
            I_STGetter
        ] = instances;

        const ModuleRegistryProxyFactory = await ethers.getContractFactory("ModuleRegistryProxy");
        I_ModuleRegistryProxy = await ModuleRegistryProxyFactory.connect(account_polymath).deploy();

        const ModuleRegistryFactory = await ethers.getContractFactory("ModuleRegistry");
        I_ModuleRegistry = await ModuleRegistryFactory.connect(account_polymath).deploy();

        await I_PolymathRegistry.connect(account_polymath).changeAddress("ModuleRegistry", I_ModuleRegistryProxy.target);

        // Printing all the contract addresses
        console.log(`
         --------------------- Polymath Network Smart Contracts: ---------------------
         PolymathRegistry:                  ${I_PolymathRegistry.target}
         SecurityTokenRegistryProxy:        ${I_SecurityTokenRegistryProxy.target}
         SecurityTokenRegistry:             ${I_SecurityTokenRegistry.target}
         ModuleRegistry:                    ${I_ModuleRegistry.target}
         ModuleRegistryProxy:               ${I_ModuleRegistryProxy.target}
         STFactory:                         ${I_STFactory.target}
         GeneralTransferManagerFactory:     ${I_GeneralTransferManagerFactory.target}
         -----------------------------------------------------------------------------
         `);
    });

    describe("Attach the implementation address", async () => {
        // Storage slots for OwnedUpgradeabilityProxy
        // __version -- keccak256('org.zeppelinos.proxy.version') - 1 => 0x7050c9e0f4ca769c69bd3a8ef740bc37934f8e2c036e5a723fd8ee048ed3f8c3 (pos 11 in truffle)
        // __implementation -- keccak256('org.zeppelinos.proxy.implementation') - 1 => 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc (pos 12 in truffle)
        const IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
        const VERSION_SLOT = "0x7050c9e0f4ca769c69bd3a8ef740bc37934f8e2c036e5a723fd8ee048ed3f8c3";

        it("Should attach the MR implementation and version", async () => {
            const moduleRegistryInterface = new ethers.Interface(["function initialize(address _polymathRegistry, address _owner)"]);
            const bytesProxy = moduleRegistryInterface.encodeFunctionData("initialize", [I_PolymathRegistry.target, account_polymath.target]);

            await I_ModuleRegistryProxy.connect(account_polymath).upgradeToAndCall("1.0.0", I_ModuleRegistry.target, bytesProxy);

            const implementationAddress = await ethers.provider.getStorageAt(I_ModuleRegistryProxy.target, IMPLEMENTATION_SLOT);
            const version = await ethers.provider.getStorageAt(I_ModuleRegistryProxy.target, VERSION_SLOT);

            expect(ethers.getAddress(implementationAddress)).to.equal(I_ModuleRegistry.target);
            expect(ethers.toUtf8String(version).replace(/\0/g, "")).to.equal("1.0.0");

            I_MRProxied = await ethers.getContractAt("ModuleRegistry", I_ModuleRegistryProxy.target);
        });

        it("Deploy the essential smart contracts", async () => {
            await I_MRProxied.connect(account_polymath).updateFromRegistry();

            const GeneralTransferManagerLogicFactory = await ethers.getContractFactory("GeneralTransferManager");
            let I_GeneralTransferManagerLogic = await GeneralTransferManagerLogicFactory.deploy(address_zero, address_zero);


            const SecurityTokenLogicFactory = await ethers.getContractFactory("SecurityToken");
            let I_SecurityTokenLogic = await SecurityTokenLogicFactory.deploy();


            const GeneralTransferManagerFactory = await ethers.getContractFactory("GeneralTransferManagerFactory");
            I_GeneralTransferManagerFactory = await GeneralTransferManagerFactory.deploy(0, I_GeneralTransferManagerLogic.address, I_PolymathRegistry.address, true);


            expect(I_GeneralTransferManagerFactory.address).to.not.equal(address_zero, "GeneralTransferManagerFactory contract was not deployed");

            await I_MRProxied.connect(account_polymath).registerModule(I_GeneralTransferManagerFactory.address);
            await I_MRProxied.connect(account_polymath).verifyModule(I_GeneralTransferManagerFactory.address, true);

            const STGetterFactory = await ethers.getContractFactory("STGetter");
            I_STGetter = await STGetterFactory.deploy();


            const DataStoreLogicFactory = await ethers.getContractFactory("DataStore");
            let I_DataStoreLogic = await DataStoreLogicFactory.deploy();


            const DataStoreFactory = await ethers.getContractFactory("DataStoreFactory");
            let I_DataStoreFactory = await DataStoreFactory.deploy(I_DataStoreLogic.address);


            const tokenInitInterface = new ethers.utils.Interface(["function initialize(address _getterDelegate)"]);
            const tokenInitBytesCall = tokenInitInterface.encodeFunctionData("initialize", [I_STGetter.address]);

            const STFactory = await ethers.getContractFactory("STFactory");
            I_STFactory = await STFactory.deploy(I_PolymathRegistry.address, I_GeneralTransferManagerFactory.address, I_DataStoreFactory.address, "3.0.0", I_SecurityTokenLogic.address, tokenInitBytesCall);


            expect(I_STFactory.address).to.not.equal(address_zero, "STFactory contract was not deployed");
        });

        it("Verify the initialize data", async () => {
            expect(await I_MRProxied.getAddressValue(ethers.utils.id("owner"))).to.equal(account_polymath.address);
            expect(await I_MRProxied.getAddressValue(ethers.utils.id("polymathRegistry"))).to.equal(I_PolymathRegistry.address);
        });
    });

    describe("Feed some data in storage", async () => {
        it("Register and verify the new module", async () => {
            const GPMFactory = await ethers.getContractFactory("GeneralPermissionManager");
            I_GeneralPermissionManagerLogic = await GPMFactory.deploy(address_zero, address_zero);


            const GPMFactoryFactory = await ethers.getContractFactory("GeneralPermissionManagerFactory");
            I_GeneralPermissionManagerfactory = await GPMFactoryFactory.deploy(0, I_GeneralPermissionManagerLogic.address, I_PolymathRegistry.address, true);


            expect(I_GeneralPermissionManagerfactory.address).to.not.equal(address_zero, "GeneralPermissionManagerFactory contract was not deployed");

            await I_MRProxied.connect(account_polymath).registerModule(I_GeneralPermissionManagerfactory.address);
            await I_MRProxied.connect(account_polymath).verifyModule(I_GeneralPermissionManagerfactory.address, true);
        });
    });

    describe("Upgrade the imlplementation address", async () => {
        it("Should upgrade the version and implementation address -- fail bad owner", async () => {
            const MockModuleRegistryFactory = await ethers.getContractFactory("MockModuleRegistry");
            I_MockModuleRegistry = await MockModuleRegistryFactory.deploy();

            await expect(I_ModuleRegistryProxy.connect(account_temp).upgradeTo("1.1.0", I_MockModuleRegistry.address)).to.be.reverted;
        });

        it("Should upgrade the version and implementation address -- Implementaion address should be a contract address", async () => {
            await expect(I_ModuleRegistryProxy.connect(account_polymath).upgradeTo("1.1.0", account_temp.address)).to.be.reverted;
        });

        it("Should upgrade the version and implementation address -- Implemenation address should not be 0x", async () => {
            await expect(I_ModuleRegistryProxy.connect(account_polymath).upgradeTo("1.1.0", address_zero)).to.be.reverted;
        });

        it("Should upgrade the version and implementation address -- Implemenation address should not be the same address", async () => {
            await expect(I_ModuleRegistryProxy.connect(account_polymath).upgradeTo("1.1.0", I_ModuleRegistry.address)).to.be.reverted;
        });

        it("Should upgrade the version and implementation address -- same version as previous is not allowed", async () => {
            await expect(I_ModuleRegistryProxy.connect(account_polymath).upgradeTo("1.0.0", I_MockModuleRegistry.address)).to.be.reverted;
        });

        it("Should upgrade the version and implementation address -- empty version string is not allowed", async () => {
            await expect(I_ModuleRegistryProxy.connect(account_polymath).upgradeTo("", I_MockModuleRegistry.address)).to.be.reverted;
        });

        it("Should upgrade the version and the implementation address successfully", async () => {
            await I_ModuleRegistryProxy.connect(account_polymath).upgradeTo("1.1.0", I_MockModuleRegistry.address);
            
            const IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
            const VERSION_SLOT = "0x7050c9e0f4ca769c69bd3a8ef740bc37934f8e2c036e5a723fd8ee048ed3f8c3";
            
            const implementationAddress = await ethers.provider.getStorageAt(I_ModuleRegistryProxy.address, IMPLEMENTATION_SLOT);
            const version = await ethers.provider.getStorageAt(I_ModuleRegistryProxy.address, VERSION_SLOT);

            expect(ethers.utils.toUtf8String(version).replace(/\0/g, "")).to.equal("1.1.0", "Version mis-match");
            expect(ethers.utils.getAddress(implementationAddress)).to.equal(I_MockModuleRegistry.address, "Implemnted address is not matched");
            
            I_MRProxied = await ethers.getContractAt("MockModuleRegistry", I_ModuleRegistryProxy.address);
        });
    });

    describe("Execute functionality of the implementation contract on the earlier storage", async () => {
        it("Should get the previous data", async () => {
            let _data = await I_MRProxied.getFactoryDetails(I_GeneralTransferManagerFactory.address);
            expect(_data[2].length).to.equal(0, "Should give the original length");
        });

        it("Should alter the old storage", async () => {
            await I_MRProxied.connect(account_polymath).addMoreReputation(I_GeneralTransferManagerFactory.address, [account_polymath.address, account_temp.address]);
            let _data = await I_MRProxied.getFactoryDetails(I_GeneralTransferManagerFactory.address);
            expect(_data[2].length).to.equal(2, "Should give the updated length");
        });
    });

    describe("Transfer the ownership of the proxy contract", async () => {
        it("Should change the ownership of the contract -- because of bad owner", async () => {
            await expect(I_ModuleRegistryProxy.connect(account_temp).transferProxyOwnership(account_polymath_new.address)).to.be.reverted;
        });

        it("Should change the ownership of the contract -- new address should not be 0x", async () => {
            await expect(I_ModuleRegistryProxy.connect(account_polymath).transferProxyOwnership(address_zero)).to.be.reverted;
        });

        it("Should change the ownership of the contract", async () => {
            await I_ModuleRegistryProxy.connect(account_polymath).transferProxyOwnership(account_polymath_new.address);
            let _currentOwner = await I_ModuleRegistryProxy.connect(account_polymath_new).proxyOwner();
            expect(_currentOwner).to.equal(account_polymath_new.address, "Should equal to the new owner");
        });

        it("Should change the implementation contract and version by the new owner", async () => {
            const ModuleRegistryFactory = await ethers.getContractFactory("ModuleRegistry");
            I_ModuleRegistry = await ModuleRegistryFactory.deploy();


            await I_ModuleRegistryProxy.connect(account_polymath_new).upgradeTo("1.2.0", I_ModuleRegistry.address);
            
            const IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
            const VERSION_SLOT = "0x7050c9e0f4ca769c69bd3a8ef740bc37934f8e2c036e5a723fd8ee048ed3f8c3";

            const implementationAddress = await ethers.provider.getStorageAt(I_ModuleRegistryProxy.address, IMPLEMENTATION_SLOT);
            const version = await ethers.provider.getStorageAt(I_ModuleRegistryProxy.address, VERSION_SLOT);

            expect(ethers.utils.toUtf8String(version).replace(/\0/g, "")).to.equal("1.2.0", "Version mis-match");
            expect(ethers.utils.getAddress(implementationAddress)).to.equal(I_ModuleRegistry.address, "Implemnted address is not matched");
            
            I_MRProxied = await ethers.getContractAt("ModuleRegistry", I_ModuleRegistryProxy.address);
        });
    });
});
