import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-verify";

const config: HardhatUserConfig = {
  mocha: {
    timeout: 900000,
  },
  solidity: {
    compilers: [
      {
        version: "0.8.30",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
            details: { yul: false },
          },
          viaIR: true,
          metadata: {
            bytecodeHash: "none", // disable ipfs
            useLiteralContent: true, // use source code
          },
        },
      },
    ],
  },
  networks: {
    monad: {
      url: "https://monad-testnet.g.alchemy.com/v2/gdtMvd4B_EHr9MjU63dPbo0yvWqOQXE_",
      accounts: ["PRIVATE_KEY"],
      chainId: 10143,
    },
  },
 sourcify: {
    enabled: true,
    apiUrl: "https://sourcify-api-monad.blockvision.org",
    browserUrl: "https://testnet.monadexplorer.com"
  },
  etherscan: {
    enabled: false
  }
};

export default config;
