pragma solidity 0.5.8;

import { IERC721 } from "openzeppelin-solidity/contracts/token/ERC721/IERC721.sol";
import { ReentrancyGuard } from "openzeppelin-solidity/contracts/utils/ReentrancyGuard.sol";

import { ISecurityToken } from "../../interfaces/ISecurityToken.sol";
import { ISecurityTokenRegistry } from "../../interfaces/ISecurityTokenRegistry.sol";
import { IPolymathRegistry } from "../../interfaces/IPolymathRegistry.sol";

contract Fractionalizer is ReentrancyGuard
{
	function fractionalize(
        address _target, 
        uint256 _tokenId, 
        string memory _name, 
        string memory _symbol, 
        uint256 _fractionsCount, 
        address _polymathRegistry
    ) public nonReentrant returns (address _fractions)
	{
		address _from = msg.sender;

        IPolymathRegistry polymathRegistry = IPolymathRegistry(_polymathRegistry);

        ISecurityTokenRegistry securityTokenRegistry = ISecurityTokenRegistry(polymathRegistry.getAddress("SecurityTokenRegistry"));

        securityTokenRegistry.registerTicker(address(this), _symbol, _name);

        securityTokenRegistry.generateNewSecurityToken(_name, _symbol, "", true, _from, 0);

        address securityTokenAddress = securityTokenRegistry.getSecurityTokenAddress(_symbol);

        IERC721(_target).transferFrom(_from, securityTokenAddress, _tokenId);

        ISecurityToken securityToken = ISecurityToken(securityTokenAddress);

        securityToken.setController(_from);

        bytes memory data = abi.encodeWithSignature("issue(address,uint256,bytes)", _from, _fractionsCount, bytes32(0));
        (bool success, bytes memory result) = address(securityToken).delegatecall(data);
        require(success, "Delegate call to issue failed");

		return securityTokenAddress;
	}

	event Fractionalize(address indexed _from, address indexed _target, uint256 indexed _tokenId, address _securityTokenAddress);
}
