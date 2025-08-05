import fs from "fs";
import { Wallet, parseEther } from "ethers";
import hre from "hardhat";
import PQueue from "p-queue";

const OUTPUT_FILE = "accounts.csv";
const TOTAL = 50000;
const BATCH_SIZE = 100;
const FUND_AMOUNT = "0.01"; // ETH per account
const expiry = Math.floor(Date.now() / 1000) + 2 * 365 * 24 * 60 * 60; //2 years from now

const getRandomInvestorClass = () => Math.floor(Math.random() * 2);

async function main() {
  console.log("🚀 Starting wallet generation and funding...");
  const [faucet] = await hre.ethers.getSigners();

  // Use write stream for better performance
  const stream = fs.createWriteStream(OUTPUT_FILE, { flags: "w" });
  stream.write("index,address,privateKey,isAccredited,investorClass,expiry\n");

  for (let batchStart = 0; batchStart < TOTAL; batchStart += BATCH_SIZE) {
    const batch: string[] = [];

    const wallets: Wallet[] = Array.from({ length: BATCH_SIZE }, () =>
      Wallet.createRandom()
    );

    const txQueue = new PQueue({ concurrency: 10 });

    await Promise.all(
      wallets.map((wallet, i) => {
        const index = batchStart + i;
        const isAccredited = Math.random() < 0.5;
        const investorClass = getRandomInvestorClass();

        // Fund wallet
        return txQueue.add(async () => {
          const tx = await faucet.sendTransaction({
            to: wallet.address,
            value: parseEther(FUND_AMOUNT),
          });
          await tx.wait();

          batch.push(
            `${index},${wallet.address},${wallet.privateKey},${isAccredited},${investorClass},${expiry}`
          );
        });
      })
    );

    // Write to file after batch
    stream.write(batch.join("\n") + "\n");
    console.log(
      `✅ Batch ${batchStart / BATCH_SIZE + 1} complete (${Math.min(
        batchStart + BATCH_SIZE,
        TOTAL
      )}/${TOTAL})`
    );
  }

  stream.end();
  console.log(`🎉 Done! ${TOTAL} accounts saved in ${OUTPUT_FILE}`);
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
