pragma solidity 0.5.8;

import "./GeneralFractionalizerProxy.sol";
import "../../UpgradableModuleFactory.sol";

/**
 * @title Factory for deploying GeneralFractionalizer module
 */
contract GeneralFractionalizerFactory is UpgradableModuleFactory {

    /**
     * @notice Constructor
     */
    constructor (
        uint256 _setupCost,
        address _logicContract,
        address _polymathRegistry,
        bool _isCostInPoly
    )
        public
        UpgradableModuleFactory("3.0.0", _setupCost, _logicContract, _polymathRegistry, _isCostInPoly)
    {
        name = "GeneralFractionalizer";
        title = "General Fractionalizer";
        description = "Manage NFT(ERC721) token fractionalization to security token(ERC20)";
        typesData.push(8);
        typesData.push(3);
        typesData.push(5);
        tagsData.push("General");
        tagsData.push("Fractionalizer");
        compatibleSTVersionRange["lowerBound"] = VersionUtils.pack(uint8(3), uint8(0), uint8(0));
        compatibleSTVersionRange["upperBound"] = VersionUtils.pack(uint8(3), uint8(0), uint8(0));
    }

    /**
     * @notice Used to launch the Module with the help of factory
     * _data Data used for the intialization of the module factory variables
     * @return address Contract address of the Module
     */
    function deploy(bytes calldata _data) external returns(address) {
        address generalFractionalizer = address(new GeneralFractionalizerProxy(logicContracts[latestUpgrade].version, msg.sender, polymathRegistry.getAddress("PolyToken"), logicContracts[latestUpgrade].logicContract));
        _initializeModule(generalFractionalizer, _data);
        return generalFractionalizer;
    }

}
