// helpers/readInvestorsFromCSV.ts
import fs from "fs";
import { Wallet, JsonRpcProvider, formatEther } from "ethers";

export type InvestorWallet = Wallet & {
  isAccredited: boolean;
  investorClass: number;
  currentBalance: bigint;
  expiry?: string;
  merkleLeaf?: string;
  proof?: string[];
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
                  .filter(Boolean);

  const header = lines[0].split(",").map(h => h.trim());
  const dataLines = lines.slice(1 + offset, 1 + offset + limit);

  const getFieldIndex = (field: string) => header.indexOf(field);

  const expiryIndex = getFieldIndex("expiry1");
  const merkleLeafIndex = getFieldIndex("merkleLeaf1");
  const proofIndex = getFieldIndex("proof1");

  return dataLines.map((line) => {
    const cols = line.split(",");

    const address = cols[1]?.trim();
    const privateKey = cols[2]?.trim();
    const isAccredited = cols[3]?.trim() === "true";
    const investorClass = parseInt(cols[4]);
    const currentBalance = BigInt(cols[5] || "0");

    const wallet = new Wallet(privateKey, provider) as InvestorWallet;
    wallet.isAccredited = isAccredited;
    wallet.investorClass = investorClass;
    wallet.currentBalance = currentBalance;

    if (expiryIndex !== -1) wallet.expiry = cols[expiryIndex]?.trim();
    if (merkleLeafIndex !== -1) wallet.merkleLeaf = cols[merkleLeafIndex]?.trim();
    if (proofIndex !== -1) {
      try {
        wallet.proof = JSON.parse(cols[proofIndex]);
      } catch {
        wallet.proof = [];
      }
    }

    return wallet;
  });
}

/**
 * Adds expiryn and merkleLeafn columns to accounts.csv using precomputed values.
 */
export function appendExpiryAndMerkleToCSVWithProof(
  inputFile: string = "accounts.csv",
  expiry: (string | number),
  merkleLeafList: string[],
  proofList: string[],
  offset: number = 0, 
  num: number = 1,
) {
  if (proofList.length !== merkleLeafList.length) {
    throw new Error("expiryList and merkleLeafList must have the same length");
  }

  const lines = fs.readFileSync(inputFile, "utf-8").split("\n");
  const header = lines[0].trim();
  
  if (!header.includes(`expiry${num}`)) {
    lines[0] = `${header},expiry${num},merkleLeaf${num},proof${num}`;
  }

  for (let i = 0; i < proofList.length; i++) {
    const lineIndex = offset + 1 + i; // +1 to skip header
    if (lines[lineIndex]) {
      const proofStr = `"${JSON.stringify(proofList[i]).replace(/"/g, '""')}"`;
      lines[lineIndex] = `${lines[lineIndex]},${expiry},${merkleLeafList[i]},${proofStr}`;
    }
  }

  fs.writeFileSync(inputFile, lines.join("\n"));
  console.log(`Updated ${inputFile} with expiry${num} and merkleLeaf${num}, and proof${num}`);
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

export function appendBatchDataToCSV(
  inputFile: string = "accounts.csv",
  expiryList: Array<string | number>,
  merkleLeafList: string[],
  balanceList: Array<string | number>,
  offset: number = 0,
  num: number = 1
) {
  if (
    expiryList.length !== merkleLeafList.length ||
    expiryList.length !== balanceList.length
  ) {
    throw new Error(
      "expiryList, merkleLeafList and balanceList must all have the same length"
    );
  }

  // 1) Read & split
  const lines = fs.readFileSync(inputFile, "utf-8").split("\n");
  let header = lines[0].trim();

  // 2) Ensure all three headers exist
  const expiryHeader = `expiry${num}`;
  const merkleHeader = `merkleLeaf${num}`;
  const balanceHeader = `currentBalance`;

  const toAdd: string[] = [];
  if (!header.includes(expiryHeader))   toAdd.push(expiryHeader);
  if (!header.includes(merkleHeader))   toAdd.push(merkleHeader);
  if (!header.includes(balanceHeader))  toAdd.push(balanceHeader);

  if (toAdd.length) {
    header += "," + toAdd.join(",");
    lines[0] = header;
  }

  // 3) Append per-line
  for (let i = 0; i < expiryList.length; i++) {
    const lineIdx = offset + 1 + i; // +1 to skip header
    if (!lines[lineIdx]) continue;

    const e = expiryList[i];
    const m = merkleLeafList[i];
    const b = balanceList[i];

    lines[lineIdx] = `${lines[lineIdx]},${e},${m},${b}`;
  }

  // 4) Write back
  fs.writeFileSync(inputFile, lines.join("\n"));
  console.log(
    `Updated ${inputFile} at rows ${offset}–${offset +
      expiryList.length -
      1} with ${expiryHeader}, ${merkleHeader} and ${balanceHeader}`
  );
}