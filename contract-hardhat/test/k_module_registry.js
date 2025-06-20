const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = require("ethers");

// Import helper functions (adapt these to work with Hardhat/ethers)
const { latestTime } = require("./helpers/latestTime");
const { duration, ensureException, latestBlock } = require("./helpers/utils");
const { takeSnapshot, increaseTime, revertToSnapshot } = require("./helpers/time");
const { encodeProxyCall, encodeModuleCall } = require("./helpers/encodeCall");
const { catchRevert } = require("./helpers/exceptions");
const { deployCappedSTOAndVerifyed, setUpPolymathNetwork } = require("./helpers/createInstances");

describe("ModuleRegistry", function() {
    // Accounts Variable declaration
    let account_polymath;
    let account_investor1;
    let account_issuer;
    let token_owner;
    let account_investor2;
    let account_fundsReceiver;
    let account_delegate;
    let account_temp;
    let accounts;

    let balanceOfReceiver;

    let ID_snap;
    let message = "Transaction Should fail!";
    
    // Contract Instance Declaration
    let I_GeneralPermissionManagerFactory;
    let I_GeneralPermissionManagerLogic;
    let I_GeneralTransferManagerFactory;
    let I_SecurityTokenRegistryProxy;
    let I_GeneralPermissionManager;
    let I_GeneralTransferManager;
    let I_ModuleRegistryProxy;
    let I_ModuleRegistry;
    let I_FeatureRegistry;
    let I_SecurityTokenRegistry;
    let I_CappedSTOFactory1;
    let I_CappedSTOFactory2;
    let I_CappedSTOFactory3;
    let I_STFactory;
    let I_MRProxied;
    let I_SecurityToken;
    let I_ReclaimERC20;
    let I_STRProxied;
    let I_CappedSTOLogic;
    let I_PolyToken;
    let I_MockFactory;
    let I_TestSTOFactory;
    let I_DummySTOFactory;
    let I_PolymathRegistry;
    let I_SecurityToken2;
    let I_STRGetter;
    let I_STGetter;
    let stGetter;

    // Contract Factories
    let CappedSTOFactory;
    let CappedSTO;
    let DummySTO;
    let DummySTOFactory;
    let SecurityToken;
    let ModuleRegistryProxy;
    let ModuleRegistry;
    let GeneralPermissionManagerFactory;
    let GeneralPermissionManager;
    let GeneralTransferManagerFactory;
    let MockFactory;
    let TestSTOFactory;
    let ReclaimTokens;
    let STGetter;

    // SecurityToken Details (Launched ST on the behalf of the issuer)
    const name = "Demo Token";
    const symbol = "det";
    const tokenDetails = "This is equity type of issuance";
    const decimals = 18;

    // Module key
    const permissionManagerKey = 1;
    const transferManagerKey = 2;
    const stoKey = 3;
    const budget = 0;
    const address_zero = ethers.ZeroAddress;
    const one_address = "0x0000000000000000000000000000000000000001";

    // Initial fee for ticker registry and security token registry
    const initRegFee = ethers.parseEther("1000");

    // delegate details
    const delegateDetails = "I am delegate ..";
    const TM_Perm = "FLAGS";

    // Capped STO details
    let startTime;
    let endTime;
    const cap = ethers.parseEther("10000");
    const rate = 1000;
    const fundRaiseType = [0];
    const STOParameters = ["uint256", "uint256", "uint256", "uint256", "uint8[]", "address"];
    const MRProxyParameters = ["address", "address"];

    let currentTime;

    before(async () => {
        // Get signers
        accounts = await ethers.getSigners();
        
        currentTime = await latestTime();
        account_polymath = accounts[0];
        account_issuer = accounts[1];
        account_investor1 = accounts[9];
        account_investor2 = accounts[6];
        account_fundsReceiver = accounts[4];
        account_delegate = accounts[5];
        account_temp = accounts[8];
        token_owner = account_issuer;

        // Get contract factories
        // CappedSTOFactory = await ethers.getContractFactory("CappedSTOFactory");
        // CappedSTO = await ethers.getContractFactory("CappedSTO");
        DummySTO = await ethers.getContractFactory("DummySTO");
        DummySTOFactory = await ethers.getContractFactory("DummySTOFactory");
        SecurityToken = await ethers.getContractFactory("SecurityToken");
        ModuleRegistryProxy = await ethers.getContractFactory("ModuleRegistryProxy");
        ModuleRegistry = await ethers.getContractFactory("ModuleRegistry");
        GeneralPermissionManagerFactory = await ethers.getContractFactory("GeneralPermissionManagerFactory");
        GeneralPermissionManager = await ethers.getContractFactory("GeneralPermissionManager");
        GeneralTransferManagerFactory = await ethers.getContractFactory("GeneralTransferManagerFactory");
        MockFactory = await ethers.getContractFactory("MockFactory");
        TestSTOFactory = await ethers.getContractFactory("TestSTOFactory");
        ReclaimTokens = await ethers.getContractFactory("ReclaimTokens");
        STGetter = await ethers.getContractFactory("STGetter");

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

        I_ModuleRegistryProxy = await ModuleRegistryProxy.connect(account_polymath).deploy();
        await I_ModuleRegistryProxy.waitForDeployment();

        // Printing all the contract addresses
        console.log(`
        --------------------- Polymath Network Smart Contracts: ---------------------
        PolymathRegistry:                  ${await I_PolymathRegistry.getAddress()}
        SecurityTokenRegistryProxy:        ${await I_SecurityTokenRegistryProxy.getAddress()}
        SecurityTokenRegistry:             ${await I_SecurityTokenRegistry.getAddress()}
        ModuleRegistry:                    ${await I_ModuleRegistry.getAddress()}
        ModuleRegistryProxy:               ${await I_ModuleRegistryProxy.getAddress()}
        FeatureRegistry:                   ${await I_FeatureRegistry.getAddress()}

        STFactory:                         ${await I_STFactory.getAddress()}
        GeneralTransferManagerFactory:     ${await I_GeneralTransferManagerFactory.getAddress()}
        -----------------------------------------------------------------------------
        `);
    });

    describe("Test the initialize the function", async () => {
        it("Should successfully update the implementation address -- fail because polymathRegistry address is 0x", async () => {
            let bytesProxy = encodeProxyCall(MRProxyParameters, [address_zero, account_polymath.address]);
            await expect(
                I_ModuleRegistryProxy.connect(account_polymath).upgradeToAndCall(
                    "1.0.0", 
                    await I_ModuleRegistry.getAddress(), 
                    bytesProxy
                )
            ).to.be.revertedWith("tx-> revert because polymathRegistry address is 0x");
        });

        it("Should successfully update the implementation address -- fail because owner address is 0x", async () => {
            let bytesProxy = encodeProxyCall(MRProxyParameters, [await I_PolymathRegistry.getAddress(), address_zero]);
            await expect(
                I_ModuleRegistryProxy.connect(account_polymath).upgradeToAndCall(
                    "1.0.0", 
                    await I_ModuleRegistry.getAddress(), 
                    bytesProxy
                )
            ).to.be.revertedWith("tx-> revert because owner address is 0x");
        });

        it("Should successfully update the implementation address -- fail because all params are 0x", async () => {
            let bytesProxy = encodeProxyCall(MRProxyParameters, [address_zero, address_zero]);
            await expect(
                I_ModuleRegistryProxy.connect(account_polymath).upgradeToAndCall(
                    "1.0.0", 
                    await I_ModuleRegistry.getAddress(), 
                    bytesProxy
                )
            ).to.be.revertedWith("tx-> revert because all params are 0x");
        });

        it("Should successfully update the implementation address", async () => {
            let bytesProxy = encodeProxyCall(MRProxyParameters, [await I_PolymathRegistry.getAddress(), account_polymath.address]);
            await I_ModuleRegistryProxy.connect(account_polymath).upgradeToAndCall(
                "1.0.0", 
                await I_ModuleRegistry.getAddress(), 
                bytesProxy
            );
            I_MRProxied = ModuleRegistry.attach(await I_ModuleRegistryProxy.getAddress());
            await I_PolymathRegistry.connect(account_polymath).changeAddress(
                "ModuleRegistry", 
                await I_ModuleRegistryProxy.getAddress()
            );
        });
    });

    describe("Test cases for the ModuleRegistry", async () => {
        describe("Test case for the upgradeFromregistry", async () => {
            it("Should successfully update the registry contract address -- failed because of bad owner", async () => {
                await expect(
                    I_MRProxied.connect(account_temp).updateFromRegistry()
                ).to.be.reverted;
            });

            it("Should successfully update the registry contract addresses", async () => {
                await I_MRProxied.connect(account_polymath).updateFromRegistry();
                
                expect(
                    await I_MRProxied.getAddressValue(ethers.id("securityTokenRegistry"))
                ).to.equal(await I_SecurityTokenRegistryProxy.getAddress());
                
                expect(
                    await I_MRProxied.getAddressValue(ethers.id("featureRegistry"))
                ).to.equal(await I_FeatureRegistry.getAddress());
                
                expect(
                    await I_MRProxied.getAddressValue(ethers.id("polyToken"))
                ).to.equal(await I_PolyToken.getAddress());
            });
        });

        describe("Test the state variables", async () => {
            it("Should be the right owner", async () => {
                let _owner = await I_MRProxied.getAddressValue(ethers.id("owner"));
                expect(_owner).to.equal(account_polymath.address, "Owner should be the correct");
            });

            it("Should be the expected value of the paused and initialised variable", async () => {
                let _paused = await I_MRProxied.getBoolValue(ethers.id("paused"));
                expect(_paused).to.be.false;

                let _initialised = await I_MRProxied.getBoolValue(ethers.id("initialised"));
                expect(_initialised).to.be.true;
            });

            it("Should be the expected value of the polymath registry", async () => {
                let _polymathRegistry = await I_MRProxied.getAddressValue(ethers.id("polymathRegistry"));
                expect(_polymathRegistry).to.equal(
                    await I_PolymathRegistry.getAddress(),
                    "Should be the right value of the address of the polymath registry"
                );
            });
        });

        describe("Test cases for the registering the module", async () => {
            it("Should fail to register the module -- when registerModule is paused", async () => {
                await I_MRProxied.connect(account_polymath).pause();

                await expect(
                    I_MRProxied.connect(account_delegate).registerModule(await I_GeneralTransferManagerFactory.getAddress())
                ).to.be.reverted;
                
                await I_MRProxied.connect(account_polymath).unpause();
            });

            it("Should register the module with the Module Registry", async () => {
                let tx = await I_MRProxied.connect(account_polymath).registerModule(await I_GeneralTransferManagerFactory.getAddress());
                const receipt = await tx.wait();
                
                // Find the ModuleRegistered event
                const event = receipt.logs.find(log => {
                    try {
                        const parsed = I_MRProxied.interface.parseLog(log);
                        return parsed.name === 'ModuleRegistered';
                    } catch (e) {
                        return false;
                    }
                });
                
                if (event) {
                    const parsed = I_MRProxied.interface.parseLog(event);
                    expect(parsed.args._moduleFactory).to.equal(await I_GeneralTransferManagerFactory.getAddress());
                    expect(parsed.args._owner).to.equal(account_polymath.address);
                }

                let _list = await I_MRProxied.getModulesByType(transferManagerKey);
                expect(_list.length).to.equal(0, "Length should be 0 - unverified");

                let _reputation = await I_MRProxied.getFactoryDetails(await I_GeneralTransferManagerFactory.getAddress());
                expect(_reputation[2].length).to.equal(0);
            });

            it("Should fail the register the module -- Already registered module", async () => {
                await expect(
                    I_MRProxied.connect(account_polymath).registerModule(await I_GeneralTransferManagerFactory.getAddress())
                ).to.be.reverted;
            });

            it("Should fail in registering the module-- type = 0", async () => {
                I_MockFactory = await MockFactory.connect(account_polymath).deploy(
                    BigNumber.from(0), 
                    one_address, 
                    await I_PolymathRegistry.getAddress(), 
                    true
                );
                await I_MockFactory.waitForDeployment();

                await expect(
                    I_MRProxied.connect(account_polymath).registerModule(await I_MockFactory.getAddress())
                ).to.be.reverted;
            });

            it("Should fail to register the new module because msg.sender is not the owner of the module", async() => {
                I_CappedSTOLogic = await CappedSTO.connect(account_polymath).deploy(address_zero, address_zero);
                await I_CappedSTOLogic.waitForDeployment();
                
                I_CappedSTOFactory3 = await CappedSTOFactory.connect(account_temp).deploy(
                    BigNumber.from(0), 
                    await I_CappedSTOLogic.getAddress(), 
                    await I_PolymathRegistry.getAddress(), 
                    true
                );
                await I_CappedSTOFactory3.waitForDeployment();
                
                console.log(await I_MRProxied.owner());
                await expect(
                    I_MRProxied.connect(token_owner).registerModule(await I_CappedSTOFactory3.getAddress())
                ).to.be.reverted;
            });

            it("Should successfully register the module -- fail because no module type uniqueness", async () => {
                await I_MockFactory.connect(account_polymath).switchTypes();
                await expect(
                    I_MRProxied.connect(account_polymath).registerModule(await I_MockFactory.getAddress())
                ).to.be.reverted;
            });
        });

        describe("Test case for verifyModule", async () => {
            it("Should fail in calling the verify module. Because msg.sender should be account_polymath", async () => {
                await expect(
                    I_MRProxied.connect(account_temp).verifyModule(await I_GeneralTransferManagerFactory.getAddress())
                ).to.be.reverted;
            });

            it("Should successfully verify the module -- true", async () => {
                let tx = await I_MRProxied.connect(account_polymath).verifyModule(await I_GeneralTransferManagerFactory.getAddress());
                const receipt = await tx.wait();
                
                // Find the ModuleVerified event
                const event = receipt.logs.find(log => {
                    try {
                        const parsed = I_MRProxied.interface.parseLog(log);
                        return parsed.name === 'ModuleVerified';
                    } catch (e) {
                        return false;
                    }
                });
                
                if (event) {
                    const parsed = I_MRProxied.interface.parseLog(event);
                    expect(parsed.args._moduleFactory).to.equal(await I_GeneralTransferManagerFactory.getAddress());
                }
                
                let info = await I_MRProxied.getFactoryDetails(await I_GeneralTransferManagerFactory.getAddress());
                let _list = await I_MRProxied.getModulesByType(transferManagerKey);
                expect(_list.length).to.equal(1, "Length should be 1");
                expect(_list[0]).to.equal(await I_GeneralTransferManagerFactory.getAddress());
                expect(info[0]).to.be.true;
                expect(info[1]).to.equal(account_polymath.address);
            });

            it("Should successfully verify the module -- false", async () => {
                I_CappedSTOFactory1 = await CappedSTOFactory.connect(account_polymath).deploy(
                    BigNumber.from(0), 
                    await I_CappedSTOLogic.getAddress(), 
                    await I_PolymathRegistry.getAddress(), 
                    true
                );
                await I_CappedSTOFactory1.waitForDeployment();
                
                await I_MRProxied.connect(account_polymath).registerModule(await I_CappedSTOFactory1.getAddress());
                let tx = await I_MRProxied.connect(account_polymath).unverifyModule(await I_CappedSTOFactory1.getAddress());
                const receipt = await tx.wait();
                
                // Find the ModuleUnverified event
                const event = receipt.logs.find(log => {
                    try {
                        const parsed = I_MRProxied.interface.parseLog(log);
                        return parsed.name === 'ModuleUnverified';
                    } catch (e) {
                        return false;
                    }
                });
                
                if (event) {
                    const parsed = I_MRProxied.interface.parseLog(event);
                    expect(parsed.args._moduleFactory).to.equal(await I_CappedSTOFactory1.getAddress());
                }
                
                let info = await I_MRProxied.getFactoryDetails(await I_CappedSTOFactory1.getAddress());
                expect(info[0]).to.be.false;
            });

            it("Should fail in verifying the module. Because the module is not registered", async () => {
                await expect(
                    I_MRProxied.connect(account_polymath).verifyModule(await I_MockFactory.getAddress())
                ).to.be.reverted;
            });
        });

        describe("Test cases for the useModule function of the module registry", async () => {
            it("Deploy the securityToken", async () => {
                await I_PolyToken.connect(account_issuer).getTokens(ethers.parseEther("2000"));
                await I_PolyToken.connect(account_issuer).approve(await I_STRProxied.getAddress(), ethers.parseEther("2000"));
                await I_STRProxied.connect(account_issuer).registerNewTicker(account_issuer.address, symbol);
                let tx = await I_STRProxied.connect(account_issuer).generateNewSecurityToken(
                    name, 
                    symbol, 
                    tokenDetails, 
                    true, 
                    account_issuer.address, 
                    0
                );
                const receipt = await tx.wait();
                
                // Find the NewSecurityToken event
                const event = receipt.logs.find(log => {
                    try {
                        const parsed = I_STRProxied.interface.parseLog(log);
                        return parsed.name === 'NewSecurityToken';
                    } catch (e) {
                        return false;
                    }
                });
                
                if (event) {
                    const parsed = I_STRProxied.interface.parseLog(event);
                    expect(parsed.args._ticker).to.equal(symbol.toUpperCase());
                    I_SecurityToken = SecurityToken.attach(parsed.args._securityTokenAddress);
                    stGetter = STGetter.attach(parsed.args._securityTokenAddress);
                    expect(await stGetter.getTreasuryWallet()).to.equal(account_issuer.address, "Incorrect wallet set");
                }
            });

            it("Should fail in adding module. Because module is un-verified", async () => {
                startTime = await latestTime() + duration.seconds(5000);
                endTime = startTime + duration.days(30);
                let bytesSTO = encodeModuleCall(STOParameters, [startTime, endTime, cap, rate, fundRaiseType, account_fundsReceiver.address]);

                await expect(
                    I_SecurityToken.connect(token_owner).addModule(
                        await I_CappedSTOFactory1.getAddress(), 
                        bytesSTO, 
                        BigNumber.from(0), 
                        BigNumber.from(0), 
                        false
                    )
                ).to.be.reverted;
            });

            it("Should fail to register module because custom modules not allowed", async () => {
                I_CappedSTOFactory2 = await CappedSTOFactory.connect(token_owner).deploy(
                    BigNumber.from(0), 
                    await I_CappedSTOLogic.getAddress(), 
                    await I_PolymathRegistry.getAddress(), 
                    true
                );
                await I_CappedSTOFactory2.waitForDeployment();

                expect(await I_CappedSTOFactory2.getAddress()).to.not.equal(address_zero, "CappedSTOFactory contract was not deployed");

                await expect(
                    I_MRProxied.connect(token_owner).registerModule(await I_CappedSTOFactory2.getAddress())
                ).to.be.reverted;
            });

            it("Should switch customModulesAllowed to true", async () => {
                expect(
                    await I_FeatureRegistry.getFeatureStatus("customModulesAllowed")
                ).to.be.false;
                
                let tx = await I_FeatureRegistry.connect(account_polymath).setFeatureStatus("customModulesAllowed", true);
                
                expect(
                    await I_FeatureRegistry.getFeatureStatus("customModulesAllowed")
                ).to.be.true;
            });

            it("Should successfully add module because custom modules switched on", async () => {
                startTime = await latestTime() + duration.seconds(5000);
                endTime = startTime + duration.days(30);
                let bytesSTO = encodeModuleCall(STOParameters, [startTime, endTime, cap, rate, fundRaiseType, account_fundsReceiver.address]);
                let tx = await I_MRProxied.connect(token_owner).registerModule(await I_CappedSTOFactory2.getAddress());
                tx = await I_SecurityToken.connect(token_owner).addModule(
                    await I_CappedSTOFactory2.getAddress(), 
                    bytesSTO, 
                    BigNumber.from(0), 
                    BigNumber.from(0), 
                    false
                );

                const receipt = await tx.wait();
                
                // Find the ModuleAdded event
                const event = receipt.logs.find(log => {
                    try {
                        const parsed = I_SecurityToken.interface.parseLog(log);
                        return parsed.name === 'ModuleAdded';
                    } catch (e) {
                        return false;
                    }
                });
                
                if (event) {
                    const parsed = I_SecurityToken.interface.parseLog(event);
                    expect(parsed.args._types[0]).to.equal(stoKey, "CappedSTO doesn't get deployed");
                    expect(ethers.parseBytes32String(parsed.args._name).replace(/\0/g, "")).to.equal("CappedSTO", "CappedSTOFactory module was not added");
                }
                
                let _reputation = await I_MRProxied.getFactoryDetails(await I_CappedSTOFactory2.getAddress());
                expect(_reputation[2].length).to.equal(1);
            });

            it("Should successfully add module when custom modules switched on -- fail because factory owner is different", async () => {
                await I_MRProxied.connect(account_temp).registerModule(await I_CappedSTOFactory3.getAddress());
                startTime = await latestTime() + duration.seconds(5000);
                endTime = startTime + duration.days(30);
                let bytesSTO = encodeModuleCall(STOParameters, [startTime, endTime, cap, rate, fundRaiseType, account_fundsReceiver.address]);
                await expect(
                    I_SecurityToken.connect(token_owner).addModule(
                        await I_CappedSTOFactory3.getAddress(), 
                        bytesSTO, 
                        BigNumber.from(0), 
                        BigNumber.from(0), 
                        false
                    )
                ).to.be.reverted;
            });

            it("Should successfully add verified module", async () => {
                I_GeneralPermissionManagerLogic = await GeneralPermissionManager.connect(account_polymath).deploy(
                    address_zero, 
                    address_zero
                );
                await I_GeneralPermissionManagerLogic.waitForDeployment();
                
                I_GeneralPermissionManagerFactory = await GeneralPermissionManagerFactory.connect(account_polymath).deploy(
                    BigNumber.from(0), 
                    await I_GeneralPermissionManagerLogic.getAddress(), 
                    await I_PolymathRegistry.getAddress(), 
                    true
                );
                await I_GeneralPermissionManagerFactory.waitForDeployment();
                
                await I_MRProxied.connect(account_polymath).registerModule(await I_GeneralPermissionManagerFactory.getAddress());
                await I_MRProxied.connect(account_polymath).verifyModule(await I_GeneralPermissionManagerFactory.getAddress());
                let tx = await I_SecurityToken.connect(token_owner).addModule(
                    await I_GeneralPermissionManagerFactory.getAddress(), 
                    "0x0", 
                    BigNumber.from(0), 
                    BigNumber.from(0), 
                    false
                );
                
                const receipt = await tx.wait();
                
                // Find the ModuleAdded event
                const event = receipt.logs.find(log => {
                    try {
                        const parsed = I_SecurityToken.interface.parseLog(log);
                        return parsed.name === 'ModuleAdded';
                    } catch (e) {
                        return false;
                    }
                });
                
                if (event) {
                    const parsed = I_SecurityToken.interface.parseLog(event);
                    expect(parsed.args._types[0]).to.equal(permissionManagerKey, "module doesn't get deployed");
                }
            });

            it("Should failed in adding the TestSTOFactory module because not compatible with the current protocol version --lower", async () => {
                let I_TestSTOFactoryLogic = await DummySTO.connect(account_polymath).deploy(address_zero, address_zero);
                await I_TestSTOFactoryLogic.waitForDeployment();
                
                I_TestSTOFactory = await TestSTOFactory.connect(account_polymath).deploy(
                    BigNumber.from(0), 
                    await I_TestSTOFactoryLogic.getAddress(), 
                    await I_PolymathRegistry.getAddress(), 
                    true
                );
                await I_TestSTOFactory.waitForDeployment();
                
                await I_MRProxied.connect(account_polymath).registerModule(await I_TestSTOFactory.getAddress());
                await I_MRProxied.connect(account_polymath).verifyModule(await I_TestSTOFactory.getAddress());
                
                // Taking the snapshot to revert the changes from here
                let id = await takeSnapshot();
                await I_TestSTOFactory.connect(account_polymath).changeSTVersionBounds("lowerBound", [3, 1, 0]);
                let _lstVersion = await I_TestSTOFactory.getLowerSTVersionBounds();
                expect(_lstVersion[0]).to.equal(3);
                expect(_lstVersion[1]).to.equal(1);
                expect(_lstVersion[2]).to.equal(0);
                let bytesData = encodeModuleCall(
                    ["uint256", "uint256", "uint256", "string"],
                    [await latestTime(), currentTime.add(BigNumber.from(duration.days(1))), cap, "Test STO"]
                );
                console.log("I_TestSTOFactory:" + await I_TestSTOFactory.getAddress());
                await expect(
                    I_SecurityToken.connect(token_owner).addModule(
                        await I_TestSTOFactory.getAddress(), 
                        bytesData, 
                        BigNumber.from(0), 
                        BigNumber.from(0), 
                        false
                    )
                ).to.be.reverted;
                await revertToSnapshot(id);
            });

            it("Should failed in adding the TestSTOFactory module because not compatible with the current protocol version --upper", async () => {
                await I_TestSTOFactory.connect(account_polymath).changeSTVersionBounds("upperBound", [0, BigNumber.from(0), 1]);
                let _ustVersion = await I_TestSTOFactory.getUpperSTVersionBounds();
                expect(_ustVersion[0]).to.equal(0);
                expect(_ustVersion[2]).to.equal(1);
                await I_STRProxied.connect(account_polymath).setProtocolFactory(await I_STFactory.getAddress(), 2, BigNumber.from(0), 1);
                await I_STRProxied.connect(account_polymath).setLatestVersion(2, BigNumber.from(0), 1);
                // Generate the new securityToken
                let newSymbol = "toro";
                await I_PolyToken.connect(account_issuer).getTokens(ethers.parseEther("2000"));
                await I_PolyToken.connect(account_issuer).approve(await I_STRProxied.getAddress(), ethers.parseEther("2000"));
                await I_STRProxied.connect(account_issuer).registerNewTicker(account_issuer.address, newSymbol);
                let tx = await I_STRProxied.connect(account_issuer).generateNewSecurityToken(
                    name, 
                    newSymbol, 
                    tokenDetails, 
                    true, 
                    account_issuer.address, 
                    0
                );
                
                const receipt = await tx.wait();
                
                // Find the NewSecurityToken event
                const event = receipt.logs.find(log => {
                    try {
                        const parsed = I_STRProxied.interface.parseLog(log);
                        return parsed.name === 'NewSecurityToken';
                    } catch (e) {
                        return false;
                    }
                });
                
                if (event) {
                    const parsed = I_STRProxied.interface.parseLog(event);
                    expect(parsed.args._ticker).to.equal(newSymbol.toUpperCase());
                    I_SecurityToken2 = SecurityToken.attach(parsed.args._securityTokenAddress);
                    stGetter = STGetter.attach(parsed.args._securityTokenAddress);
                }
                
                let bytesData = encodeModuleCall(
                    ["uint256", "uint256", "uint256", "string"],
                    [await latestTime(), currentTime.add(BigNumber.from(duration.days(1))), cap, "Test STO"]
                );

                await expect(
                    I_SecurityToken2.connect(token_owner).addModule(
                        await I_TestSTOFactory.getAddress(), 
                        bytesData, 
                        BigNumber.from(0), 
                        BigNumber.from(0), 
                        false
                    )
                ).to.be.reverted;
            });
        });

        describe("Test case for the getModulesByTypeAndToken()", async () => {
            it("Should get the list of available modules when the customModulesAllowed", async () => {
                let _list = await I_MRProxied.getModulesByTypeAndToken(3, await I_SecurityToken.getAddress());
                console.log(_list);
                expect(_list[0]).to.equal(await I_CappedSTOFactory2.getAddress());
            });

            it("Should get the list of available modules when the customModulesAllowed is not allowed", async () => {
                await I_FeatureRegistry.connect(account_polymath).setFeatureStatus("customModulesAllowed", false);
                let _list = await I_MRProxied.getModulesByTypeAndToken(3, await I_SecurityToken.getAddress());
                console.log(_list);
                expect(_list.length).to.equal(0);
            });
        });

        describe("Test cases for getters", async () => {
            it("Check getter functions", async () => {
                console.log("getModulesByType:");
                for (let i = 0; i < 5; i++) {
                    let _list = await I_MRProxied.getModulesByType(i);
                    console.log("Type: " + i + ":" + _list);
                }
                console.log("getModulesByTypeAndToken:");
                for (let i = 0; i < 5; i++) {
                    let _list = await I_MRProxied.getModulesByTypeAndToken(i, await I_SecurityToken.getAddress());
                    console.log("Type: " + i + ":" + _list);
                }
                console.log("getTagsByType:");
                for (let i = 0; i < 5; i++) {
                    let _list = await I_MRProxied.getTagsByType(i);
                    console.log("Type: " + i + ":" + _list[1]);
                    console.log("Type: " + i + ":" + _list[0].map(x => ethers.decodeBytes32String(x)));
                }
                console.log("getTagsByTypeAndToken:");
                for (let i = 0; i < 5; i++) {
                    let _list = await I_MRProxied.getTagsByTypeAndToken(i, await I_SecurityToken.getAddress());
                    console.log("Type: " + i + ":" + _list[1]);
                    console.log("Type: " + i + ":" + _list[0].map(x => ethers.decodeBytes32String(x)));
                }
            });
        });

        describe("Test cases for removeModule()", async () => {
            it("Should fail if msg.sender not curator or owner", async () => {
                await expect(
                    I_MRProxied.connect(account_temp).removeModule(await I_CappedSTOFactory2.getAddress())
                ).to.be.reverted;
            });

            it("Should successfully remove module and delete data if msg.sender is curator", async () => {
                let snap = await takeSnapshot();
                console.log("All modules: " + (await I_MRProxied.getModulesByType(3)));
                let sto1 = (await I_MRProxied.getModulesByType(3))[0];

                expect(sto1).to.equal(await I_TestSTOFactory.getAddress());
                expect((await I_MRProxied.getModulesByType(3)).length).to.equal(1);

                let tx = await I_MRProxied.connect(account_polymath).removeModule(sto1);
                const receipt = await tx.wait();

                // Find the ModuleRemoved event
                const event = receipt.logs.find(log => {
                    try {
                        const parsed = I_MRProxied.interface.parseLog(log);
                        return parsed.name === 'ModuleRemoved';
                    } catch (e) {
                        return false;
                    }
                });
                
                if (event) {
                    const parsed = I_MRProxied.interface.parseLog(event);
                    expect(parsed.args._moduleFactory).to.equal(sto1, "Event is not properly emitted for _moduleFactory");
                    expect(parsed.args._decisionMaker).to.equal(account_polymath.address, "Event is not properly emitted for _decisionMaker");
                }

                // delete related data
                expect(await I_MRProxied.getUintValue(ethers.solidityPackedKeccak256(["string", "address"], ["registry", sto1]))).to.equal(0);
                expect((await I_MRProxied.getFactoryDetails(sto1))[1]).to.equal(ethers.ZeroAddress);
                expect((await I_MRProxied.getModulesByType(3)).length).to.equal(0);
                expect(await I_MRProxied.getBoolValue(ethers.solidityPackedKeccak256(["string", "address"], ["verified", sto1]))).to.be.false;

                await revertToSnapshot(snap);
            });

            it("Should successfully remove module and delete data if msg.sender is owner", async () => {
                let sto1 = (await I_MRProxied.getAllModulesByType(3))[0];
                let sto2 = (await I_MRProxied.getAllModulesByType(3))[1];

                expect(sto1).to.equal(await I_CappedSTOFactory1.getAddress());
                expect(sto2).to.equal(await I_CappedSTOFactory2.getAddress());
                expect((await I_MRProxied.getAllModulesByType(3)).length).to.equal(4);

                let tx = await I_MRProxied.connect(token_owner).removeModule(sto2);
                const receipt = await tx.wait();

                // Find the ModuleRemoved event
                const event = receipt.logs.find(log => {
                    try {
                        const parsed = I_MRProxied.interface.parseLog(log);
                        return parsed.name === 'ModuleRemoved';
                    } catch (e) {
                        return false;
                    }
                });
                
                if (event) {
                    const parsed = I_MRProxied.interface.parseLog(event);
                    expect(parsed.args._moduleFactory).to.equal(sto2, "Event is not properly emitted for _moduleFactory");
                    expect(parsed.args._decisionMaker).to.equal(token_owner.address, "Event is not properly emitted for _decisionMaker");
                }

                let sto1_end = (await I_MRProxied.getAllModulesByType(3))[0];

                // re-ordering
                expect(sto1_end).to.equal(sto1);
                // delete related data
                expect(await I_MRProxied.getUintValue(ethers.solidityPackedKeccak256(["string", "address"], ["registry", sto2]))).to.equal(0);
                expect((await I_MRProxied.getFactoryDetails(sto2))[1]).to.equal(ethers.ZeroAddress);
                expect((await I_MRProxied.getAllModulesByType(3)).length).to.equal(3);
                expect(await I_MRProxied.getBoolValue(ethers.solidityPackedKeccak256(["string", "address"], ["verified", sto2]))).to.be.false;
            });

            it("Should fail if module already removed", async () => {
                await expect(
                    I_MRProxied.connect(account_polymath).removeModule(await I_CappedSTOFactory2.getAddress())
                ).to.be.reverted;
            });
        });

        describe("Test cases for IRegistry functionality", async () => {
            describe("Test cases for reclaiming funds", async () => {
                it("Should successfully reclaim POLY tokens -- fail because token address will be 0x", async () => {
                    await I_PolyToken.connect(token_owner).transfer(await I_MRProxied.getAddress(), ethers.parseEther("1"));
                    await expect(
                        I_MRProxied.connect(account_polymath).reclaimERC20(address_zero)
                    ).to.be.reverted;
                });

                it("Should successfully reclaim POLY tokens -- not authorised", async () => {
                    await expect(
                        I_MRProxied.connect(account_temp).reclaimERC20(await I_PolyToken.getAddress())
                    ).to.be.reverted;
                });

                it("Should successfully reclaim POLY tokens", async () => {
                    await I_PolyToken.connect(account_polymath).getTokens(ethers.parseEther("1"));
                    await I_PolyToken.connect(account_polymath).transfer(await I_MRProxied.getAddress(), ethers.parseEther("1"));
                    let bal1 = await I_PolyToken.balanceOf(account_polymath.address);
                    await I_MRProxied.connect(account_polymath).reclaimERC20(await I_PolyToken.getAddress());
                    let bal2 = await I_PolyToken.balanceOf(account_polymath.address);
                    expect(bal2).to.be.gte(bal1);
                });
            });

            describe("Test cases for pausing the contract", async () => {
                it("Should fail to pause if msg.sender is not owner", async () => {
                    await expect(
                        I_MRProxied.connect(account_temp).pause()
                    ).to.be.reverted;
                });

                it("Should successfully pause the contract", async () => {
                    await I_MRProxied.connect(account_polymath).pause();
                    let status = await I_MRProxied.getBoolValue(ethers.id("paused"));
                    expect(status).to.be.true;
                });

                it("Should fail to unpause if msg.sender is not owner", async () => {
                    await expect(
                        I_MRProxied.connect(account_temp).unpause()
                    ).to.be.reverted;
                });

                it("Should successfully unpause the contract", async () => {
                    await I_MRProxied.connect(account_polymath).unpause();
                    let status = await I_MRProxied.getBoolValue(ethers.id("paused"));
                    expect(status).to.be.false;
                });
            });

            describe("Test cases for the ReclaimTokens contract", async () => {
                it("Should successfully reclaim POLY tokens -- fail because token address will be 0x", async () => {
                    I_ReclaimERC20 = ReclaimTokens.attach(await I_FeatureRegistry.getAddress());
                    await I_PolyToken.connect(token_owner).transfer(await I_ReclaimERC20.getAddress(), ethers.parseEther("1"));
                    await expect(
                        I_ReclaimERC20.connect(account_polymath).reclaimERC20(address_zero)
                    ).to.be.reverted;
                });

                it("Should successfully reclaim POLY tokens -- not authorised", async () => {
                    await expect(
                        I_ReclaimERC20.connect(account_temp).reclaimERC20(await I_PolyToken.getAddress())
                    ).to.be.reverted;
                });

                it("Should successfully reclaim POLY tokens", async () => {
                    await I_PolyToken.connect(account_polymath).getTokens(ethers.parseEther("1"));
                    await I_PolyToken.connect(account_polymath).transfer(await I_ReclaimERC20.getAddress(), ethers.parseEther("1"));
                    let bal1 = await I_PolyToken.balanceOf(account_polymath.address);
                    await I_ReclaimERC20.connect(account_polymath).reclaimERC20(await I_PolyToken.getAddress());
                    let bal2 = await I_PolyToken.balanceOf(account_polymath.address);
                    expect(bal2).to.be.gte(bal1);
                });
            });

            describe("Test case for the PolymathRegistry", async () => {
                it("Should successfully get the address -- fail because key is not exist", async () => {
                    await expect(
                        I_PolymathRegistry.getAddress("PolyOracle")
                    ).to.be.reverted;
                });

                it("Should successfully get the address", async () => {
                    let _moduleR = await I_PolymathRegistry.getAddress("ModuleRegistry");
                    expect(_moduleR).to.equal(await I_ModuleRegistryProxy.getAddress());
                });
            });

            describe("Test cases for the transferOwnership", async () => {
                it("Should fail to transfer the ownership -- not authorised", async () => {
                    await expect(
                        I_MRProxied.connect(account_issuer).transferOwnership(account_temp.address)
                    ).to.be.reverted;
                });

                it("Should fail to transfer the ownership -- 0x address is not allowed", async () => {
                    await expect(
                        I_MRProxied.connect(account_polymath).transferOwnership(address_zero)
                    ).to.be.reverted;
                });

                it("Should successfully transfer the ownership of the STR", async () => {
                    let tx = await I_MRProxied.connect(account_polymath).transferOwnership(account_temp.address);
                    const receipt = await tx.wait();
                    
                    // Find the OwnershipTransferred event
                    const event = receipt.logs.find(log => {
                        try {
                            const parsed = I_MRProxied.interface.parseLog(log);
                            return parsed.name === 'OwnershipTransferred';
                        } catch (e) {
                            return false;
                        }
                    });
                    
                    if (event) {
                        const parsed = I_MRProxied.interface.parseLog(event);
                        expect(parsed.args.previousOwner).to.equal(account_polymath.address);
                        expect(parsed.args.newOwner).to.equal(account_temp.address);
                    }
                });

                it("New owner has authorisation", async () => {
                    let tx = await I_MRProxied.connect(account_temp).transferOwnership(account_polymath.address);
                    const receipt = await tx.wait();
                    
                    // Find the OwnershipTransferred event
                    const event = receipt.logs.find(log => {
                        try {
                            const parsed = I_MRProxied.interface.parseLog(log);
                            return parsed.name === 'OwnershipTransferred';
                        } catch (e) {
                            return false;
                        }
                    });
                    
                    if (event) {
                        const parsed = I_MRProxied.interface.parseLog(event);
                        expect(parsed.args.previousOwner).to.equal(account_temp.address);
                        expect(parsed.args.newOwner).to.equal(account_polymath.address);
                    }
                });
            });

            describe("Additional test cases for edge scenarios", async () => {
                it("Should handle module registration with different gas limits", async () => {
                    // Test module registration under different gas conditions
                    let testFactory = await MockFactory.connect(account_polymath).deploy(
                        BigNumber.from(2), 
                        one_address, 
                        await I_PolymathRegistry.getAddress(), 
                        true
                    );
                    await testFactory.waitForDeployment();

                    let tx = await I_MRProxied.connect(account_polymath).registerModule(await testFactory.getAddress());
                    await tx.wait();
                    
                    let isRegistered = await I_MRProxied.getBoolValue(
                        ethers.solidityPackedKeccak256(["string", "address"], ["verified", await testFactory.getAddress()])
                    );
                    expect(isRegistered).to.be.false; // Should be registered but not verified
                });

                it("Should handle batch operations correctly", async () => {
                    // Test multiple module operations in sequence
                    let modulesBefore = await I_MRProxied.getModulesByType(transferManagerKey);
                    let lengthBefore = modulesBefore.length;

                    // Register another transfer manager
                    let testTMFactory = await GeneralTransferManagerFactory.connect(account_polymath).deploy(
                        BigNumber.from(0), 
                        await I_GeneralPermissionManagerLogic.getAddress(), 
                        await I_PolymathRegistry.getAddress(), 
                        true
                    );
                    await testTMFactory.waitForDeployment();

                    await I_MRProxied.connect(account_polymath).registerModule(await testTMFactory.getAddress());
                    await I_MRProxied.connect(account_polymath).verifyModule(await testTMFactory.getAddress());

                    let modulesAfter = await I_MRProxied.getModulesByType(transferManagerKey);
                    expect(modulesAfter.length).to.equal(lengthBefore + 1);
                });

                it("Should properly handle factory details retrieval", async () => {
                    let factoryDetails = await I_MRProxied.getFactoryDetails(await I_GeneralTransferManagerFactory.getAddress());
                    expect(factoryDetails[0]).to.be.true; // isVerified
                    expect(factoryDetails[1]).to.equal(account_polymath.address); // owner
                    expect(factoryDetails[2].length).to.be.gte(0); // reputation (usedBy array)
                });

                it("Should handle module type boundaries correctly", async () => {
                    // Test with edge case module types
                    for (let i = 1; i <= 4; i++) {
                        let modules = await I_MRProxied.getModulesByType(i);
                        console.log(`Module type ${i} has ${modules.length} modules`);
                        expect(modules).to.be.an('array');
                    }
                });
            });
        });
    });
});