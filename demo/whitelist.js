var fs = require('fs');
var csv = require('fast-csv');
// var BigNumber = require('bignumber.js');
const Web3 = require('web3');


/////////////////////////////ARTIFACTS
let securityTokenABI;
let generalTransferManagerABI;

try {
  securityTokenABI = JSON.parse(require('fs').readFileSync('./build/contracts/SecurityToken.json').toString()).abi;
  generalTransferManagerABI = JSON.parse(require('fs').readFileSync('./build/contracts/GeneralTransferManager.json').toString()).abi;

} catch (err) {
  console.log('\x1b[31m%s\x1b[0m', "Couldn't find contracts' artifacts. Make sure you ran truffle compile first");
  return;
}

////////////////////////////WEB3
if (typeof web3 !== 'undefined') {
  web3 = new Web3(web3.currentProvider);
} else {
  // set the provider you want from Web3.providers
  web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
}



////////////////////////////USER INPUTS
let gtmAddress = process.argv.slice(2)[0]; //general transfer manager address
let BATCH_SIZE = process.argv.slice(2)[1]; //batch size
if (!BATCH_SIZE) BATCH_SIZE = 75;


/////////////////////////GLOBAL VARS

//distribData is an array of batches. i.e. if there are 200 entries, with batch sizes of 75, we get [[75],[75],[50]]
let distribData = new Array();
//allocData is a temporary array that stores up to the batch size,
//then gets push into distribData, then gets set to 0 to start another batch
let allocData = new Array();
//full file data is a single array that contains all arrays. i.e. if there are 200 entries we get [[200]]
let fullFileData = new Array();
let badData = new Array();

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

let Issuer;
let accounts;
let generalTransferManager;

