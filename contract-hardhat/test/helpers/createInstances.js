const { ethers } = require("hardhat");
const { encodeProxyCall } = require("./encodeCall");

// Contract Instance Declaration
let I_USDTieredSTOProxyFactory;
let I_USDTieredSTOFactory;
let I_TrackedRedemptionFactory;
let I_ScheduledCheckpointFactory;
let I_MockBurnFactory;
let I_MockWrongTypeBurnFactory;
let I_ManualApprovalTransferManagerLogic;
let I_ManualApprovalTransferManagerFactory;
let I_LockUpTransferManagerLogic;
let I_LockUpTransferManagerFactory;
let I_PercentageTransferManagerLogic;
let I_PercentageTransferManagerFactory;
let I_EtherDividendCheckpointLogic;
let I_EtherDividendCheckpointFactory;
let I_CountTransferManagerLogic;
let I_CountTransferManagerFactory;
let I_ERC20DividendCheckpointLogic;
let I_ERC20DividendCheckpointFactory;
let I_GeneralPermissionManagerLogic;
let I_VolumeRestrictionTMFactory;
let I_WeightedVoteCheckpointFactory;
let I_GeneralPermissionManagerFactory;
let I_GeneralTransferManagerLogic;
let I_GeneralTransferManagerFactory;
let I_VestingEscrowWalletFactory;
let I_GeneralTransferManager;
let I_VolumeRestrictionTMLogic;
let I_ModuleRegistryProxy;
let I_PreSaleSTOLogic;
let I_PreSaleSTOFactory;
let I_ModuleRegistry;
let I_FeatureRegistry;
let I_SecurityTokenRegistry;
let I_CappedSTOLogic;
let I_CappedSTOFactory;
let I_SecurityToken;
let I_DummySTOLogic;
let I_DummySTOFactory;
let I_PolyToken;
let I_STFactory;
let I_USDTieredSTOLogic;
let I_PolymathRegistry;
let I_SecurityTokenRegistryProxy;
let I_BlacklistTransferManagerLogic;
let I_BlacklistTransferManagerFactory;
let I_VestingEscrowWalletLogic;
let I_STRProxied;
let I_MRProxied;
let I_STRGetter;
let I_STGetter;
let I_SignedTransferManagerFactory;
let I_USDOracle;
let I_POLYOracle;
let I_StablePOLYOracle;
let I_PLCRVotingCheckpointFactory;
let I_WeightedVoteCheckpointLogic;
let I_PLCRVotingCheckpointLogic;

// Initial fee for ticker registry and security token registry
const initRegFee = ethers.parseEther("250");

const STRProxyParameters = ["address", "uint256", "uint256", "address", "address"];
const MRProxyParameters = ["address", "address"];

/// Function use to launch the polymath ecossystem.
async function setUpPolymathNetwork(account_polymath, token_owner) {
    // ----------- POLYMATH NETWORK Configuration ------------
    // Step 1: Deploy the PolyToken and PolymathRegistry
    const a = await deployPolyRegistryAndPolyToken(account_polymath, token_owner);
    // Step 2: Deploy the FeatureRegistry
    const b = await deployFeatureRegistry(account_polymath);
    console.log("FeatureRegistry - " + b[0].target);
    // STEP 3: Deploy the ModuleRegistry
    const c = await deployModuleRegistry(account_polymath);
    console.log("ModuleRegistry - " + c[0].target);
    // STEP 4a: Deploy the GeneralTransferManagerLogic
    const logic = await deployGTMLogic(account_polymath);
    console.log("GeneralTransferManagerLogic - " + logic[0].target);
    // STEP 4b: Deploy the GeneralTransferManagerFactory
    const d = await deployGTM(account_polymath);
    console.log("GeneralTransferManagerFactory - " + d[0].target);
    // Step 6: Deploy the STversionProxy contract
    const e = await deploySTFactory(account_polymath);
    console.log("STFactory - " + e[0].target);
    // Step 7: Deploy the SecurityTokenRegistry
    const f = await deploySTR(account_polymath);
    console.log("SecurityTokenRegistry - " + f[0].target);
    // Step 8: update the registries addresses from the PolymathRegistry contract
    await setInPolymathRegistry(account_polymath);
    console.log("PolymathRegistry updated with all the addresses");
    // STEP 9: Register the Modules with the ModuleRegistry contract
    await registerGTM(account_polymath);
    console.log("ModuleRegistry updated with the GeneralTransferManagerFactory address");
    // STEP 10: Add dummy oracles - doesn't work
    // await addOracles(account_polymath);
    console.log("Oracles weren't added to the PolymathRegistry");

    const tempArray = [
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
        I_STGetter,
        I_USDOracle,
        I_POLYOracle,
        I_StablePOLYOracle
    ];
    return Promise.all(tempArray);
}

