import { ethers } from "hardhat";
import { ethers as mainEthers } from "ethers";
import assert from "assert";
import { functionSignatureProxy, functionSignatureProxyMR, moduleRegistryABI, moduleRegistryProxyABI, polymathRegistryABI, securityTokenRegistryABI, securityTokenRegistryProxyABI, tokenInitBytes } from "./abi";

const Web3 = require("web3");
let BN = Web3.utils.BN;

const {
  CHAIN_ID,
  OWNER_ADDRESS,
  PROVIDER_URL
} = process.env;


async function main() {
  assert(CHAIN_ID, 'Error: CHAIN_ID');
  assert(OWNER_ADDRESS, 'Error: OWNER_ADDRESS');

  const nullAddress = "0x0000000000000000000000000000000000000000";

  const web3 = new Web3(new Web3.providers.HttpProvider(PROVIDER_URL));

  const { chainId } = await ethers.provider.getNetwork();
  // assert(BigInt(CHAIN_ID!) === chainId, `${CHAIN_ID} !== ${chainId}; wrong .env config?`);

  const deployer = await ethers.getSigner(OWNER_ADDRESS);

  // const PolymathRegistry = await ethers.deployContract("PolymathRegistry", deployer);
  // await PolymathRegistry.waitForDeployment();
  // // @ts-ignore
  // const PolymathRegistryContractAddress = await PolymathRegistry.getAddress();

  // console.log({ PolymathRegistryContractAddress })

  // const ModuleRegistry = await ethers.deployContract("ModuleRegistry", deployer);
  // await ModuleRegistry.waitForDeployment();
  // const ModuleRegistryContractAddress = await ModuleRegistry.getAddress();

  // console.log({ ModuleRegistryContractAddress })

  // const PolyTokenFaucet = await ethers.deployContract("PolyTokenFaucet", deployer);
  // await PolyTokenFaucet.waitForDeployment();
  // const PolyTokenFaucetContractAddress = await PolyTokenFaucet.getAddress();

  // console.log({PolyTokenFaucetContractAddress})

  // const TradingRestrictionManager = await ethers.deployContract("TradingRestrictionManager", deployer);
  // await TradingRestrictionManager.waitForDeployment();
  // const TradingRestrictionManagerContractAddress = await TradingRestrictionManager.getAddress();

  // console.log({ TradingRestrictionManagerContractAddress })

  // const SampleNFT = await ethers.deployContract("SampleNFT", deployer);
  // await SampleNFT.waitForDeployment();
  // const SampleNFTContractAddress = await SampleNFT.getAddress();

  // console.log({ SampleNFTContractAddress })

  // const paddedPOLY = ethers.zeroPadValue(web3.utils.fromAscii("POLY"), 32)
  // const paddedUSD = ethers.zeroPadValue(web3.utils.fromAscii("USD"), 32)
  // const paddedETH = ethers.zeroPadValue(web3.utils.fromAscii("ETH"), 32)

  // console.log({
  //   paddedPOLY,
  //   paddedUSD,
  //   paddedETH
  // })

  // const PolyMockOracle = await ethers.deployContract("MockOracle", [PolyTokenFaucetContractAddress, paddedPOLY, paddedUSD, "50000000000000000000"], deployer);
  // await PolyMockOracle.waitForDeployment();
  // const PolyMockOracleContractAddress = await PolyMockOracle.getAddress();

  // console.log({PolyMockOracleContractAddress})

  // const StableOracle = await ethers.deployContract("StableOracle",[PolyMockOracleContractAddress, "10000000000000000"], deployer);
  // await StableOracle.waitForDeployment();
  // const StableOracleContractAddress = await StableOracle.getAddress();

  // console.log({StableOracleContractAddress})

  // const ETHOracle = await ethers.deployContract("MockOracle",[nullAddress, paddedETH, paddedUSD, "500000000000000000000"], deployer);
  // await ETHOracle.waitForDeployment();
  // const ETHOracleContractAddress = await ETHOracle.getAddress();

  // console.log({ETHOracleContractAddress})


  // const PolyToken = PolyTokenFaucetContractAddress
  const PolymathAccount = OWNER_ADDRESS;
  const PolymathRegistryContractAddress = '0x31DfFc4a970f141428D17604C0c3c4e472D7A9FA'


  // // Connect to the deployed contract using its address and ABI
  const polymathRegistry = new mainEthers.Contract(PolymathRegistryContractAddress, polymathRegistryABI, deployer);

  
  // await polymathRegistry.changeAddress("PolyToken", PolyToken)

  // const TokenLib = await ethers.deployContract("TokenLib", deployer);
  // await TokenLib.waitForDeployment();
  // const TokenLibContractAddress = await TokenLib.getAddress();

  // console.log({ TokenLibContractAddress })

  // const VolumeRestrictionLib = await ethers.deployContract("VolumeRestrictionLib", deployer);
  // await VolumeRestrictionLib.waitForDeployment();
  // const VolumeRestrictionLibContractAddress = await VolumeRestrictionLib.getAddress();

  // console.log({ VolumeRestrictionLibContractAddress })

  // const ModuleRegistryProxy = await ethers.deployContract("ModuleRegistryProxy", deployer);
  // await ModuleRegistryProxy.waitForDeployment();
  // const ModuleRegistryProxyContractAddress = await ModuleRegistryProxy.getAddress();

  // console.log({ ModuleRegistryProxyContractAddress })
  
  // const moduleRegistryProxy = new mainEthers.Contract(ModuleRegistryProxyContractAddress, moduleRegistryProxyABI, deployer);

  // let bytesProxyMR = web3.eth.abi.encodeFunctionCall(functionSignatureProxyMR, [PolymathRegistryContractAddress, PolymathAccount]);
  // await moduleRegistryProxy.upgradeToAndCall("1.0.0", ModuleRegistryContractAddress, bytesProxyMR, { from: PolymathAccount });
  
  // await polymathRegistry.changeAddress("ModuleRegistry", ModuleRegistryProxyContractAddress, { from: PolymathAccount });
  
  // const GeneralTransferManagerLogic = await ethers.deployContract("GeneralTransferManager", [nullAddress, nullAddress,], deployer);
  // await GeneralTransferManagerLogic.waitForDeployment();
  // const GeneralTransferManagerLogicContractAddress = await GeneralTransferManagerLogic.getAddress();
  // console.log({ GeneralTransferManagerLogicContractAddress })

  // const GeneralPermissionManagerLogic = await ethers.deployContract("GeneralPermissionManager", [nullAddress, nullAddress,], deployer);
  // await GeneralPermissionManagerLogic.waitForDeployment();
  // const GeneralPermissionManagerLogicContractAddress = await GeneralPermissionManagerLogic.getAddress();
  // console.log({ GeneralPermissionManagerLogicContractAddress })
  
  // const CountTransferManagerLogic = await ethers.deployContract("CountTransferManager", [nullAddress, nullAddress,], deployer);
  // await CountTransferManagerLogic.waitForDeployment();
  // const CountTransferManagerLogicContractAddress = await CountTransferManagerLogic.getAddress();
  // console.log({ CountTransferManagerLogicContractAddress })

  // const ManualApprovalTransferManagerLogic = await ethers.deployContract("ManualApprovalTransferManager", [nullAddress, nullAddress,], deployer);
  // await ManualApprovalTransferManagerLogic.waitForDeployment();
  // const ManualApprovalTransferManagerLogicContractAddress = await ManualApprovalTransferManagerLogic.getAddress();
  // console.log({ ManualApprovalTransferManagerLogicContractAddress })

  // const PercentageTransferManagerLogic = await ethers.deployContract("PercentageTransferManager", [nullAddress, nullAddress,], deployer);
  // await PercentageTransferManagerLogic.waitForDeployment();
  // const PercentageTransferManagerLogicContractAddress = await PercentageTransferManagerLogic.getAddress();
  // console.log({ PercentageTransferManagerLogicContractAddress })
  
  // const ERC20DividendCheckpointLogic = await ethers.deployContract("ERC20DividendCheckpoint", [nullAddress, nullAddress,], deployer);
  // await ERC20DividendCheckpointLogic.waitForDeployment();
  // const ERC20DividendCheckpointLogicContractAddress = await ERC20DividendCheckpointLogic.getAddress();
  // console.log({ ERC20DividendCheckpointLogicContractAddress })

  // const EtherDividendCheckpointLogic = await ethers.deployContract("EtherDividendCheckpoint", [nullAddress, nullAddress,], deployer);
  // await EtherDividendCheckpointLogic.waitForDeployment();
  // const EtherDividendCheckpointLogicContractAddress = await EtherDividendCheckpointLogic.getAddress();
  // console.log({ EtherDividendCheckpointLogicContractAddress })

  // const USDTieredSTOLogic = await ethers.deployContract("USDTieredSTO", [nullAddress, nullAddress,], deployer);
  // await USDTieredSTOLogic.waitForDeployment();
  // const USDTieredSTOLogicContractAddress = await USDTieredSTOLogic.getAddress();
  // console.log({ USDTieredSTOLogicContractAddress })


  // const VolumeRestrictionTMLogic= await ethers.getContractFactory("VolumeRestrictionTM",  { 
  //   signer: deployer, 
  //   libraries: { 
  //     VolumeRestrictionLib: VolumeRestrictionLibContractAddress
  //   } 
  // });
  // const volumeRestrictionTMLogic = await VolumeRestrictionTMLogic.deploy(nullAddress, nullAddress);
  // const volumeRestrictionTMLogicContractAddress = await volumeRestrictionTMLogic.getAddress();

  // console.log({volumeRestrictionTMLogicContractAddress})
  
  // const CappedSTOLogic = await ethers.deployContract("CappedSTO", [nullAddress, nullAddress], deployer);
  // await CappedSTOLogic.waitForDeployment();
  // const CappedSTOLogicContractAddress = await CappedSTOLogic.getAddress();
  
  // console.log({CappedSTOLogicContractAddress})
  
  // const VestingEscrowWalletLogic = await ethers.deployContract("VestingEscrowWallet", [nullAddress, nullAddress], deployer);
  // await VestingEscrowWalletLogic.waitForDeployment();
  // const VestingEscrowWalletLogicContractAddress = await VestingEscrowWalletLogic.getAddress();
  // console.log({VestingEscrowWalletLogicContractAddress})
  
  // const GeneralFractionalizerLogic = await ethers.deployContract("GeneralFractionalizer", [nullAddress, nullAddress], deployer);
  // await GeneralFractionalizerLogic.waitForDeployment();
  // const GeneralFractionalizerLogicContractAddress = await GeneralFractionalizerLogic.getAddress();
  // console.log({ GeneralFractionalizerLogicContractAddress })
  
  // const DataStoreLogic = await ethers.deployContract("DataStore", deployer);
  // await DataStoreLogic.waitForDeployment();

  // // @ts-ignore
  // const DataStoreLogicContractAddress = await DataStoreLogic.getAddress();
  // console.log({DataStoreLogicContractAddress})

  // const SecurityTokenLogic= await ethers.getContractFactory("SecurityToken",  { 
  //   signer: deployer, 
  //   libraries: { 
  //     TokenLib: TokenLibContractAddress
  //   } 
  // });
  // const securityTokenLogic = await SecurityTokenLogic.deploy();
  // const SecurityTokenLogicContractAddress = await securityTokenLogic.getAddress();
  // console.log({SecurityTokenLogicContractAddress})

  // const DataStoreFactory = await ethers.deployContract("DataStoreFactory", [DataStoreLogicContractAddress], deployer);
  // await DataStoreFactory.waitForDeployment();
  // const DataStoreFactoryContractAddress = await DataStoreFactory.getAddress();
  // console.log({DataStoreFactoryContractAddress})

  // const GeneralTransferManagerFactory = await ethers.deployContract("GeneralTransferManagerFactory", [0, GeneralTransferManagerLogicContractAddress, PolymathRegistryContractAddress], deployer);
  // await GeneralTransferManagerFactory.waitForDeployment();
  // const GeneralTransferManagerFactoryContractAddress = await GeneralTransferManagerFactory.getAddress();
  // console.log({GeneralTransferManagerFactoryContractAddress})

  // const GeneralPermissionManagerFactory = await ethers.deployContract("GeneralPermissionManagerFactory", [0, GeneralPermissionManagerLogicContractAddress, PolymathRegistryContractAddress], deployer);
  // await GeneralPermissionManagerFactory.waitForDeployment();
  // const GeneralPermissionManagerFactoryContractAddress = await GeneralPermissionManagerFactory.getAddress();
  // console.log({GeneralPermissionManagerFactoryContractAddress})

  // const CountTransferManagerFactory = await ethers.deployContract("CountTransferManagerFactory", [0, CountTransferManagerLogicContractAddress, PolymathRegistryContractAddress], deployer);
  // await CountTransferManagerFactory.waitForDeployment();
  // const CountTransferManagerFactoryContractAddress = await CountTransferManagerFactory.getAddress();
  // console.log({CountTransferManagerFactoryContractAddress})

  // const PercentageTransferManagerFactory = await ethers.deployContract("PercentageTransferManagerFactory", [0, PercentageTransferManagerLogicContractAddress, PolymathRegistryContractAddress], deployer);
  // await PercentageTransferManagerFactory.waitForDeployment();
  // const PercentageTransferManagerFactoryContractAddress = await PercentageTransferManagerFactory.getAddress();
  // console.log({PercentageTransferManagerFactoryContractAddress})

  // const EtherDividendCheckpointFactory = await ethers.deployContract("EtherDividendCheckpointFactory", [0, EtherDividendCheckpointLogicContractAddress, PolymathRegistryContractAddress], deployer);
  // await EtherDividendCheckpointFactory.waitForDeployment();
  // const EtherDividendCheckpointFactoryContractAddress = await EtherDividendCheckpointFactory.getAddress();
  // console.log({EtherDividendCheckpointFactoryContractAddress})

  // const ERC20DividendCheckpointFactory = await ethers.deployContract("ERC20DividendCheckpointFactory", [0, ERC20DividendCheckpointLogicContractAddress, PolymathRegistryContractAddress], deployer);
  // await ERC20DividendCheckpointFactory.waitForDeployment();
  // const ERC20DividendCheckpointFactoryContractAddress = await ERC20DividendCheckpointFactory.getAddress();
  // console.log({ERC20DividendCheckpointFactoryContractAddress})

  // const VolumeRestrictionTMFactory = await ethers.deployContract("VolumeRestrictionTMFactory", [0, volumeRestrictionTMLogicContractAddress, PolymathRegistryContractAddress], deployer);
  // await VolumeRestrictionTMFactory.waitForDeployment();
  // const VolumeRestrictionTMFactoryContractAddress = await VolumeRestrictionTMFactory.getAddress();
  // console.log({VolumeRestrictionTMFactoryContractAddress})

  // const ManualApprovalTransferManagerFactory = await ethers.deployContract("ManualApprovalTransferManagerFactory", [0, ManualApprovalTransferManagerLogicContractAddress, PolymathRegistryContractAddress], deployer);
  // await ManualApprovalTransferManagerFactory.waitForDeployment();
  // const ManualApprovalTransferManagerFactoryContractAddress = await ManualApprovalTransferManagerFactory.getAddress();
  // console.log({ManualApprovalTransferManagerFactoryContractAddress})

  // const VestingEscrowWalletFactory = await ethers.deployContract("VestingEscrowWalletFactory", [0, VestingEscrowWalletLogicContractAddress, PolymathRegistryContractAddress], deployer);
  // await VestingEscrowWalletFactory.waitForDeployment();
  // const VestingEscrowWalletFactoryContractAddress = await VestingEscrowWalletFactory.getAddress();
  // console.log({VestingEscrowWalletFactoryContractAddress})

  // const GeneralFractionalizerFactory = await ethers.deployContract("GeneralFractionalizerFactory", [0, GeneralFractionalizerLogicContractAddress, PolymathRegistryContractAddress], deployer);
  // await GeneralFractionalizerFactory.waitForDeployment();
  // const GeneralFractionalizerFactoryContractAddress = await GeneralFractionalizerFactory.getAddress();
  // console.log({ GeneralFractionalizerFactoryContractAddress })

  // const STGetter = await ethers.getContractFactory("STGetter",  { 
  //   signer: deployer, 
  //   libraries: { 
  //     TokenLib: TokenLibContractAddress
  //   } 
  // });
  // const sTGetter = await STGetter.deploy();
  // const STGetterContractAddress = await sTGetter.getAddress();
  // console.log({STGetterContractAddress})


  // let tokenInitBytesCall = web3.eth.abi.encodeFunctionCall(tokenInitBytes, [STGetterContractAddress]);
  // console.log({tokenInitBytesCall})
  


  // const STFactory = await ethers.deployContract("STFactory", [PolymathRegistryContractAddress, GeneralTransferManagerFactoryContractAddress, DataStoreFactoryContractAddress, "3.0.0", SecurityTokenLogicContractAddress, tokenInitBytesCall], deployer);
  // await STFactory.waitForDeployment();
  // const STFactoryContractAddress = await STFactory.getAddress();
  // console.log({STFactoryContractAddress})

  // const FeatureRegistry = await ethers.deployContract("FeatureRegistry", deployer);
  // await FeatureRegistry.waitForDeployment();
  // const FeatureRegistryContractAddress = await FeatureRegistry.getAddress();
  // console.log({FeatureRegistryContractAddress})

  // await polymathRegistry.changeAddress("FeatureRegistry", FeatureRegistryContractAddress);

  // const SecurityTokenRegistry = await ethers.deployContract("SecurityTokenRegistry", deployer);
  // await SecurityTokenRegistry.waitForDeployment();
  // const SecurityTokenRegistryContractAddress = await SecurityTokenRegistry.getAddress();
  // console.log({SecurityTokenRegistryContractAddress})

  // const SecurityTokenRegistryProxy = await ethers.deployContract("SecurityTokenRegistryProxy", deployer);
  // await SecurityTokenRegistryProxy.waitForDeployment();
  // const SecurityTokenRegistryProxyContractAddress = await SecurityTokenRegistryProxy.getAddress();
  // console.log({SecurityTokenRegistryProxyContractAddress})

  // const STRGetter = await ethers.deployContract("STRGetter", deployer);
  // await STRGetter.waitForDeployment();
  // const STRGetterContractAddress = await STRGetter.getAddress();
  // console.log({STRGetterContractAddress})




  const ModuleRegistryContractAddress = '0xBf070b617d6EA34EE7C9B3953f3940C1Bc943d2E'


  const PolyTokenFaucetContractAddress = '0x687b4100Aa3790154fCE2532364f373368a0D1CE'


  const TradingRestrictionManagerContractAddress = '0x779F0BBff7823d74018B0C4DC8D3c3A681b3a265'


  const SampleNFTContractAddress = '0xc812C10b26ccf7D1942F0C2310b02D08A465cfF8'


  const paddedPOLY = '0x00000000000000000000000000000000000000000000000000000000504f4c59'
  const paddedUSD = '0x0000000000000000000000000000000000000000000000000000000000555344'
  const paddedETH = '0x0000000000000000000000000000000000000000000000000000000000455448'


  const PolyMockOracleContractAddress = '0x7B71Fa15DF3B223CeaC75EFBDbf89af2F072e1FA'


  const StableOracleContractAddress = '0xb08862200327446C6fe530F175d0fDfE5d2dd643'


  const ETHOracleContractAddress = '0xd2daBCDDC3A9c3b24f956fA9c52255fE77B13621'


  const TokenLibContractAddress = '0xa583266f9a2Bf022F53447FF93c0880c08A4FD26'


  const VolumeRestrictionLibContractAddress = '0x8BFd6Af191d86ADa42d13dCD6a26875C504BF75e'


  const ModuleRegistryProxyContractAddress = '0xC9253BaC2b0bf2BDC763dAFca34D1f98A9E9F401'


  const GeneralTransferManagerLogicContractAddress = '0x334d2EB482B3A7Bb63d9E765dfe94786E547180D'


  const GeneralPermissionManagerLogicContractAddress = '0xD5546201b59658385683F604e3E51E617596B9Db'


  const CountTransferManagerLogicContractAddress = '0x341338330eE0347f24367F847545d27C5C5446F5'


  const ManualApprovalTransferManagerLogicContractAddress = '0x0C1E8f427FA967D032BC2848EFB63D63Be8193A2'


  const PercentageTransferManagerLogicContractAddress = '0x251A27dA5e5c3F2d101D4478f7CbE930CAb9518C'


  const ERC20DividendCheckpointLogicContractAddress = '0x87bC56d20F1bD0525548D6031e547bc0045c6F6E'


  const EtherDividendCheckpointLogicContractAddress = '0xc1c1B84ff1C7FF18E0A752B9C64bebb09E41Dc19'


  const USDTieredSTOLogicContractAddress = '0x2B4EA27C06ec0bB61ad08Eb3305Ebcbb1694d230'


  const volumeRestrictionTMLogicContractAddress = '0x9c83b333042f73CF76E39b7a22fC5960900669b3'


  const CappedSTOLogicContractAddress = '0xFD22E427B6a2E5982b5317ce20731E1b77896eeC'


  const VestingEscrowWalletLogicContractAddress = '0x751040F83A414aA6A12f8C559bFBF22d553cCf24'


  const GeneralFractionalizerLogicContractAddress = '0xfc9018B1F0F2A6464B928C0fAAD7eb8b7F74dB10'


  const DataStoreLogicContractAddress = '0x401869F05ec3F88367be73A664819C390aa5C2cA'


  const SecurityTokenLogicContractAddress = '0x63C6Bbb5034A20A56179f55AE05cdCA83778e981'


  const DataStoreFactoryContractAddress = '0x2866261610108E1a366548A881fe7B4C4cfd6fA0'


  const GeneralTransferManagerFactoryContractAddress = '0x1353C029C8Dc12Dce91789feBCD5d1fE6035bc1E'


  const GeneralPermissionManagerFactoryContractAddress = '0x92eadb277eC734e16dCd6b1F80b40a9F196aFB14'


  const CountTransferManagerFactoryContractAddress = '0x0C5b3Ab3e2Ec12e252654fd6681D101c321157E9'


  const PercentageTransferManagerFactoryContractAddress = '0xcc7d395cA21d851C8A5A862378b5f23696b345EB'


  const EtherDividendCheckpointFactoryContractAddress = '0xB73B2d2AD5848996d0488CAD523bA99Ff2Bc1A7A'


  const ERC20DividendCheckpointFactoryContractAddress = '0x8259199b484aa93BDC2aeDBA09c2b280b5178d9A'


  const VolumeRestrictionTMFactoryContractAddress = '0x742B44Dd838A01380aFDA27abDE81fb794f25936'


  const ManualApprovalTransferManagerFactoryContractAddress = '0x7C7B9aa503e2316DD36C62bD7De072DD03B7bE92'


  const VestingEscrowWalletFactoryContractAddress = '0xf6A44dD4bc6aA428a013E3A2c258F5C258C58a96'


  const GeneralFractionalizerFactoryContractAddress = '0x2D5D29B63AA4Dac23C5ceEE1a022f426D841a67e'


  const STGetterContractAddress = '0xBD26053De1C1ded602E93eC35075301304b19e4e'


  const tokenInitBytesCall = '0xc4d66de8000000000000000000000000bd26053de1c1ded602e93ec35075301304b19e4e'


  const STFactoryContractAddress = '0x6cCbB2806242C62FE8aea80bbe684B948cE51762'


  const FeatureRegistryContractAddress = '0xE6a36D38771F7e65354755Aca46F0d9fcCBfa416'


  const SecurityTokenRegistryContractAddress = '0xdABC31bC1bdDd586FADBdA156622B9E9D95a6cd7'


  const SecurityTokenRegistryProxyContractAddress = '0x95912acEeafC651Ac3575255421c3ddB797A5233'


  const STRGetterContractAddress = '0xdBB3Ca18AeE8a508a08ed0FC4b2E8803ad5aEE02'



  const initRegFee = 0;

  let bytesProxy = web3.eth.abi.encodeFunctionCall(functionSignatureProxy, [
      PolymathRegistryContractAddress,
      initRegFee.toString(),
      initRegFee.toString(),
      OWNER_ADDRESS,
      STRGetterContractAddress
  ]);

  const securityTokenRegistryProxy = new mainEthers.Contract(SecurityTokenRegistryProxyContractAddress, securityTokenRegistryProxyABI, deployer);

  // await securityTokenRegistryProxy.upgradeToAndCall("1.0.0", SecurityTokenRegistryContractAddress, bytesProxy, { from: PolymathAccount });

  const xSecurityTokenRegistry = new mainEthers.Contract(SecurityTokenRegistryProxyContractAddress, securityTokenRegistryABI, deployer);
  // await xSecurityTokenRegistry.setProtocolFactory(STFactoryContractAddress, 3, 0, 0)
  // await xSecurityTokenRegistry.setLatestVersion(3, 0, 0);

  
  // await polymathRegistry.changeAddress("SecurityTokenRegistry", SecurityTokenRegistryProxyContractAddress);

  const moduleRegistry = new mainEthers.Contract(ModuleRegistryProxyContractAddress, moduleRegistryABI, deployer);
  
  
  // await moduleRegistry.updateFromRegistry()
  
  // await moduleRegistry.registerModule(PercentageTransferManagerFactoryContractAddress)
  // await moduleRegistry.registerModule(CountTransferManagerFactoryContractAddress)
  // await moduleRegistry.registerModule(GeneralTransferManagerFactoryContractAddress)
  // await moduleRegistry.registerModule(GeneralPermissionManagerFactoryContractAddress)
  // await moduleRegistry.registerModule(EtherDividendCheckpointFactoryContractAddress)
  // await moduleRegistry.registerModule(VolumeRestrictionTMFactoryContractAddress)
  // await moduleRegistry.registerModule(ManualApprovalTransferManagerFactoryContractAddress)
  // await moduleRegistry.registerModule(ERC20DividendCheckpointFactoryContractAddress)
  // await moduleRegistry.registerModule(VestingEscrowWalletFactoryContractAddress)
  // await moduleRegistry.registerModule(GeneralFractionalizerFactoryContractAddress)
  
  await moduleRegistry.verifyModule(GeneralTransferManagerFactoryContractAddress)
  await moduleRegistry.verifyModule(CountTransferManagerFactoryContractAddress)
  await moduleRegistry.verifyModule(PercentageTransferManagerFactoryContractAddress)
  await moduleRegistry.verifyModule(GeneralPermissionManagerFactoryContractAddress)
  await moduleRegistry.verifyModule(EtherDividendCheckpointFactoryContractAddress)
  await moduleRegistry.verifyModule(ERC20DividendCheckpointFactoryContractAddress)
  await moduleRegistry.verifyModule(VolumeRestrictionTMFactoryContractAddress,)
  await moduleRegistry.verifyModule(ManualApprovalTransferManagerFactoryContractAddress)
  await moduleRegistry.verifyModule(VestingEscrowWalletFactoryContractAddress)
  await moduleRegistry.verifyModule(GeneralFractionalizerFactoryContractAddress)

  const CappedSTOFactory = await ethers.deployContract("CappedSTOFactory", [0, CappedSTOLogicContractAddress, PolymathRegistryContractAddress], deployer);
  await CappedSTOFactory.waitForDeployment();
  const CappedSTOFactoryContractAddress = await CappedSTOFactory.getAddress();
  console.log({CappedSTOFactoryContractAddress})

  await moduleRegistry.registerModule(CappedSTOFactoryContractAddress)
  await moduleRegistry.verifyModule(CappedSTOFactoryContractAddress)

  const USDTieredSTOFactory = await ethers.deployContract("USDTieredSTOFactory", [0, USDTieredSTOLogicContractAddress, PolymathRegistryContractAddress], deployer);
  await USDTieredSTOFactory.waitForDeployment();
  const USDTieredSTOFactoryContractAddress = await USDTieredSTOFactory.getAddress();
  console.log({USDTieredSTOFactoryContractAddress})

  await moduleRegistry.registerModule(USDTieredSTOFactoryContractAddress)
  await moduleRegistry.verifyModule(USDTieredSTOFactoryContractAddress)

  await polymathRegistry.changeAddress("PolyToken", PolyTokenFaucetContractAddress);
  await polymathRegistry.changeAddress("PolyUsdOracle", PolyMockOracleContractAddress);
  await polymathRegistry.changeAddress("EthUsdOracle", ETHOracleContractAddress);
  await polymathRegistry.changeAddress("StablePolyUsdOracle", StableOracleContractAddress);
  
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
