const DevPolyToken = artifacts.require("./PolyTokenFaucet.sol");
const Web3 = require("web3");
web3 = new Web3(new Web3.providers.HttpProvider("https://quick-alpha-lake.monad-testnet.quiknode.pro/c299af5e09c057f57dfb9985747c7f131b19839e/"));

module.exports = function(deployer, network, accounts) {
    const PolymathAccount = accounts[0];
    return deployer.deploy(DevPolyToken, { from: PolymathAccount }).then(() => {});
};
