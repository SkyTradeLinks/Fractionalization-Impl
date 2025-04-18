pragma solidity 0.5.8;

import "openzeppelin-solidity/contracts/token/ERC721/ERC721Metadata.sol";

contract SampleNFT is ERC721Metadata {
    uint256 private _nextTokenId;
    address private _owner;

    constructor () public
        ERC721Metadata("SkyTrade Token", "SKYT")
    {
        _owner = msg.sender;
    }

    modifier onlyOwner() {
        require(isOwner(), "Ownable: caller is not the owner");
        _;
    }

    function isOwner() public view returns (bool) {
        return msg.sender == _owner;
    }

    function safeMint(address to, string memory metadataURI) public {
        uint256 tokenId = _nextTokenId++;
        _mint(to, tokenId);
        _setTokenURI(tokenId, metadataURI);
    }
}