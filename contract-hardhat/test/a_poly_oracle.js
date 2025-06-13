const { ethers } = require("hardhat");
const { expect } = require("chai");
const { BigNumber } = ethers;
const latestTime = require("./helpers/latestTime");
const { duration, latestBlock } = require("./helpers/utils");
const { catchRevert } = require("./helpers/exceptions");

describe("PolyOracle", function () {
    let I_PolyOracle;
    let owner, accounts;
    const URL =
        '[URL] json(https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?id=2496&convert=USD&CMC_PRO_API_KEY=${[decrypt] BBObnGOy63qVI3OR2+MX88dzSMVjQboiZc7Wluuh2ngkSgiX1csxWgbAFtu22jbrry42zwCS4IUmer1Wk+1o1XhF7hyspoGCkbufQqYwuUYwcA2slX6RbEDai7NgdkgNGWSwd6DcuN8jD5ZMTkX68rJKkplr}).data."2496".quote.USD.price';
    const alternateURL = "json(https://min-api.cryptocompare.com/data/price?fsym=POLY&tsyms=USD).USD";
    const SanityBounds = 20 * 10 ** 16;
    const GasLimit = 100000;
    const TimeTolerance = 5 * 60;
    const message = "Txn should fail";
    let latestPrice;
    const requestIds = new Array();

    before(async function () {
        [owner, ...accounts] = await ethers.getSigners();
        const PolyOracle = await ethers.getContractFactory("TradingRestrictionManager");
        I_PolyOracle = await PolyOracle.deploy();
        await I_PolyOracle.deployed();
    });

    describe("state variables checks", function () {
        it("should set and check the api url", async function () {
            await I_PolyOracle.setOracleURL(URL);
            const url = await I_PolyOracle.oracleURL();
            expect(URL).to.equal(url);
        });

        it("should check the sanity bounds", async function () {
            const sanityBounds = await I_PolyOracle.sanityBounds();
            expect(SanityBounds).to.equal(sanityBounds);
        });

        it("should check the gas limits", async function () {
            const gasLimit = await I_PolyOracle.gasLimit();
            expect(GasLimit).to.equal(gasLimit);
        });

        it("should check the oraclize time tolerance", async function () {
            const timeTolerance = await I_PolyOracle.oraclizeTimeTolerance();
            expect(TimeTolerance).to.equal(timeTolerance);
        });
    });

    describe("Scheduling test cases", function () {
        it("Should schedule the timing of the call - fails - non owner", async function () {
            const timeScheduling = [
                (await latestTime()) + duration.minutes(1),
                (await latestTime()) + duration.minutes(2),
                (await latestTime()) + duration.minutes(3)
            ];
            await catchRevert(I_PolyOracle.connect(accounts[1]).schedulePriceUpdatesFixed(timeScheduling, { value: ethers.utils.parseEther("2") }));
        });

        it("Should schedule the timing of the call - fails - no value", async function () {
            const timeScheduling = [
                (await latestTime()) + duration.minutes(1),
                (await latestTime()) + duration.minutes(2),
                (await latestTime()) + duration.minutes(3)
            ];
            await catchRevert(I_PolyOracle.schedulePriceUpdatesFixed(timeScheduling));
        });

        it("Should schedule the timing of the call - single call", async function () {
            const blockNo = await latestBlock();
            const tx = await I_PolyOracle.schedulePriceUpdatesFixed([], { value: ethers.utils.parseEther("1") });
            const receipt = await tx.wait();
            
            const time = receipt.events.find(e => e.event === "LogPriceUpdated").args._time;
            expect(time.toNumber()).to.be.at.most(await latestTime());
            
            const filter = I_PolyOracle.filters.PriceUpdated();
            const events = await I_PolyOracle.queryFilter(filter, blockNo);
            const logNewPriceWatcher = events[0];
            
            expect(logNewPriceWatcher.event).to.equal("PriceUpdated");
            expect(logNewPriceWatcher.args._price).to.not.be.null;
            expect(logNewPriceWatcher.args._oldPrice.toNumber()).to.equal(0);
            console.log(
                "Success! Current price is: " +
                    ethers.utils.formatUnits(logNewPriceWatcher.args._price, 18) +
                    " USD/POLY"
            );
        });

        it("Should schedule the timing of the call - multiple calls", async function () {
            const blockNo = await latestBlock();
            const timeScheduling = [(await latestTime()) + duration.seconds(10), (await latestTime()) + duration.seconds(20)];
            const tx = await I_PolyOracle.schedulePriceUpdatesFixed(timeScheduling, { value: ethers.utils.parseEther("1.5") });
            const receipt = await tx.wait();
            
            const event_data = receipt.events.filter(e => e.event === "LogPriceScheduled");
            
            for (let i = 0; i < event_data.length; i++) {
                const time = event_data[i].args._time;
                console.log(`       checking the time for the ${i} index and the scheduling time is ${time}`);
                expect(time.toNumber()).to.be.at.most(timeScheduling[i]);
            }

            // Wait for the callback to be invoked by oraclize and the event to be emitted
            const filter = I_PolyOracle.filters.PriceUpdated();
            const events = await I_PolyOracle.queryFilter(filter, blockNo);
            const log = events[1];
            
            expect(log.event).to.equal("PriceUpdated");
            expect(log.args._price).to.not.be.null;
            console.log("Success! Current price is: " + ethers.utils.formatUnits(log.args._price, 18) + " USD/POLY");
        });

        it("Should schedule to call using iters - fails", async function () {
            await catchRevert(I_PolyOracle.connect(accounts[6]).schedulePriceUpdatesRolling((await latestTime()) + 10, 30, 2));
        });

        it("Should schedule to call using iters", async function () {
            const blockNo = await latestBlock();
            console.log(`Latest Block number of the local chain:${blockNo}`);
            const tx = await I_PolyOracle.schedulePriceUpdatesRolling((await latestTime()) + 10, 10, 2);
            const receipt = await tx.wait();
            
            const event_data = receipt.events.filter(e => e.event === "LogPriceScheduled");
            for (let i = 0; i < event_data.length; i++) {
                const time = event_data[i].args._time;
                requestIds.push(event_data[i].args._queryId);
                console.log(`       checking the time for the ${i} index and the scheduling time is ${time}`);
                expect(time.toNumber()).to.be.at.most((await latestTime()) + (i + 1) * 30);
            }
            
            // Wait for the callback to be invoked by oraclize and the event to be emitted
            const filter = I_PolyOracle.filters.PriceUpdated();
            const events = await I_PolyOracle.queryFilter(filter, blockNo);
            const log = events[1];
            
            expect(log.event).to.equal("PriceUpdated");
            expect(log.args._price).to.not.be.null;
            console.log("Success! Current price is: " + ethers.utils.formatUnits(log.args._price, 18) + " USD/POLY");
            latestPrice = log.args._price;
        });
    });

    describe("Ownable functions", function () {
        it("Should change the Poly USD price manually - fail - bad account", async function () {
            await catchRevert(I_PolyOracle.connect(accounts[5]).setPOLYUSD(latestPrice.add(1)));
        });

        it("Should change the Poly USD price manually", async function () {
            await I_PolyOracle.setPOLYUSD(latestPrice.add(1));
            const price2 = await I_PolyOracle.getPriceAndTime();
            expect(price2[0].toNumber()).to.equal(latestPrice.add(1).toNumber());
        });

        it("Should freeze the Oracle manually", async function () {
            await catchRevert(I_PolyOracle.connect(accounts[5]).setFreezeOracle(true));
        });

        it("Should change the URL manually", async function () {
            const freeze_ = await I_PolyOracle.freezeOracle();
            await I_PolyOracle.setFreezeOracle(true);
            const freeze = await I_PolyOracle.freezeOracle();
            expect(freeze_).to.be.false;
            expect(freeze).to.be.true;
            await I_PolyOracle.setFreezeOracle(false);
        });

        it("Should change the sanity bounds manually - fails - bad owner", async function () {
            await catchRevert(I_PolyOracle.connect(accounts[6]).setSanityBounds(BigNumber.from(25).mul(BigNumber.from(10).pow(16))));
        });

        it("Should change the sanity bounds manually", async function () {
            console.log(JSON.stringify(await I_PolyOracle.sanityBounds()));
            await I_PolyOracle.setSanityBounds(BigNumber.from(25).mul(BigNumber.from(10).pow(16)));
            const sanityBounds = await I_PolyOracle.sanityBounds();
            console.log(JSON.stringify(await I_PolyOracle.sanityBounds()));
            expect(sanityBounds.toNumber()).to.equal(BigNumber.from(25).mul(BigNumber.from(10).pow(16)).toNumber());
        });

        it("Should change the gas price manually - fails - bad owner", async function () {
            await catchRevert(I_PolyOracle.connect(accounts[6]).setGasPrice(BigNumber.from(60).mul(BigNumber.from(10).pow(9))));
        });

        it("Should change the gas price manually", async function () {
            await I_PolyOracle.setGasPrice(BigNumber.from(60).mul(BigNumber.from(10).pow(9)));
            const blockNo = await latestBlock();
            const timeScheduling = [(await latestTime()) + duration.seconds(10), (await latestTime()) + duration.seconds(20)];
            const tx = await I_PolyOracle.schedulePriceUpdatesFixed(timeScheduling, { value: ethers.utils.parseEther("2") });
            const receipt = await tx.wait();
            
            const event_data = receipt.events.filter(e => e.event === "LogPriceScheduled");
            
            for (let i = 0; i < event_data.length; i++) {
                const time = event_data[i].args._time;
                console.log(`       checking the time for the ${i} index and the scheduling time is ${time}`);
                expect(time.toNumber()).to.be.at.most(timeScheduling[i]);
            }
            
            const filter = I_PolyOracle.filters.PriceUpdated();
            const events = await I_PolyOracle.queryFilter(filter, blockNo);
            const logNewPriceWatcher = events[1];
            
            expect(logNewPriceWatcher.event).to.equal("PriceUpdated");
            expect(logNewPriceWatcher.args._price).to.not.be.null;
            console.log(
                "Success! Current price is: " +
                    ethers.utils.formatUnits(logNewPriceWatcher.args._price, 18) +
                    " USD/POLY"
            );
        });

        it("Should change the gas limit manually - fails", async function () {
            await catchRevert(I_PolyOracle.connect(accounts[6]).setGasLimit(50000));
        });

        it("Should change the gas limit manually", async function () {
            await I_PolyOracle.setGasLimit(50000);
            const gasLimit = await I_PolyOracle.gasLimit();
            expect(gasLimit.toNumber()).to.equal(50000);
            await I_PolyOracle.setGasLimit(100000);
        });

        it("Should blacklist some IDS manually - fails - wrong size", async function () {
            const ignore = [true];
            await catchRevert(I_PolyOracle.connect(accounts[6]).setIgnoreRequestIds(requestIds, ignore));
        });

        it("Should blacklist some IDS manually", async function () {
            const ignore = [false, true];
            console.log(requestIds);
            await I_PolyOracle.setIgnoreRequestIds(requestIds, ignore);

            // let ignoreRequestId0 = await I_PolyOracle.ignoreRequestIds(requestIds[1]);
            // expect(ignoreRequestId0).to.equal(true);

            // let ignoreRequestId1 = await I_PolyOracle.ignoreRequestIds(requestIds[2]);
            // expect(ignoreRequestId1).to.equal(false);
        });

        it("Should change the oraclize time tolerance manually - fails", async function () {
            await catchRevert(I_PolyOracle.connect(accounts[6]).setOraclizeTimeTolerance(3600));
        });

        it("Should change the oraclize time tolerance manually", async function () {
            await I_PolyOracle.setOraclizeTimeTolerance(3600);
            const oraclizeTimeTolerance = await I_PolyOracle.oraclizeTimeTolerance();
            expect(oraclizeTimeTolerance.toNumber()).to.equal(3600);
        });

        it("should change the api URL manually", async function () {
            await catchRevert(I_PolyOracle.connect(accounts[6]).setOracleURL(alternateURL));
        });

        it("should change the api URL manually", async function () {
            await I_PolyOracle.setOracleURL(alternateURL);
            await I_PolyOracle.setOracleQueryType("URL");
            const url = await I_PolyOracle.oracleURL();
            expect(alternateURL).to.equal(url);
        });

        it("Should schedule the timing of the call - after changes", async function () {
            const blockNo = await latestBlock();
            const tx = await I_PolyOracle.schedulePriceUpdatesFixed([], { value: ethers.utils.parseEther("1") });
            const receipt = await tx.wait();
            
            const time = receipt.events.find(e => e.event === "LogPriceUpdated").args._time;
            expect(time.toNumber()).to.be.at.most(await latestTime());
            
            const filter = I_PolyOracle.filters.PriceUpdated();
            const events = await I_PolyOracle.queryFilter(filter, blockNo);
            const logNewPriceWatcher = events[0];
            
            expect(logNewPriceWatcher.event).to.equal("PriceUpdated");
            expect(logNewPriceWatcher.args._price).to.not.be.null;
            console.log(
                "Success! Current price is: " +
                    ethers.utils.formatUnits(logNewPriceWatcher.args._price, 18) +
                    " USD/POLY"
            );
        });
    });

    describe("Get Functions call", function () {
        it("Should get the currency address", async function () {
            const polyTokenAddress = await I_PolyOracle.getCurrencyAddress();
            expect(polyTokenAddress.toLowerCase()).to.equal("0x9992eC3cF6A55b00978cdDF2b27BC6882d88D1eC".toLowerCase());
        });

        it("Should get the currency symbol", async function () {
            const currency = await I_PolyOracle.getCurrencySymbol();
            expect(ethers.utils.toUtf8String(currency).replace(/\u0000/g, "")).to.equal("POLY");
        });

        it("Should get the currency denomination", async function () {
            const denomination = await I_PolyOracle.getCurrencyDenominated();
            expect(ethers.utils.toUtf8String(denomination).replace(/\u0000/g, "")).to.equal("USD");
        });
    });
});