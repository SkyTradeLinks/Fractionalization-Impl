// helpers/readInvestorsFromCSV.ts
import fs from "fs";
import { Wallet, JsonRpcProvider, formatEther } from "ethers";

export type InvestorWallet = Wallet & {
  isAccredited: boolean;
  investorClass: number;
  currentBalance: bigint;
};

/**
 * Reads a batch of investors from accounts.csv
 */
export async function readInvestorsFromCSV(
  limit: number,
  offset: number = 0
): Promise<InvestorWallet[]> {
  const provider = new JsonRpcProvider("http://localhost:8545");
  const lines = fs.readFileSync("accounts.csv", "utf-8")
                  .split("\n")
                  .slice(1 + offset, 1 + offset + limit)
                  .filter(Boolean);

  return lines.map((line) => {
    const [_, address, privateKey, isAccredited, investorClass, currentBalance] = line.split(",");
    const wallet = new Wallet(privateKey.trim(), provider) as InvestorWallet;
    wallet.isAccredited = isAccredited === "true";
    wallet.investorClass = parseInt(investorClass);
    wallet.currentBalance = BigInt(currentBalance || "0");
    return wallet;
  });
}

/**
 * Adds expiryn and merkleLeafn columns to accounts.csv using precomputed values.
 */
export function appendExpiryAndMerkleToCSV(
  inputFile: string = "accounts.csv",
  expiryList: (string | number)[],
  merkleLeafList: string[],
  offset: number = 0, 
  num: number = 1,
) {
  if (expiryList.length !== merkleLeafList.length) {
    throw new Error("expiryList and merkleLeafList must have the same length");
  }

  const lines = fs.readFileSync(inputFile, "utf-8").split("\n");
  const header = lines[0].trim();
  
  if (!header.includes(`expiry${num}`)) {
    lines[0] = `${header},expiry${num},merkleLeaf${num}`;
  }

  for (let i = 0; i < expiryList.length; i++) {
    const lineIndex = offset + 1 + i; // +1 to skip header
    if (lines[lineIndex]) {
      lines[lineIndex] = `${lines[lineIndex]},${expiryList[i]},${merkleLeafList[i]}`;
    }
  }

  fs.writeFileSync(inputFile, lines.join("\n"));
  console.log(`Updated ${inputFile} with expiry${num} and merkleLeaf${num}`);
}

/**
 * Appends current ETH balance to each investor line as `currentBalance`.
 */
export async function appendCurrentBalanceToCSV(
  inputFile: string = "accounts.csv",
  providerUrl: string = "http://localhost:8545",
  offset: number = 0,
  limit: number
) {
  const provider = new JsonRpcProvider(providerUrl);
  const lines = fs.readFileSync(inputFile, "utf-8").split("\n");

  if (!lines[0].includes("currentBalance")) {
    lines[0] = `${lines[0]},currentBalance`;
  }

  const dataLines = lines.slice(1);
  const batch = dataLines.slice(offset, offset + limit);

  for (let i = 0; i < batch.length; i++) {
    const fullIndex = offset + i;
    const parts = lines[fullIndex + 1].split(","); // +1 to skip header
    const address = parts[1];

    const balanceWei = await provider.getBalance(address);
    const balanceEth = formatEther(balanceWei);

    lines[fullIndex + 1] = `${lines[fullIndex + 1]},${balanceEth}`;
  }

  fs.writeFileSync(inputFile, lines.join("\n"));
  console.log(`Updated ${inputFile} with currentBalance for batch ${offset}–${offset + limit - 1}`);
}

/**
 * Updates current token balances in accounts.csv for a specific batch
 */
export function appendCurrentBalancesToCSV(
  inputFile: string = "accounts.csv",
  balances: (string | number)[],
  offset: number = 0
) {
  const lines = fs.readFileSync(inputFile, "utf-8").split("\n");
  const headers = lines[0].trim().split(",");

  const balanceColumnIndex = headers.indexOf("currentBalance");

  if (balanceColumnIndex === -1) {
    throw new Error("'currentBalance' column not found in CSV header");
  }

  for (let i = 0; i < balances.length; i++) {
    const lineIndex = offset + 1 + i; // +1 to skip header
    const row = lines[lineIndex];

    if (!row) continue;

    const fields = row.split(",");

    // Pad missing columns if needed
    while (fields.length <= balanceColumnIndex) {
      fields.push("");
    }

    fields[balanceColumnIndex] = balances[i].toString();

    lines[lineIndex] = fields.join(",");
  }

  fs.writeFileSync(inputFile, lines.join("\n"));
  console.log(`Updated 'currentBalance' for ${balances.length} investors in ${inputFile} (offset: ${offset})`);
}

/**
 * Updates the currentBalance for sender and receiver in accounts.csv
 */
export function updateBalancesInCSV(
  senderAddress: string,
  receiverAddress: string,
  newSenderBalance: bigint,
  newReceiverBalance: bigint,
  csvPath: string = "accounts.csv"
) {
  const lines = fs.readFileSync(csvPath, "utf-8").split("\n");

  const header = lines[0].trim();
  const balanceColIndex = header.split(",").indexOf("currentBalance");

  if (balanceColIndex === -1) {
    console.error("'currentBalance' column not found in CSV.");
    return;
  }

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;

    const cols = lines[i].split(",");
    const address = cols[1].toLowerCase();

    if (address === senderAddress.toLowerCase()) {
      cols[balanceColIndex] = newSenderBalance.toString();
      lines[i] = cols.join(",");
    }

    if (address === receiverAddress.toLowerCase()) {
      cols[balanceColIndex] = newReceiverBalance.toString();
      lines[i] = cols.join(",");
    }
  }

  fs.writeFileSync(csvPath, lines.join("\n"));
  console.log(`Updated 'currentBalance' for sender and receiver in ${csvPath}`);
}