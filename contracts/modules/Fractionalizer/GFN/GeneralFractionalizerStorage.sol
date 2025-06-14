pragma solidity 0.5.8;
import "../../../interfaces/ISecurityToken.sol";


contract GeneralFractionalizerStorage {

    bool public released;            // Indicates if the fractions have been redeemed
    bool public staked;              // Indicates if the ERC721 token being staked

    address public target;           // Address of the ERC721 token being fractionalized

    uint256 public tokenId;          // Token ID of the fractionalized ERC721 token
    uint256 public fractionsCount;   // Total number of fractional tokens
    uint256 public fractionPrice;    // Price of a single fraction
    address public paymentToken;     // Address of the token used for payments
    ISecurityToken public issuedToken;      // Address of the token issued

}
