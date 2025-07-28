import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

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
    buildbear: {
      url: process.env.BUILD_BEAR_RPC || "",
      accounts: [process.env.FUNDER_PRIVATE_KEY!],
    },
  },
};

export default config;
