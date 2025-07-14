import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

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
        },
      },
    ],
  },
  networks: {
    base: {
      url: `https://base-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
      chainId: 84532,
      accounts: [process.env.PRIVATE_KEY],
    },
    monad: {
      url: `https://monad-testnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
      chainId: 10143,
      accounts: [process.env.PRIVATE_KEY],
    }
  },
};
export default config;
