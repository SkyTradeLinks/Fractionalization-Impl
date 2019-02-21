pragma solidity ^0.5.0;

import "../../proxy/ERC20DividendCheckpointProxy.sol";
import "../../libraries/Util.sol";
import "../../interfaces/IBoot.sol";
import "../UpgradableModuleFactory.sol";

/**
 * @title Factory for deploying ERC20DividendCheckpoint module
 */
contract ERC20DividendCheckpointFactory is UpgradableModuleFactory {

    /**
     * @notice Constructor
     * @param _setupCost Setup cost of the module
     * @param _usageCost Usage cost of the module
     * @param _logicContract Contract address that contains the logic related to `description`
     * @param _polymathRegistry Address of the Polymath registry
     */
    constructor(
        uint256 _setupCost,
        uint256 _usageCost,
        address _logicContract,
        address _polymathRegistry
    )
        public
        UpgradableModuleFactory("3.0.0", _setupCost, _usageCost, _logicContract, _polymathRegistry)
    {
        name = "ERC20DividendCheckpoint";
        title = "ERC20 Dividend Checkpoint";
        description = "Create ERC20 dividends for token holders at a specific checkpoint";
        compatibleSTVersionRange["lowerBound"] = VersionUtils.pack(uint8(0), uint8(0), uint8(0));
        compatibleSTVersionRange["upperBound"] = VersionUtils.pack(uint8(0), uint8(0), uint8(0));
    }

    /**
     * @notice Used to launch the Module with the help of factory
     * @return Address Contract address of the Module
     */
    function deploy(bytes calldata _data) external returns(address) {
        address erc20DividendCheckpoint = address(new ERC20DividendCheckpointProxy(logicContracts[latestVersion].version, msg.sender, IPolymathRegistry(polymathRegistry).getAddress("PolyToken"), logicContracts[latestVersion].logicContract));
        _initializeModule(erc20DividendCheckpoint, _data);
        return erc20DividendCheckpoint;
    }

    /**
     * @notice Type of the Module factory
     */
    function types() external view returns(uint8[] memory) {
        uint8[] memory res = new uint8[](1);
        res[0] = 4;
        return res;
    }

    /**
     * @notice Get the tags related to the module factory
     */
    function tags() external view returns(bytes32[] memory) {
        bytes32[] memory availableTags = new bytes32[](3);
        availableTags[0] = "ERC20";
        availableTags[1] = "Dividend";
        availableTags[2] = "Checkpoint";
        return availableTags;
    }
}
