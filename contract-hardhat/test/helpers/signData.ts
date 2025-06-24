import { ethers } from "hardhat";
import { solidityPackedKeccak256, Wallet } from "ethers";
const Web3 = require("web3");
let BN = Web3.utils.BN;

async function getSignSTMData(
    tmAddress: string,
    from: string,
    to: string,
    amount: string | number,
    validFrom: string | number,
    validTo: string | number,
    nonce: string | number,
    pk: string
): Promise<string> {
    const hash = solidityPackedKeccak256(
        ['address', 'address', 'address', 'uint256', 'uint256', 'uint256', 'uint256'],
        [tmAddress, from, to, amount, validFrom, validTo, nonce]
    );

    const wallet = new Wallet(pk);
    const signature = await wallet.signMessage(ethers.getBytes(hash));
    return signature;
}

// async function getFreezeIssuanceAck(stAddress: string, from: string): Promise<string> {
//     const domain = {
//         name: 'Polymath',
//         chainId: 1,
//         verifyingContract: stAddress
//     };

//     const types = {
//         EIP712Domain: [
//             { name: 'name', type: 'string' },
//             { name: 'chainId', type: 'uint256' },
//             { name: 'verifyingContract', type: 'address' }
//         ],
//         Acknowledgment: [
//             { name: 'text', type: 'string' }
//         ]
//     };

//     const value = {
//         text: 'I acknowledge that freezing Issuance is a permanent and irrevocable change'
//     };

//     const signer = (await ethers.getSigners())[0];
//     const signature = await signer.signTypedData(domain, types, value);
//     return signature;
// }

async function getFreezeIssuanceAck(stAddress: string, from: any): Promise<string> {
    const domain = {
        name: 'Polymath',
        chainId: 1,
        verifyingContract: stAddress
    };

    // Remove EIP712Domain from types - ethers.js handles this automatically
    const types = {
        Acknowledgment: [
            { name: 'text', type: 'string' }
        ]
    };

    const value = {
        text: 'I acknowledge that freezing Issuance is a permanent and irrevocable change'
    };

    const signature = await from.signTypedData(domain, types, value);
    return signature;
}

async function getDisableControllerAck(stAddress: string, from: any): Promise<string> {
    const domain = {
        name: 'Polymath',
        chainId: 1,
        verifyingContract: stAddress
    };

    const types = {
        EIP712Domain: [
            { name: 'name', type: 'string' },
            { name: 'chainId', type: 'uint256' },
            { name: 'verifyingContract', type: 'address' }
        ],
        Acknowledgment: [
            { name: 'text', type: 'string' }
        ]
    };

    const value = {
        text: 'I acknowledge that disabling controller is a permanent and irrevocable change'
    };

    const signer = (await ethers.getSigners())[0];
    const signature = await signer.signTypedData(domain, types, value);
    return signature;
}

async function getSignGTMData(
    tmAddress: string,
    investorAddress: string,
    fromTime: string | number,
    toTime: string | number,
    expiryTime: string | number,
    validFrom: string | number,
    validTo: string | number,
    nonce: string | number,
    pk: string
): Promise<string> {
    const hash = solidityPackedKeccak256(
        ['address', 'address', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256'],
        [tmAddress, investorAddress, fromTime, toTime, 
         expiryTime, validFrom, validTo, nonce]
    );

    const wallet = new Wallet(pk);
    const signature = await wallet.signMessage(ethers.getBytes(hash));
    return signature;
}

function getSignGTMTransferData(tmAddress, investorAddress, fromTime, toTime, expiryTime, validFrom, validTo, nonce, pk) {
    const web3 = new Web3(new Web3.providers.HttpProvider(process.env.PROVIDER_URL));

    let signature = getMultiSignGTMData(tmAddress, investorAddress, fromTime, toTime, expiryTime, validFrom, validTo, nonce, pk);
    let packedData = web3.eth.abi.encodeParameters(
        ['address[]', 'uint256[]', 'uint256[]', 'uint256[]', 'bytes'], 
        [investorAddress, fromTime, toTime, expiryTime, signature]
    );
    let data = web3.eth.abi.encodeParameters(
        ['address', 'uint256', 'uint256', 'uint256', 'bytes'], 
        [tmAddress, new BN(nonce).toString(), new BN(validFrom).toString(), new BN(validTo).toString(), packedData]
    );
    return data;
}

function getMultiSignGTMData(tmAddress, investorAddress, fromTime, toTime, expiryTime, validFrom, validTo, nonce, pk) {
    const web3 = new Web3(new Web3.providers.HttpProvider(process.env.PROVIDER_URL));

    let hash = web3.utils.soliditySha3({
        t: 'address',
        v: tmAddress
    }, {
        t: 'address[]',
        v: investorAddress
    }, {
        t: 'uint256[]',
        v: fromTime
    }, {
        t: 'uint256[]',
        v: toTime
    }, {
        t: 'uint256[]',
        v: expiryTime
    }, {
        t: 'uint256',
        v: new BN(validFrom)
    }, {
        t: 'uint256',
        v: new BN(validTo)
    }, {
        t: 'uint256',
        v: new BN(nonce)
    });
    let signature = (web3.eth.accounts.sign(hash, pk)).signature;
    return signature;
}

export {
    getSignSTMData,
    getSignGTMData,
    getSignGTMTransferData,
    getMultiSignGTMData,
    getFreezeIssuanceAck,
    getDisableControllerAck
};