async function addOracles(account_polymath) {
    const USDETH = ethers.parseEther("500"); // 500 USD/ETH
    const USDPOLY = ethers.parseEther("0.25"); // 0.25 USD/POLY
    const StableChange = ethers.parseEther("0.1"); // 0.1 USD/POLY
    
    const MockOracle = await ethers.getContractFactory("MockOracle");
    const StableOracle = await ethers.getContractFactory("StableOracle");
    
    I_USDOracle = await MockOracle.deploy(ethers.ZeroAddress, ethers.formatBytes32String("ETH"), ethers.formatBytes32String("USD"), USDETH);
    
    I_POLYOracle = await MockOracle.deploy(I_PolyToken.target, ethers.formatBytes32String("POLY"), ethers.formatBytes32String("USD"), USDPOLY);
    
    I_StablePOLYOracle = await StableOracle.deploy(I_POLYOracle.target, StableChange);
    
    await I_PolymathRegistry.changeAddress("EthUsdOracle", I_USDOracle.target);
    await I_PolymathRegistry.changeAddress("PolyUsdOracle", I_POLYOracle.target);
    await I_PolymathRegistry.changeAddress("StablePolyUsdOracle", I_StablePOLYOracle.target);
}

async function deployPolyRegistryAndPolyToken(account_polymath, token_owner) {
    // Step 0: Deploy the PolymathRegistry
    const PolymathRegistry = await ethers.getContractFactory("PolymathRegistry");
    I_PolymathRegistry = await PolymathRegistry.deploy(account_polymath);

    // Step 1: Deploy the token Faucet and Mint tokens for token_owner
    const PolyTokenFaucet = await ethers.getContractFactory("PolyTokenFaucet");
    I_PolyToken = await PolyTokenFaucet.deploy();

    await I_PolyToken.getTokens(ethers.parseEther("10000"), token_owner);
    await I_PolymathRegistry.changeAddress("PolyToken", I_PolyToken.target);

    return [I_PolymathRegistry, I_PolyToken];
}

async function deployFeatureRegistry(account_polymath) {
    const FeatureRegistry = await ethers.getContractFactory("FeatureRegistry");
    console.log("Deploying FeatureRegistry...", FeatureRegistry);
    I_FeatureRegistry = await FeatureRegistry.deploy(I_PolymathRegistry.target);
    console.log("FeatureRegistry deployed at:", I_FeatureRegistry.target);

    return [I_FeatureRegistry];
}

async function deployModuleRegistry(account_polymath) {
    console.log("Deploying ModuleRegistry...");
    const ModuleRegistry = await ethers.getContractFactory("ModuleRegistry");
    I_ModuleRegistry = await ModuleRegistry.deploy();
    console.log("Deploying ModuleRegistry...", I_ModuleRegistry);

    // Step 3 (b): Deploy the proxy and attach the implementation contract to it
    console.log("Deploying ModuleRegistryProxy...");
    const ModuleRegistryProxy = await ethers.getContractFactory("ModuleRegistryProxy");
    I_ModuleRegistryProxy = await ModuleRegistryProxy.deploy();
    console.log("ModuleRegistryProxy deployed at:", I_ModuleRegistryProxy.target);

    console.log("Preparing to upgrade ModuleRegistryProxy with ModuleRegistry implementation...");
    const bytesMRProxy = encodeProxyCall(MRProxyParameters, [I_PolymathRegistry.target, account_polymath]);
    await I_ModuleRegistryProxy.upgradeToAndCall("1.0.0", I_ModuleRegistry.target, bytesMRProxy);
    console.log("ModuleRegistryProxy upgraded with ModuleRegistry implementation", bytesMRProxy);
    
    console.log("Attaching ModuleRegistryProxy to ModuleRegistry...");
    I_MRProxied = await ethers.getContractAt("ModuleRegistry", I_ModuleRegistryProxy.target);
    console.log("ModuleRegistryProxy attached to ModuleRegistry at:", I_MRProxied.target);

    return [I_ModuleRegistry, I_ModuleRegistryProxy, I_MRProxied];
}

async function deployGTMLogic(account_polymath) {
    const GeneralTransferManager = await ethers.getContractFactory("GeneralTransferManager");
    I_GeneralTransferManagerLogic = await GeneralTransferManager.deploy(
        ethers.ZeroAddress,
        ethers.ZeroAddress
    );

    if (I_GeneralTransferManagerLogic.target === ethers.ZeroAddress) {
        throw new Error("GeneralTransferManagerLogic contract was not deployed");
    }

    return [I_GeneralTransferManagerLogic];
}

