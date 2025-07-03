import fs from "fs";
import { Wallet } from "ethers";
import hre from "hardhat";

function getRandomInvestorClass(): number {
  return Math.floor(Math.random() * 2);
}

const OUTPUT_FILE = "accounts.csv";
const TOTAL = 100;
const BATCH_SIZE = 50;
const FUND_AMOUNT = "1.0"; // ETH per account

async function main() {
  console.log("🚀 Process started");

  const [faucet] = await hre.ethers.getSigners();

  if (!faucet || !faucet.sendTransaction) {
    throw new Error("❌ Faucet signer not available");
  }

  // Write CSV header with currentBalance
  fs.writeFileSync(
    OUTPUT_FILE,
    "index,address,privateKey,isAccredited,investorClass,currentBalance\n"
  );

  for (let batchStart = 0; batchStart < TOTAL; batchStart += BATCH_SIZE) {
    const lines: string[] = [];

    for (let i = 0; i < BATCH_SIZE && batchStart + i < TOTAL; i++) {
      const index = batchStart + i;
      const wallet = Wallet.createRandom();
      const isAccredited = Math.random() < 0.5;
      const investorClass = getRandomInvestorClass();

      // Send ETH from faucet to investor wallet
      const tx = await faucet.sendTransaction({
        to: wallet.address,
        value: hre.ethers.parseEther(FUND_AMOUNT),
      });

      await tx.wait(); // Wait to ensure it's mined

      // Get balance (optional but accurate)
      const balance = await hre.ethers.provider.getBalance(wallet.address);

      lines.push(
        `${index},${wallet.address},${wallet.privateKey},${isAccredited},${investorClass},${balance}`
      );
    }

    fs.appendFileSync(OUTPUT_FILE, lines.join("\n") + "\n");
    console.log(
      `✅ Batch ${batchStart / BATCH_SIZE + 1} complete (${Math.min(
        batchStart + BATCH_SIZE,
        TOTAL
      )}/${TOTAL})`
    );
  }

  console.log(`🎉 Done! Generated ${TOTAL} funded accounts in ${OUTPUT_FILE}`);
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
