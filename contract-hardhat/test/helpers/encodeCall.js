const { ethers } = require("hardhat");

function encodeProxyCall (parametersType, values) {
    const iface = new ethers.Interface([`function initialize(${parametersType.join(',')})`]);
    return iface.encodeFunctionData("initialize", values);
}

function encodeModuleCall (parametersType, values) {
    const iface = new ethers.Interface([`function configure(${parametersType.join(',')})`]);
    return iface.encodeFunctionData("configure", values);
}

function encodeCall (methodName, parametersType, values) {
    const iface = new ethers.Interface([`function ${methodName}(${parametersType.join(',')})`]);
    return iface.encodeFunctionData(methodName, values);
}

module.exports = {
    encodeProxyCall,
    encodeModuleCall,
    encodeCall
};

