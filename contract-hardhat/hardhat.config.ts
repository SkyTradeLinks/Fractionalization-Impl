import { HardhatUserConfig } from "hardhat/config";
import dotenv from "dotenv";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-verify";


const dotenvResult = dotenv.config();
if (dotenvResult.error) {
  throw dotenvResult.error;
}

const { PROVIDER_URL, OWNER_PRIVATE_KEY, ETHERSCAN_API_KEY } = process.env;
const accounts = [...(OWNER_PRIVATE_KEY ? [OWNER_PRIVATE_KEY] : [])];

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
      {
        version: "0.8.17",
        settings: {
          optimizer: {
            enabled: true,
            runs: 1000,
          },
          viaIR: true,
        },
      },
    ],
  },
  networks: {
    local: {
      url: PROVIDER_URL,
      chainId: 31337,
    },
    hardhat: {
      // This is the crucial part
      forking: {
        url: "", // Your RPC URL
        // Optional: pin the block number for consistent tests
        blockNumber: 19000000
      },
      chainId: 1337, // Keep the local chainId
    },
    localhost: {
      chainId: 1337,
      url: "http://localhost:8545",
    },
    baseSepolia: {
      url: PROVIDER_URL,
      accounts,
      chainId: 84532,
      timeout: 60 * 60 * 1000, // 1 hour
    },
    monadTestnet: {
      url: PROVIDER_URL,
      accounts,
      chainId: 10143,
      timeout: 60 * 60 * 1000, // 1 hour
    },
    bnbMainnet: {
      url: PROVIDER_URL,
      accounts,
      chainId: 56,
      timeout: 60 * 60 * 1000, // 1 hour
    },
    polygonMainnet: {
      url: PROVIDER_URL,
      accounts,
      chainId: 137,
      timeout: 60 * 60 * 1000, // 1 hour
    },
    mantleMainnet: {
      url: PROVIDER_URL,
      accounts,
      chainId: 5000,
      timeout: 60 * 60 * 1000, // 1 hour
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
