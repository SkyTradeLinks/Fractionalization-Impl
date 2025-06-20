import { ethers } from "hardhat";
import { BigNumber, solidityKeccak256, arrayify, AbiCoder, Wallet } from "ethers";

async function getSignSTMData(
    tmAddress: string,
    nonce: string | number,
    validFrom: string | number,
    expiry: string | number,
    fromAddress: string,
    toAddress: string,
    amount: string | number,
    pk: string
): Promise<string> {
    const hash = solidityKeccak256(
        ['address', 'uint256', 'uint256', 'uint256', 'address', 'address', 'uint256'],
        [tmAddress, BigNumber.from(nonce), BigNumber.from(validFrom), BigNumber.from(expiry), fromAddress, toAddress, BigNumber.from(amount)]
    );

    const wallet = new Wallet(pk);
    const signature = await wallet.signMessage(arrayify(hash));

    const abiCoder = new AbiCoder();
    const data = abiCoder.encode(
        ['address', 'uint256', 'uint256', 'uint256', 'bytes'],
        [tmAddress, BigNumber.from(nonce), BigNumber.from(validFrom), BigNumber.from(expiry), signature]
    );
    return data;
}

async function getFreezeIssuanceAck(stAddress: string, from: string): Promise<string> {
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
        text: 'I acknowledge that freezing Issuance is a permanent and irrevocable change'
    };

    const signer = (await ethers.getSigners())[0];
    const signature = await signer.signTypedData(domain, types, value);
    return signature;
}

async function getDisableControllerAck(stAddress: string, from: string): Promise<string> {
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
    const signature = await signer._signTypedData(domain, types, value);
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
    const hash = solidityKeccak256(
        ['address', 'address', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256'],
        [tmAddress, investorAddress, BigNumber.from(fromTime), BigNumber.from(toTime), 
         BigNumber.from(expiryTime), BigNumber.from(validFrom), BigNumber.from(validTo), BigNumber.from(nonce)]
    );

    const wallet = new Wallet(pk);
    const signature = await wallet.signMessage(arrayify(hash));
    return signature;
}

function getSignGTMTransferData(
    tmAddress: string,
    investorAddress: string | string[],
    fromTime: string | number | (string | number)[],
    toTime: string | number | (string | number)[],
    expiryTime: string | number | (string | number)[],
    validFrom: string | number,
    validTo: string | number,
    nonce: string | number,
    pk: string
): Promise<string> {
    return getMultiSignGTMData(tmAddress, investorAddress, fromTime, toTime, expiryTime, validFrom, validTo, nonce, pk);
}

async function getMultiSignGTMData(
    tmAddress: string,
    investorAddress: string | string[],
    fromTime: string | number | (string | number)[],
    toTime: string | number | (string | number)[],
    expiryTime: string | number | (string | number)[],
    validFrom: string | number,
    validTo: string | number,
    nonce: string | number,
    pk: string
): Promise<string> {
    const hash = solidityKeccak256(
        ['address', 'address[]', 'uint256[]', 'uint256[]', 'uint256[]', 'uint256', 'uint256', 'uint256'],
        [tmAddress, Array.isArray(investorAddress) ? investorAddress : [investorAddress],
         Array.isArray(fromTime) ? fromTime.map(t => BigNumber.from(t)) : [BigNumber.from(fromTime)],
         Array.isArray(toTime) ? toTime.map(t => BigNumber.from(t)) : [BigNumber.from(toTime)],
         Array.isArray(expiryTime) ? expiryTime.map(t => BigNumber.from(t)) : [BigNumber.from(expiryTime)],
         BigNumber.from(validFrom), BigNumber.from(validTo), BigNumber.from(nonce)]
    );

    const wallet = new Wallet(pk);
    const signature = await wallet.signMessage(arrayify(hash));
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
