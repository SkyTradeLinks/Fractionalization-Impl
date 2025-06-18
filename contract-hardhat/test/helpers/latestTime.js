const { ethers } = require("hardhat");

// Returns the time of the last mined block in seconds
async function latestTime () {
    const block = await latestBlock();
    return block.timestamp;
}

async function latestBlock () {
    return ethers.provider.getBlock("latest");
}

module.exports = {latestTime, latestBlock};