async function deployGTM(account_polymath) {
    const GeneralTransferManagerFactory = await ethers.getContractFactory("GeneralTransferManagerFactory");
    I_GeneralTransferManagerFactory = await GeneralTransferManagerFactory.deploy(
        0,
        I_GeneralTransferManagerLogic.target,
        I_PolymathRegistry.target,
        true
    );

    if (I_GeneralTransferManagerFactory.target === ethers.ZeroAddress) {
        throw new Error("GeneralTransferManagerFactory contract was not deployed");
    }

    return [I_GeneralTransferManagerFactory];
}

async function deploySTFactory(account_polymath) {

    const TokenLibFactory = await ethers.getContractFactory("TokenLib");
        const tokenLib = await TokenLibFactory.deploy();
        await tokenLib.waitForDeployment();

    const STGetter = await ethers.getContractFactory("STGetter", {
        libraries: {
            TokenLib: await tokenLib.getAddress(),
        },
        });
    I_STGetter = await STGetter.deploy();

    const SecurityTokenLogic = await ethers.getContractFactory("SecurityToken", {
        libraries: {
            TokenLib: await tokenLib.getAddress(),
        },
        });
    I_SecurityToken = await SecurityTokenLogic.deploy();

    console.log("STL - " + I_SecurityToken.target);

    const DataStoreLogic = await ethers.getContractFactory("DataStore");
    const I_DataStoreLogic = await DataStoreLogic.deploy();

    const DataStoreFactory = await ethers.getContractFactory("DataStoreFactory");
    const I_DataStoreFactory = await DataStoreFactory.deploy(I_DataStoreLogic.target);

    const tokenInitBytes = {
        name: "initialize",
        type: "function",
        inputs: [
            {
                type: "address",
                name: "_getterDelegate"
            }
        ]
    };
    
    const tokenInitBytesCall = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address"],
        [I_STGetter.target]
    );

    const STFactory = await ethers.getContractFactory("STFactory");
    I_STFactory = await STFactory.deploy(
        I_PolymathRegistry.target,
        I_GeneralTransferManagerFactory.target,
        I_DataStoreFactory.target,
        "3.0.0",
        I_SecurityToken.target,
        tokenInitBytesCall
    );

    if (I_STFactory.target === ethers.ZeroAddress) {
        throw new Error("STFactory contract was not deployed");
    }

    return [I_STFactory, I_STGetter];
}

async function deploySTR(account_polymath) {
    const SecurityTokenRegistry = await ethers.getContractFactory("SecurityTokenRegistry");
    I_SecurityTokenRegistry = await SecurityTokenRegistry.deploy();

    if (I_SecurityTokenRegistry.target === ethers.ZeroAddress) {
        throw new Error("SecurityTokenRegistry contract was not deployed");
    }

    // Step 9 (a): Deploy the proxy
    const SecurityTokenRegistryProxy = await ethers.getContractFactory("SecurityTokenRegistryProxy");
    I_SecurityTokenRegistryProxy = await SecurityTokenRegistryProxy.deploy();

    const STRGetter = await ethers.getContractFactory("STRGetter");
    I_STRGetter = await STRGetter.deploy();

    const bytesProxy = encodeProxyCall(STRProxyParameters, [
        I_PolymathRegistry.target,
        initRegFee,
        initRegFee,
        account_polymath,
        I_STRGetter.target
    ]);
    
    await I_SecurityTokenRegistryProxy.upgradeToAndCall("1.0.0", I_SecurityTokenRegistry.target, bytesProxy);
    I_STRProxied = await ethers.getContractAt("SecurityTokenRegistry", I_SecurityTokenRegistryProxy.target);
    
    await I_STRProxied.setProtocolFactory(I_STFactory.target, 3, 0, 0);
    await I_STRProxied.setLatestVersion(3, 0, 0);
    
    I_STRGetter = await ethers.getContractAt("STRGetter", I_SecurityTokenRegistryProxy.target);
    
    return [I_SecurityTokenRegistry, I_SecurityTokenRegistryProxy, I_STRProxied, I_STRGetter];
}

async function setInPolymathRegistry(account_polymath) {
    await I_PolymathRegistry.changeAddress("PolyToken", I_PolyToken.target);
    await I_PolymathRegistry.changeAddress("ModuleRegistry", I_ModuleRegistryProxy.target);
    await I_PolymathRegistry.changeAddress("FeatureRegistry", I_FeatureRegistry.target);
    await I_PolymathRegistry.changeAddress("SecurityTokenRegistry", I_SecurityTokenRegistryProxy.target);
    await I_MRProxied.updateFromRegistry();
}