////////////////////////MAIN FUNCTION COMMUNICATING TO BLOCKCHAIN
async function setInvestors() {
  accounts = await web3.eth.getAccounts();
  Issuer = accounts[1]

  // let generalTransferManagerAddress;
  // await securityToken.methods.modules(2).call({ from: Issuer }, function (error, result) {
  //   generalTransferManagerAddress = result[1];
  //   generalTransferManager = new web3.eth.Contract(generalTransferManagerABI, generalTransferManagerAddress);
  //   console.log("GTM Address:", generalTransferManagerAddress);
  // });

  generalTransferManager = new web3.eth.Contract(generalTransferManagerABI, gtmAddress);


  console.log('gtmAddress: ', gtmAddress)
  console.log('batchSize: ', BATCH_SIZE)

  console.log(`
    -------------------------------------------------------
    ----- Sending buy/sell restrictions to blockchain -----
    -------------------------------------------------------
  `);



  //this for loop will do the batches, so it should run 75, 75, 50 with 200
  for (let i = 0; i < distribData.length; i++) {
    try {
      let gPrice = 10000000000;
      let investorArray = [];
      let fromTimesArray = [];
      let toTimesArray = [];

      //splitting the user arrays to be organized by input
      for (let j = 0; j < distribData[i].length; j++) {
        investorArray.push(distribData[i][j][0])
        fromTimesArray.push(distribData[i][j][1])
        toTimesArray.push(distribData[i][j][2])
      }


      //fromTimes is ability to sell coin FROM your account (2nd row in csv, 2nd parameter in modifyWhiteList() )
      //toTimes is ability to buy coins TOwards your account (3rd row in csv, 3rd parameter in modifyWhiteList() )
      let r = await generalTransferManager.methods.modifyWhitelistMulti(investorArray, fromTimesArray, toTimesArray).send({ from: Issuer, gas: 4500000, gasPrice: gPrice })
      console.log(`Batch ${i} - Attempting to modifyWhitelist accounts:\n\n`, investorArray, "\n\n");
      console.log("---------- ---------- ---------- ---------- ---------- ---------- ---------- ----------");
      console.log("Allocation + transfer was successful.", r.gasUsed, "gas used. Spent:", r.gasUsed * gPrice, "wei");
      console.log("---------- ---------- ---------- ---------- ---------- ---------- ---------- ----------\n\n");

    } catch (err) {
      console.log("ERROR:", err);
    }
  }

  console.log("Script finished successfully.")
  // console.log("Waiting 2 minutes for transactions to be mined...")
  // await delay(90000);
  console.log("When live, use a delay of 2 mins to let blocks be mined. On Testrpc, this can be skipped")
  console.log("Retrieving logs to determine investors have had their times uploaded correctly.\n\n")

  let totalInvestors = 0;
  let updatedInvestors = 0;

  let investorData_Events = new Array();
  let investorObjectLookup = {};


  // var events = await generalTransferManager.LogModifyWhitelist({ from: Issuer }, { fromBlock: 0, toBlock: 'latest' });
  let event_data = await generalTransferManager.getPastEvents('LogModifyWhitelist', {
    fromBlock: 0,
    toBlock: 'latest'
  }, function (error, events) {
    console.log("Error wtf dont need: ", error)
  });
  // console.log("EVENTS NEW: ", events)

  for (var i = 0; i < event_data.length; i++) {
    let combineArray = [];

    let investorAddress_Event = event_data[i].returnValues._investor;
    let fromTime_Event = event_data[i].returnValues._fromTime
    let toTime_Event = event_data[i].returnValues._toTime
    let blockNumber = event_data[i].blockNumber

    combineArray.push(investorAddress_Event);
    combineArray.push(fromTime_Event);
    combineArray.push(toTime_Event);
    combineArray.push(blockNumber)

    investorData_Events.push(combineArray)

    //we have already recorded it, so this is an update to our object
    if (investorObjectLookup.hasOwnProperty(investorAddress_Event)) {

      //the block number form the event we are checking is bigger, so we gotta replace it
      if (investorObjectLookup[investorAddress_Event].recordedBlockNumber < blockNumber) {
        investorObjectLookup[investorAddress_Event] = { fromTime: fromTime_Event, toTime: toTime_Event, recordedBlockNumber: blockNumber };
        updatedInvestors += 1;
        // investorAddress_Events.push(investorAddress_Event); not needed, because we start the obj with zero events

      } else {
        //do nothing. so if we find an event, and it was an older block, its old, we dont care
      }
      //we have never recorded this address as an object key, so we need to add it to our list of investors updated by the csv
    } else {
      investorObjectLookup[investorAddress_Event] = { fromTime: fromTime_Event, toTime: toTime_Event, recordedBlockNumber: blockNumber };
      totalInvestors += 1;
      // investorAddress_Events.push(investorAddress_Event);
    }
  }
  let investorAddress_Events = Object.keys(investorObjectLookup)

  console.log(`******************** EVENT LOGS ANALYSIS COMPLETE ********************\n`);
  console.log(`A total of ${totalInvestors} investors have been whitelisted total, all time.\n`);
  console.log(`This script in total sent ${fullFileData.length - badData.length} new investors and updated investors to the blockchain.\n`);
  console.log(`There were ${badData.length} bad entries that didnt get sent to the blockchain in the script.\n`);

  // console.log("LIST OF ALL INVESTOR DATA FROM EVENTS:", investorData_Events)
  // console.log(fullFileData)
  console.log("************************************************************************************************");
  console.log("OBJECT WITH EVERY USER AND THEIR UPDATED TIMES: \n\n", investorObjectLookup)
  console.log("************************************************************************************************");
  console.log("LIST OF ALL INVESTORS WHITELISTED: \n\n", investorAddress_Events)

  let missingDistribs = [];
  for (let l = 0; l < fullFileData.length; l++) {
    if (!investorObjectLookup.hasOwnProperty(fullFileData[l][0])) {
      missingDistribs.push(fullFileData[l])
    }
  }

  if (missingDistribs.length > 0) {
    console.log("************************************************************************************************");
    console.log("-- No LogModifyWhitelist event was found for the following data arrays. Please review them manually --")
    console.log(missingDistribs)
    // for (var i = 0; i < missingDistribs.length; i++) {
    //   console.log('\x1b[31m%s\x1b[0m', `No Transfer event was found for account ${missingDistribs[i]}`);
    // }
    console.log("************************************************************************************************");
  } else {
    console.log("\n************************************************************************************************");
    console.log("All accounts passed through from the CSV were successfully whitelisted, because we were able to read them all from events")
    console.log("************************************************************************************************");
  }
  // console.log(`Run 'node scripts/verify_airdrop.js ${polyDistribution.address} > scripts/data/review.csv' to get a log of all the accounts that were distributed the airdrop tokens.`)

}

