import { HardhatUserConfig } from "hardhat/config";
import dotenv from 'dotenv';
import "@nomicfoundation/hardhat-toolbox";

const dotenvResult = dotenv.config();
if (dotenvResult.error) {
  throw dotenvResult.error;
}

const {
  PROVIDER_URL,
  OWNER_PRIVATE_KEY,
  ETHERSCAN_API_KEY,
} = process.env;

const accounts = [...(OWNER_PRIVATE_KEY ? [OWNER_PRIVATE_KEY] : [])];

const config: HardhatUserConfig = {
  networks: {
    local: {
      url: PROVIDER_URL,
      chainId: 31337,
    },
    hardhat: {
      chainId: 1337,
    },
    localhost: {
      chainId: 1337,
      url: 'http://localhost:8545',
    },
    goerli: {
      url: PROVIDER_URL,
      accounts,
      chainId: 5,
    },
    bscTestnet: {
      url: PROVIDER_URL,
      accounts,
      chainId: 97,
      timeout: 60 * 60 * 1000 // 1 hour
    },
    baseSepoliaTestnet: {
      url: PROVIDER_URL,
      accounts,
      chainId: 84532,
      timeout: 60 * 60 * 1000 // 1 hour
    },
    baseMainnet: {
      url: PROVIDER_URL,
      accounts,
      chainId: 8453,
      timeout: 60 * 60 * 1000 // 1 hour
    },
    plume: {
      url: "https://phoenix-rpc.plumenetwork.xyz",
      chainId: 98866,
      accounts,
    }
  }, 
  solidity: {
    version: '0.5.8',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  // etherscan: {
  //   apiKey: ETHERSCAN_API_KEY
  // },
  etherscan: {
    apiKey: {
      "plume": "test"
    },
    customChains: [
      {
        network: "plume",
        chainId: 98866,
        urls: {
          apiURL: "https://phoenix-explorer.plumenetwork.xyz/api\?",
          browserURL: "https://phoenix-explorer.plumenetwork.xyz"
        }
      }
    ]
  }
};

export default config;