async function registerGTM(account_polymath) {
    await I_MRProxied.registerModule(I_GeneralTransferManagerFactory.target);
    await I_MRProxied.verifyModule(I_GeneralTransferManagerFactory.target);
}

async function registerAndVerifyByMR(factoryAddress, owner, mr) {
    await mr.registerModule(factoryAddress);
    await mr.verifyModule(factoryAddress);
}

/// Deploy the TransferManagers

async function deployGTMAndVerifyed(accountPolymath, MRProxyInstance, setupCost, feeInPoly = false) {
    const GeneralTransferManagerFactory = await ethers.getContractFactory("GeneralTransferManagerFactory");
    I_GeneralTransferManagerFactory = await GeneralTransferManagerFactory.deploy(
        setupCost,
        I_GeneralTransferManagerLogic.target,
        I_PolymathRegistry.target,
        feeInPoly
    );

    if (I_GeneralTransferManagerFactory.target === ethers.ZeroAddress) {
        throw new Error("GeneralTransferManagerFactory contract was not deployed");
    }

    // (B): Register the GeneralDelegateManagerFactory
    await registerAndVerifyByMR(I_GeneralTransferManagerFactory.target, accountPolymath, MRProxyInstance);
    return Promise.all([I_GeneralTransferManagerFactory]);
}

async function deployVRTMAndVerifyed(accountPolymath, MRProxyInstance, setupCost, feeInPoly = false) {
    const VolumeRestrictionTM = await ethers.getContractFactory("VolumeRestrictionTM");
    I_VolumeRestrictionTMLogic = await VolumeRestrictionTM.deploy(
        ethers.ZeroAddress,
        ethers.ZeroAddress
    );

    const VolumeRestrictionTMFactory = await ethers.getContractFactory("VolumeRestrictionTMFactory");
    I_VolumeRestrictionTMFactory = await VolumeRestrictionTMFactory.deploy(
        setupCost,
        I_VolumeRestrictionTMLogic.target,
        I_PolymathRegistry.target,
        feeInPoly
    );

    if (I_VolumeRestrictionTMFactory.target === ethers.ZeroAddress) {
        throw new Error("VolumeRestrictionTMFactory contract was not deployed");
    }

    // (B): Register the GeneralDelegateManagerFactory
    await registerAndVerifyByMR(I_VolumeRestrictionTMFactory.target, accountPolymath, MRProxyInstance);
    return [I_VolumeRestrictionTMFactory];
}

async function deployCountTMAndVerifyed(accountPolymath, MRProxyInstance, setupCost, feeInPoly = false) {
    const CountTransferManager = await ethers.getContractFactory("CountTransferManager");
    I_CountTransferManagerLogic = await CountTransferManager.deploy(
        ethers.ZeroAddress,
        ethers.ZeroAddress
    );

    const CountTransferManagerFactory = await ethers.getContractFactory("CountTransferManagerFactory");
    I_CountTransferManagerFactory = await CountTransferManagerFactory.deploy(
        setupCost,
        I_CountTransferManagerLogic.target,
        I_PolymathRegistry.target,
        feeInPoly
    );

    if (I_CountTransferManagerFactory.target === ethers.ZeroAddress) {
        throw new Error("CountTransferManagerFactory contract was not deployed");
    }

    await registerAndVerifyByMR(I_CountTransferManagerFactory.target, accountPolymath, MRProxyInstance);
    return Promise.all([I_CountTransferManagerFactory]);
}

async function deployManualApprovalTMAndVerifyed(accountPolymath, MRProxyInstance, setupCost, feeInPoly = false) {
    const ManualApprovalTransferManager = await ethers.getContractFactory("ManualApprovalTransferManager");
    I_ManualApprovalTransferManagerLogic = await ManualApprovalTransferManager.deploy(
        ethers.ZeroAddress,
        ethers.ZeroAddress
    );

    const ManualApprovalTransferManagerFactory = await ethers.getContractFactory("ManualApprovalTransferManagerFactory");
    I_ManualApprovalTransferManagerFactory = await ManualApprovalTransferManagerFactory.deploy(
        setupCost,
        I_ManualApprovalTransferManagerLogic.target,
        I_PolymathRegistry.target,
        feeInPoly
    );

    if (I_ManualApprovalTransferManagerFactory.target === ethers.ZeroAddress) {
        throw new Error("ManualApprovalTransferManagerFactory contract was not deployed");
    }

    await registerAndVerifyByMR(I_ManualApprovalTransferManagerFactory.target, accountPolymath, MRProxyInstance);
    return Promise.all([I_ManualApprovalTransferManagerFactory]);
}

