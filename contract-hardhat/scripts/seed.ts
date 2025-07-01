import { ethers, network } from "hardhat";
import { Contract } from "ethers";

// Updated addresses for deployed contracts on the local network
const addresses = {
    securityTokenRegistryProxy: "0x9d4454B023096f34B160D6B654540c56A1F81688",
    usdTieredSTOFactory: "0x36b58F5C1969B7b6591D752ea6F5486D069010AB",
    erc20DividendCheckpointFactory: "0x1613beB3B2C4f22Ee086B2b38C1476A3cE7f78E8",
};

async function main() {
    console.log(`Running subgraph testing script on ${network.name}`);
    const [deployer, investor] = await ethers.getSigners();
    console.log(`Deployer: ${deployer.address}`);
    console.log(`Investor: ${investor.address}`);

    const deployerBalance = await ethers.provider.getBalance(deployer.address);
    console.log(`Deployer balance: ${ethers.formatEther(deployerBalance)} ETH`);

    console.log("Funding investor with ETH...");
    const fundAmount = ethers.parseEther("10");
    
    if (deployerBalance < fundAmount) {
        console.log("Deployer doesn't have enough ETH. Skipping funding step.");
        console.log("You can run the faucet script first: npx hardhat run scripts/faucet.ts --network localhost");
    } else {
        const fundTx = await deployer.sendTransaction({
            to: investor.address,
            value: fundAmount
        });
        await fundTx.wait();
        console.log("Investor funded successfully");
    }

    const securityTokenRegistryAbi = require("../../build/contracts/SecurityTokenRegistry.json").abi;
    const securityTokenAbi = require("../../build/contracts/SecurityToken.json").abi;
    const usdTieredSTOAbi = require("../../build/contracts/USDTieredSTO.json").abi;
    const generalTransferManagerAbi = require("../../build/contracts/GeneralTransferManager.json").abi;
    const erc20DividendCheckpointAbi = require("../../build/contracts/ERC20DividendCheckpoint.json").abi;

    const securityTokenRegistry = new Contract(addresses.securityTokenRegistryProxy, securityTokenRegistryAbi, deployer);

    const timestamp = Math.floor(Date.now() / 1000);
    const last4Digits = timestamp.toString().slice(-4);
    const tokenSymbol = `TST${last4Digits}`;
    console.log(`Using ticker symbol: ${tokenSymbol} (length: ${tokenSymbol.length})`);

    console.log("Registering ticker...");
    try {
        await (securityTokenRegistry as any).registerNewTicker(deployer.address, tokenSymbol);
        console.log("Ticker registered successfully");
    } catch (error) {
        console.error("Failed to register ticker:", error);
        return;
    }

    console.log("Creating a new Security Token...");
    const tokenName = "Test Subgraph Token";
    const tokenDetails = "A token for testing subgraph functionality";
    
    try {
        const tx = await (securityTokenRegistry as any).generateNewSecurityToken(
            tokenName, 
            tokenSymbol, 
            tokenDetails, 
            false, 
            deployer.address, 
            0
        );
        console.log("Transaction sent, waiting for receipt...");
        const receipt = await tx.wait();
        console.log("Transaction receipt received");
        
        console.log("All events in receipt:");
        if (receipt.events) {
            receipt.events.forEach((event: any, index: number) => {
                console.log(`Event ${index}:`, {
                    event: event.event,
                    args: event.args,
                    topics: event.topics,
                    data: event.data
                });
            });
        } else {
            console.log("No events found in receipt");
        }
        
        let newSecurityTokenEvent = null;
        let securityTokenAddress = null;
        
        if (receipt.events) {
            newSecurityTokenEvent = receipt.events.find((e: any) => e.event === 'NewSecurityToken');
        }
        
        if (!newSecurityTokenEvent && receipt.logs) {
            const newSecurityTokenTopic = ethers.id("NewSecurityToken(string,string,address,address,uint256,address,bool,uint256,uint256,uint256)");
            const newSecurityTokenTopicV2 = ethers.id("NewSecurityToken(string,string,address,address,uint256,address,bool,uint256)");
            
            for (const log of receipt.logs) {
                if (log.topics[0] === newSecurityTokenTopic || log.topics[0] === newSecurityTokenTopicV2) {
                    console.log("Found NewSecurityToken event in logs:", log);
                    // Parse the event manually
                    const iface = new ethers.Interface(securityTokenRegistryAbi);
                    try {
                        const parsedLog = iface.parseLog(log);
                        newSecurityTokenEvent = parsedLog;
                        break;
                    } catch (parseError) {
                        console.log("Failed to parse log:", parseError);
                    }
                }
            }
        }
        
        if (!newSecurityTokenEvent) {
            console.log("Trying to get security token address from registry...");
            try {
                securityTokenAddress = await (securityTokenRegistry as any).getSecurityTokenAddress(tokenSymbol);
                console.log(`Security Token address from registry: ${securityTokenAddress}`);
            } catch (error) {
                console.log("Failed to get security token address from registry:", error);
            }
        } else {
            securityTokenAddress = newSecurityTokenEvent.args?._securityTokenAddress;
        }
        
        if (!securityTokenAddress) {
            console.error("Security token address not found");
            console.log("Available events:", receipt.events?.map((e: any) => e.event));
            return;
        }
        
        console.log(`Security Token created at: ${securityTokenAddress}`);
        const securityToken = new Contract(securityTokenAddress, securityTokenAbi, deployer);

        console.log("Security token created successfully, continuing with STO setup...");
        
        console.log("Configuring USDTieredSTO...");
        
        const currentTime = Math.floor(Date.now() / 1000);
        const stoStartTime = currentTime + 60; // Start in 1 minute from now
        const stoEndTime = stoStartTime + 3600 * 24 * 30; // 30 days
        
        const ratePerTier = [ethers.parseEther("0.1"), ethers.parseEther("0.15")];
        const ratePerTierDiscountPoly = [ethers.parseEther("0.1"), ethers.parseEther("0.15")];
        const tokensPerTier = [ethers.parseEther("100000000"), ethers.parseEther("200000000")];
        const tokensPerTierDiscountPoly = [0n, 0n];
        const nonAccreditedLimitUSD = ethers.parseEther("10000");
        const minimumInvestmentUSD = ethers.parseEther("5");
        
        const fundRaiseTypes = [0, 1]; 
        const wallet = deployer.address;
        const treasuryWallet = deployer.address;
        const usdTokens: string[] = []; // Empty array since we're not using USD tokens

        const config = [
            stoStartTime,
            stoEndTime,
            ratePerTier,
            ratePerTierDiscountPoly,
            tokensPerTier,
            tokensPerTierDiscountPoly,
            nonAccreditedLimitUSD,
            minimumInvestmentUSD,
            fundRaiseTypes,
            wallet,
            treasuryWallet,
            usdTokens
        ];

        const functionSignature = {
            name: "configure",
            type: "function",
            inputs: [
                { type: "uint256", name: "_startTime" },
                { type: "uint256", name: "_endTime" },
                { type: "uint256[]", name: "_ratePerTier" },
                { type: "uint256[]", name: "_ratePerTierDiscountPoly" },
                { type: "uint256[]", name: "_tokensPerTierTotal" },
                { type: "uint256[]", name: "_tokensPerTierDiscountPoly" },
                { type: "uint256", name: "_nonAccreditedLimitUSD" },
                { type: "uint256", name: "_minimumInvestmentUSD" },
                { type: "uint8[]", name: "_fundRaiseTypes" },
                { type: "address", name: "_wallet" },
                { type: "address", name: "_treasuryWallet" },
                { type: "address[]", name: "_usdTokens" }
            ]
        };

        const stoInterface = new ethers.Interface([functionSignature]);
        const bytesSTO = stoInterface.encodeFunctionData("configure", config);
        
        console.log("STO configuration bytes:", bytesSTO);
        console.log("STO configuration parameters:", config);
        console.log("Current time:", currentTime);
        console.log("STO start time:", stoStartTime);
        console.log("STO end time:", stoEndTime);
        
        const addModuleTx = await (securityToken as any).addModule(addresses.usdTieredSTOFactory, bytesSTO, 0n, 0n, false);
        const addModuleReceipt = await addModuleTx.wait();
        
        console.log("Module added successfully, parsing events...");
        console.log("Add module receipt status:", addModuleReceipt.status);
        
        let moduleAddedEvent = null;
        let stoAddress = null;
        
        if (addModuleReceipt.events) {
            moduleAddedEvent = addModuleReceipt.events.find((e: any) => e.event === 'ModuleAdded');
            console.log("Events found:", addModuleReceipt.events.length);
            addModuleReceipt.events.forEach((event: any, index: number) => {
                console.log(`Event ${index}:`, event.event, event.args);
            });
        }
        
        if (!moduleAddedEvent && addModuleReceipt.logs) {
            console.log("Parsing logs for ModuleAdded event...");
            const moduleAddedTopic = ethers.id("ModuleAdded(uint8[],bytes32,address,address,uint256,uint256,bytes32,bool)");
            
            for (const log of addModuleReceipt.logs) {
                if (log.topics[0] === moduleAddedTopic) {
                    console.log("Found ModuleAdded event in logs:", log);
                    try {
                        const iface = new ethers.Interface(securityTokenAbi);
                        const parsedLog = iface.parseLog(log);
                        moduleAddedEvent = parsedLog;
                        break;
                    } catch (parseError) {
                        console.log("Failed to parse ModuleAdded log:", parseError);
                    }
                }
            }
        }
        
        if (moduleAddedEvent) {
            stoAddress = moduleAddedEvent?.args?._module;
        }
        
        if (!stoAddress) {
            console.error("STO module address not found");
            console.log("Available events:", addModuleReceipt.events?.map((e: any) => e.event));
            console.log("Transaction hash:", addModuleReceipt.transactionHash);
            return;
        }
        
        console.log(`USDTieredSTO module added at: ${stoAddress}`);
        const usdTieredSTO = new Contract(stoAddress, usdTieredSTOAbi, deployer);

        console.log("Getting getter delegate...");
        const getterDelegateAddress = await (securityToken as any).getterDelegate();
        console.log(`Getter delegate address: ${getterDelegateAddress}`);
        
        const stGetterAbi = require("../../build/contracts/STGetter.json").abi;
        const stGetter = new Contract(getterDelegateAddress, stGetterAbi, deployer);

        console.log("Waiting for STO to start...");
        const timeToWait = stoStartTime - currentTime + 10; // Wait 10 seconds after start time
        if (timeToWait > 0) {
            console.log(`Waiting ${timeToWait} seconds for STO to start...`);
            await new Promise(resolve => setTimeout(resolve, timeToWait * 1000));
        }

        console.log("Investor buying tokens...");
        try {
            const purchaseAmount = ethers.parseEther("1"); // 1 ETH
            await (usdTieredSTO.connect(investor) as any).buyWithETH(investor.address, { value: purchaseAmount });
            console.log(`Investor purchased tokens.`);
        } catch (error) {
            console.log("Failed to purchase tokens:", error);
            console.log("This might be due to transfer restrictions. Continuing...");
        }

        console.log("Adding ERC20DividendCheckpoint module...");
        try {
            const mockDividendToken = "0x1234567890123456789012345678901234567890"; // Mock address
            
            const dividendData = ethers.AbiCoder.defaultAbiCoder().encode(
                ["address"], 
                [mockDividendToken] 
            );
            
            console.log("Dividend data:", dividendData);
            console.log("Mock dividend token address:", mockDividendToken);
            
            const addDividendModuleTx = await (securityToken as any).addModule(
                addresses.erc20DividendCheckpointFactory, 
                dividendData, 
                0n, 
                0n, 
                false
            );
            const addDividendModuleReceipt = await addDividendModuleTx.wait();
            
            let dividendModuleAddedEvent = null;
            if (addDividendModuleReceipt.events) {
                dividendModuleAddedEvent = addDividendModuleReceipt.events.find((e: any) => e.event === 'ModuleAdded');
            }
            
            if (!dividendModuleAddedEvent && addDividendModuleReceipt.logs) {
                const moduleAddedTopic = ethers.id("ModuleAdded(uint8[],bytes32,address,address,uint256,uint256,bytes32,bool)");
                for (const log of addDividendModuleReceipt.logs) {
                    if (log.topics[0] === moduleAddedTopic) {
                        try {
                            const iface = new ethers.Interface(securityTokenAbi);
                            const parsedLog = iface.parseLog(log);
                            dividendModuleAddedEvent = parsedLog;
                            break;
                        } catch (parseError) {
                            console.log("Failed to parse dividend ModuleAdded log:", parseError);
                        }
                    }
                }
            }
            
            const dividendCheckpointAddress = dividendModuleAddedEvent?.args?._module;
            console.log(`ERC20DividendCheckpoint module added at: ${dividendCheckpointAddress}`);
            
            if (dividendCheckpointAddress) {
                const erc20DividendCheckpoint = new Contract(dividendCheckpointAddress, erc20DividendCheckpointAbi, deployer);

                console.log("Creating a new dividend...");
                try {
                    const dividendAmount = ethers.parseEther("500");
                    const maturity = Math.floor(Date.now() / 1000);
                    const expiry = maturity + 3600 * 24 * 7; // 7 days
                    const dividendName = "0x546573744469766964656e640000000000000000000000000000000000000000"; // "TestDividend" in bytes32
                    
                    await (erc20DividendCheckpoint as any).createDividend(maturity, expiry, mockDividendToken, dividendAmount, dividendName);
                    const checkpointId = await (securityToken as any).currentCheckpointId();
                    console.log(`Dividend created with checkpoint ID: ${checkpointId}`);
                } catch (error) {
                    console.log("Failed to create dividend:", error);
                }
            }
        } catch (error) {
            console.log("Failed to add ERC20DividendCheckpoint module:", error);
        }

        console.log("\nSubgraph testing script finished.");
        console.log("Check your subgraph for updated data for the following entities:");
        console.log("- UserTokenDividendAggregate");
        console.log("- MonthlyPurchaseAggregate");
        console.log("- MonthlyDividendAggregate");
        console.log("- UserTokenPurchaseAggregate");
        
    } catch (error) {
        console.error("Failed to create security token:", error);
        console.error("Error details:", error);
        return;
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});