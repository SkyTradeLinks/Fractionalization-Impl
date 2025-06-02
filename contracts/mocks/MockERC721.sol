pragma solidity 0.5.8;

import "openzeppelin-solidity/contracts/token/ERC721/ERC721Full.sol";
import "openzeppelin-solidity/contracts/token/ERC721/ERC721Mintable.sol";

contract MockERC721 is ERC721Mintable, ERC721Full {
    constructor(string memory name, string memory symbol)
        public
        ERC721Full(name, symbol)
    {}
}