async function deployPercentageTMAndVerified(accountPolymath, MRProxyInstance, setupCost, feeInPoly = false) {
    const PercentageTransferManager = await ethers.getContractFactory("PercentageTransferManager");
    I_PercentageTransferManagerLogic = await PercentageTransferManager.deploy(
        ethers.ZeroAddress,
        ethers.ZeroAddress
    );

    const PercentageTransferManagerFactory = await ethers.getContractFactory("PercentageTransferManagerFactory");
    I_PercentageTransferManagerFactory = await PercentageTransferManagerFactory.deploy(
        setupCost,
        I_PercentageTransferManagerLogic.target,
        I_PolymathRegistry.target,
        feeInPoly
    );

    if (I_PercentageTransferManagerFactory.target === ethers.ZeroAddress) {
        throw new Error("PercentageTransferManagerFactory contract was not deployed");
    }

    await registerAndVerifyByMR(I_PercentageTransferManagerFactory.target, accountPolymath, MRProxyInstance);
    return Promise.all([I_PercentageTransferManagerFactory]);
}

async function deployBlacklistTMAndVerified(accountPolymath, MRProxyInstance, setupCost, feeInPoly = false) {
    const BlacklistTransferManager = await ethers.getContractFactory("BlacklistTransferManager");
    I_BlacklistTransferManagerLogic = await BlacklistTransferManager.deploy(
        ethers.ZeroAddress,
        ethers.ZeroAddress
    );

    const BlacklistTransferManagerFactory = await ethers.getContractFactory("BlacklistTransferManagerFactory");
    I_BlacklistTransferManagerFactory = await BlacklistTransferManagerFactory.deploy(
        setupCost,
        I_BlacklistTransferManagerLogic.target,
        I_PolymathRegistry.target,
        feeInPoly
    );

    if (I_BlacklistTransferManagerFactory.target === ethers.ZeroAddress) {
        throw new Error("BlacklistTransferManagerFactory contract was not deployed");
    }

    await registerAndVerifyByMR(I_BlacklistTransferManagerFactory.target, accountPolymath, MRProxyInstance);
    return [I_BlacklistTransferManagerFactory];
}

async function deployLockUpTMAndVerified(accountPolymath, MRProxyInstance, setupCost, feeInPoly = false) {
    const LockUpTransferManager = await ethers.getContractFactory("LockUpTransferManager");
    I_LockUpTransferManagerLogic = await LockUpTransferManager.deploy(
        ethers.ZeroAddress,
        ethers.ZeroAddress
    );

    const LockUpTransferManagerFactory = await ethers.getContractFactory("LockUpTransferManagerFactory");
    I_LockUpTransferManagerFactory = await LockUpTransferManagerFactory.deploy(
        setupCost,
        I_LockUpTransferManagerLogic.target,
        I_PolymathRegistry.target,
        feeInPoly
    );

    if (I_LockUpTransferManagerFactory.target === ethers.ZeroAddress) {
        throw new Error("LockUpTransferManagerFactory contract was not deployed");
    }

    await registerAndVerifyByMR(I_LockUpTransferManagerFactory.target, accountPolymath, MRProxyInstance);
    return Promise.all([I_LockUpTransferManagerFactory]);
}

async function deployScheduleCheckpointAndVerified(accountPolymath, MRProxyInstance, setupCost, feeInPoly = false) {
    const ScheduledCheckpointFactory = await ethers.getContractFactory("ScheduledCheckpointFactory");
    I_ScheduledCheckpointFactory = await ScheduledCheckpointFactory.deploy(
        setupCost,
        I_PolymathRegistry.target,
        feeInPoly
    );

    if (I_ScheduledCheckpointFactory.target === ethers.ZeroAddress) {
        throw new Error("ScheduledCheckpointFactory contract was not deployed");
    }

    await registerAndVerifyByMR(I_ScheduledCheckpointFactory.target, accountPolymath, MRProxyInstance);
    return Promise.all([I_ScheduledCheckpointFactory]);
}

/// Deploy the Permission Manager

async function deployGPMAndVerifyed(accountPolymath, MRProxyInstance, setupCost, feeInPoly = false) {
    const GeneralPermissionManager = await ethers.getContractFactory("GeneralPermissionManager");
    I_GeneralPermissionManagerLogic = await GeneralPermissionManager.deploy(
        ethers.ZeroAddress,
        ethers.ZeroAddress
    );

    const GeneralPermissionManagerFactory = await ethers.getContractFactory("GeneralPermissionManagerFactory");
    I_GeneralPermissionManagerFactory = await GeneralPermissionManagerFactory.deploy(
        setupCost,
        I_GeneralPermissionManagerLogic.target,
        I_PolymathRegistry.target,
        feeInPoly
    );

    if (I_GeneralPermissionManagerFactory.target === ethers.ZeroAddress) {
        throw new Error("GeneralPermissionManagerFactory contract was not deployed");
    }

    // (B): Register the GeneralDelegateManagerFactory
    await registerAndVerifyByMR(I_GeneralPermissionManagerFactory.target, accountPolymath, MRProxyInstance);
    return Promise.all([I_GeneralPermissionManagerFactory]);
}