///////////////////////////FUNCTION READING THE CSV FILE
function readFile() {
  var stream = fs.createReadStream("./demo/whitelist_data.csv");

  let index = 0;
  let batch = 0;
  console.log(`
    --------------------------------------------
    ----------- Parsing the csv file -----------
    --------------------------------------------
  `);

  var csvStream = csv()
    .on("data", function (data) {
      // console.log(data[1])
      // console.log(data[2])
      // console.log(data[3])
      let isAddress = web3.utils.isAddress(data[1]);
      let sellValid = isValidDate(data[2])
      let buyValid = isValidDate(data[3])


      if (isAddress && sellValid && buyValid) {
        let userArray = new Array()
        let checksummedAddress = web3.utils.toChecksumAddress(data[1]);

        userArray.push(checksummedAddress)
        userArray.push(sellValid)
        userArray.push(buyValid)
        // console.log(userArray)
        allocData.push(userArray);
        fullFileData.push(userArray);
        index++;
        if (index >= BATCH_SIZE) {
          distribData.push(allocData);
          // console.log("DIS", distribData);
          allocData = [];
          // console.log("ALLOC", allocData);
          index = 0;
        }

      } else {
        let userArray = new Array()
        //dont need this here, as if it is NOT an address this function will fail
        //let checksummedAddress = web3.utils.toChecksumAddress(data[1]);
        userArray.push(data[1])
        userArray.push(sellValid)
        userArray.push(buyValid)
        badData.push(userArray);
        fullFileData.push(userArray)
      }
    })
    .on("end", function () {
      //Add last remainder batch
      distribData.push(allocData);
      allocData = [];

      setInvestors();
    });

  stream.pipe(csvStream);
}


////////////////////////////////////ENTRY POINT OF THE SCRIPT
//entry point of the script, it will only run if you have typed into the terminal the GeneralTransferManager address
async function startScript() {
  if (gtmAddress != "") {
    // let accounts = await web3.eth.getAccounts();
    // let Issuer = accounts[0];
    // let securityToken;
    // await securityTokenRegistry.methods.getSecurityTokenAddress("tokenSymbol").call({from: Issuer}, function(error, result){
    //   if(result != "0x0000000000000000000000000000000000000000"){
    //     securityToken = new web3.eth.Contract(securityTokenABI,result);
    //   }
    //
    // });
    console.log("Processing investor CSV upload. Batch size is accounts per transaction");
    readFile();
  } else {
    console.log("Please run the script by providing the address of the GeneralTransferManager contract and batch size");
  }
}

function isValidDate(date) {
  var matches = /^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/.exec(date);
  if (matches == null) return false;
  var d = matches[2];
  var m = matches[1] - 1; //not clear why this is -1, but it works after checking
  var y = matches[3];
  var composedDate = new Date(y, m, d);
  var timestampDate = composedDate.getTime()

  //note, some reason these timestamps are being recorded +4 hours UTC
  if (composedDate.getDate() == d && composedDate.getMonth() == m && composedDate.getFullYear() == y) {
    return timestampDate / 1000
  } else {
    return false
  }
}

startScript();
