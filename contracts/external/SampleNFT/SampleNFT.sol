pragma solidity 0.5.8;

import "openzeppelin-solidity/contracts/token/ERC721/ERC721.sol";

contract SampleNFT is ERC721 {
    uint256 private _nextTokenId;
    address private _owner;

    constructor () public
        ERC721()
    {
        _owner = msg.sender;
        safeMint(msg.sender);
    }

    modifier onlyOwner() {
        require(isOwner(), "Ownable: caller is not the owner");
        _;
    }

    function isOwner() public view returns (bool) {
        return msg.sender == _owner;
    }

    function safeMint(address to) public onlyOwner {
        uint256 tokenId = _nextTokenId++;
        _mint(to, tokenId);
    }
}