/// Deploy the STO Modules

async function deployDummySTOAndVerifyed(accountPolymath, MRProxyInstance, setupCost, feeInPoly = false) {
    const DummySTO = await ethers.getContractFactory("DummySTO");
    I_DummySTOLogic = await DummySTO.deploy(
        ethers.ZeroAddress,
        ethers.ZeroAddress
    );

    const DummySTOFactory = await ethers.getContractFactory("DummySTOFactory");
    I_DummySTOFactory = await DummySTOFactory.deploy(
        setupCost,
        I_DummySTOLogic.target,
        I_PolymathRegistry.target,
        feeInPoly
    );

    if (I_DummySTOFactory.target === ethers.ZeroAddress) {
        throw new Error("DummySTOFactory contract was not deployed");
    }

    await registerAndVerifyByMR(I_DummySTOFactory.target, accountPolymath, MRProxyInstance);
    return Promise.all([I_DummySTOFactory]);
}

async function deployCappedSTOAndVerifyed(accountPolymath, MRProxyInstance, setupCost, feeInPoly = false) {
    const CappedSTO = await ethers.getContractFactory("CappedSTO");
    I_CappedSTOLogic = await CappedSTO.deploy(
        ethers.ZeroAddress,
        ethers.ZeroAddress
    );

    const CappedSTOFactory = await ethers.getContractFactory("CappedSTOFactory");
    I_CappedSTOFactory = await CappedSTOFactory.deploy(
        setupCost,
        I_CappedSTOLogic.target,
        I_PolymathRegistry.target,
        feeInPoly
    );

    if (I_CappedSTOFactory.target === ethers.ZeroAddress) {
        throw new Error("CappedSTOFactory contract was not deployed");
    }

    await registerAndVerifyByMR(I_CappedSTOFactory.target, accountPolymath, MRProxyInstance);
    return Promise.all([I_CappedSTOFactory]);
}

async function deployPresaleSTOAndVerified(accountPolymath, MRProxyInstance, setupCost, feeInPoly = false) {
    const PreSaleSTO = await ethers.getContractFactory("PreSaleSTO");
    I_PreSaleSTOLogic = await PreSaleSTO.deploy(
        ethers.ZeroAddress,
        ethers.ZeroAddress
    );

    const PreSaleSTOFactory = await ethers.getContractFactory("PreSaleSTOFactory");
    I_PreSaleSTOFactory = await PreSaleSTOFactory.deploy(
        setupCost,
        I_PreSaleSTOLogic.target,
        I_PolymathRegistry.target,
        feeInPoly
    );

    if (I_PreSaleSTOFactory.target === ethers.ZeroAddress) {
        throw new Error("PreSaleSTOFactory contract was not deployed");
    }

    await registerAndVerifyByMR(I_PreSaleSTOFactory.target, accountPolymath, MRProxyInstance);
    return Promise.all([I_PreSaleSTOFactory]);
}

async function deployUSDTieredSTOAndVerified(accountPolymath, MRProxyInstance, setupCost, feeInPoly = false) {
    const USDTieredSTO = await ethers.getContractFactory("USDTieredSTO");
    I_USDTieredSTOLogic = await USDTieredSTO.deploy(
        ethers.ZeroAddress,
        ethers.ZeroAddress
    );

    const USDTieredSTOFactory = await ethers.getContractFactory("USDTieredSTOFactory");
    I_USDTieredSTOFactory = await USDTieredSTOFactory.deploy(
        setupCost,
        I_USDTieredSTOLogic.target,
        I_PolymathRegistry.target,
        feeInPoly
    );

    if (I_USDTieredSTOFactory.target === ethers.ZeroAddress) {
        throw new Error("USDTieredSTOFactory contract was not deployed");
    }

    await registerAndVerifyByMR(I_USDTieredSTOFactory.target, accountPolymath, MRProxyInstance);
    return Promise.all([I_USDTieredSTOFactory]);
}

/// Deploy the Dividend Modules

async function deployERC20DividendAndVerifyed(accountPolymath, MRProxyInstance, setupCost, feeInPoly = false) {
    const ERC20DividendCheckpoint = await ethers.getContractFactory("ERC20DividendCheckpoint");
    I_ERC20DividendCheckpointLogic = await ERC20DividendCheckpoint.deploy(
        ethers.ZeroAddress,
        ethers.ZeroAddress
    );

    const ERC20DividendCheckpointFactory = await ethers.getContractFactory("ERC20DividendCheckpointFactory");
    I_ERC20DividendCheckpointFactory = await ERC20DividendCheckpointFactory.deploy(
        setupCost,
        I_ERC20DividendCheckpointLogic.target,
        I_PolymathRegistry.target,
        feeInPoly
    );

    if (I_ERC20DividendCheckpointFactory.target === ethers.ZeroAddress) {
        throw new Error("ERC20DividendCheckpointFactory contract was not deployed");
    }

    await registerAndVerifyByMR(I_ERC20DividendCheckpointFactory.target, accountPolymath, MRProxyInstance);
    return Promise.all([I_ERC20DividendCheckpointFactory]);
}

async function deployEtherDividendAndVerifyed(accountPolymath, MRProxyInstance, setupCost, feeInPoly = false) {
    const EtherDividendCheckpoint = await ethers.getContractFactory("EtherDividendCheckpoint");
    I_EtherDividendCheckpointLogic = await EtherDividendCheckpoint.deploy(
        ethers.ZeroAddress,
        ethers.ZeroAddress
    );

    const EtherDividendCheckpointFactory = await ethers.getContractFactory("EtherDividendCheckpointFactory");
    I_EtherDividendCheckpointFactory = await EtherDividendCheckpointFactory.deploy(
        setupCost,
        I_EtherDividendCheckpointLogic.target,
        I_PolymathRegistry.target,
        feeInPoly
    );

    if (I_EtherDividendCheckpointFactory.target === ethers.ZeroAddress) {
        throw new Error("EtherDividendCheckpointFactory contract was not deployed");
    }

    await registerAndVerifyByMR(I_EtherDividendCheckpointFactory.target, accountPolymath, MRProxyInstance);
    return Promise.all([I_EtherDividendCheckpointFactory]);
}

/// Deploy the Burn Module

async function deployRedemptionAndVerifyed(accountPolymath, MRProxyInstance, setupCost, feeInPoly = false) {
    const TrackedRedemptionFactory = await ethers.getContractFactory("TrackedRedemptionFactory");
    I_TrackedRedemptionFactory = await TrackedRedemptionFactory.deploy(
        setupCost,
        I_PolymathRegistry.target,
        feeInPoly
    );

    if (I_TrackedRedemptionFactory.target === ethers.ZeroAddress) {
        throw new Error("TrackedRedemptionFactory contract was not deployed");
    }

    await registerAndVerifyByMR(I_TrackedRedemptionFactory.target, accountPolymath, MRProxyInstance);
    return Promise.all([I_TrackedRedemptionFactory]);
}

async function deployVestingEscrowWalletAndVerifyed(accountPolymath, MRProxyInstance, setupCost, feeInPoly = false) {
    const VestingEscrowWallet = await ethers.getContractFactory("VestingEscrowWallet");
    I_VestingEscrowWalletLogic = await VestingEscrowWallet.deploy(
        ethers.ZeroAddress,
        ethers.ZeroAddress
    );

    const VestingEscrowWalletFactory = await ethers.getContractFactory("VestingEscrowWalletFactory");
    I_VestingEscrowWalletFactory = await VestingEscrowWalletFactory.deploy(
        setupCost,
        I_VestingEscrowWalletLogic.target,
        I_PolymathRegistry.target,
        feeInPoly
    );

    if (I_VestingEscrowWalletFactory.target === ethers.ZeroAddress) {
        throw new Error("VestingEscrowWalletFactory contract was not deployed");
    }

    await registerAndVerifyByMR(I_VestingEscrowWalletFactory.target, accountPolymath, MRProxyInstance);
    return [I_VestingEscrowWalletFactory];
}

async function deployMockRedemptionAndVerifyed(accountPolymath, MRProxyInstance, setupCost, feeInPoly = false) {
    const MockBurnFactory = await ethers.getContractFactory("MockBurnFactory");
    I_MockBurnFactory = await MockBurnFactory.deploy(
        setupCost,
        I_PolymathRegistry.target,
        feeInPoly
    );

    if (I_MockBurnFactory.target === ethers.ZeroAddress) {
        throw new Error("MockBurnfactory contract was not deployed");
    }

    await registerAndVerifyByMR(I_MockBurnFactory.target, accountPolymath, MRProxyInstance);
    return Promise.all([I_MockBurnFactory]);
}

async function deployMockWrongTypeRedemptionAndVerifyed(accountPolymath, MRProxyInstance, setupCost, feeInPoly = false) {
    const MockWrongTypeFactory = await ethers.getContractFactory("MockWrongTypeFactory");
    I_MockWrongTypeBurnFactory = await MockWrongTypeFactory.deploy(
        setupCost,
        I_PolymathRegistry.target,
        feeInPoly
    );

    if (I_MockWrongTypeBurnFactory.target === ethers.ZeroAddress) {
        throw new Error("MockWrongTypeBurnFactory contract was not deployed");
    }

    await registerAndVerifyByMR(I_MockWrongTypeBurnFactory.target, accountPolymath, MRProxyInstance);
    return Promise.all([I_MockWrongTypeBurnFactory]);
}

async function deploySignedTMAndVerifyed(accountPolymath, MRProxyInstance, setupCost, feeInPoly = false) {
    const SignedTransferManagerFactory = await ethers.getContractFactory("SignedTransferManagerFactory");
    I_SignedTransferManagerFactory = await SignedTransferManagerFactory.deploy(
        setupCost,
        I_PolymathRegistry.target,
        feeInPoly
    );

    if (I_SignedTransferManagerFactory.target === ethers.ZeroAddress) {
        throw new Error("SignedTransferManagerFactory contract was not deployed");
    }

    await registerAndVerifyByMR(I_SignedTransferManagerFactory.target, accountPolymath, MRProxyInstance);
    return [I_SignedTransferManagerFactory];
}

// Deploy voting modules

async function deployPLCRVoteCheckpoint(accountPolymath, MRProxyInstance, setupCost, feeInPoly = false) {
    const PLCRVotingCheckpoint = await ethers.getContractFactory("PLCRVotingCheckpoint");
    I_PLCRVotingCheckpointLogic = await PLCRVotingCheckpoint.deploy(
        ethers.ZeroAddress,
        ethers.ZeroAddress
    );

    const PLCRVotingCheckpointFactory = await ethers.getContractFactory("PLCRVotingCheckpointFactory");
    I_PLCRVotingCheckpointFactory = await PLCRVotingCheckpointFactory.deploy(
        setupCost,
        I_PLCRVotingCheckpointLogic.target,
        I_PolymathRegistry.target,
        feeInPoly
    );

    if (I_PLCRVotingCheckpointFactory.target === ethers.ZeroAddress) {
        throw new Error("PLCRVotingCheckpointFactory contract was not deployed");
    }

    await registerAndVerifyByMR(I_PLCRVotingCheckpointFactory.target, accountPolymath, MRProxyInstance);
    return [I_PLCRVotingCheckpointFactory];
}

// Deploy the voting modules

async function deployWeightedVoteCheckpoint(accountPolymath, MRProxyInstance, setupCost, feeInPoly = false) {
    const WeightedVoteCheckpoint = await ethers.getContractFactory("WeightedVoteCheckpoint");
    I_WeightedVoteCheckpointLogic = await WeightedVoteCheckpoint.deploy(
        ethers.ZeroAddress,
        ethers.ZeroAddress
    );

    const WeightedVoteCheckpointFactory = await ethers.getContractFactory("WeightedVoteCheckpointFactory");
    I_WeightedVoteCheckpointFactory = await WeightedVoteCheckpointFactory.deploy(
        setupCost,
        I_WeightedVoteCheckpointLogic.target,
        I_PolymathRegistry.target,
        feeInPoly
    );

    if (I_WeightedVoteCheckpointFactory.target === ethers.ZeroAddress) {
        throw new Error("WeightedVoteCheckpointFactory contract was not deployed");
    }

    await registerAndVerifyByMR(I_WeightedVoteCheckpointFactory.target, accountPolymath, MRProxyInstance);
    return [I_WeightedVoteCheckpointFactory];
}

module.exports = {
  setUpPolymathNetwork,
  addOracles,
  deployPolyRegistryAndPolyToken,
  deployGTMAndVerifyed,
  deployVRTMAndVerifyed,
  deployCountTMAndVerifyed,
  deployManualApprovalTMAndVerifyed,
  deployPercentageTMAndVerified,
  deployBlacklistTMAndVerified,
  deployLockUpTMAndVerified,
  deployScheduleCheckpointAndVerified,
  deployGPMAndVerifyed,
  deployDummySTOAndVerifyed,
  deployCappedSTOAndVerifyed,
  deployPresaleSTOAndVerified,
  deployUSDTieredSTOAndVerified,
  deployERC20DividendAndVerifyed,
  deployEtherDividendAndVerifyed,
  deployRedemptionAndVerifyed,
  deployVestingEscrowWalletAndVerifyed,
  deployMockRedemptionAndVerifyed,
  deployMockWrongTypeRedemptionAndVerifyed,
  deploySignedTMAndVerifyed,
  deployPLCRVoteCheckpoint,
  deployWeightedVoteCheckpoint,
};
