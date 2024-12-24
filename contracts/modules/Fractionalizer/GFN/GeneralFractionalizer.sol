pragma solidity 0.5.8;

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/SafeERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC721/IERC721.sol";
import "openzeppelin-solidity/contracts/utils/ReentrancyGuard.sol";
import "openzeppelin-solidity/contracts/token/ERC721/ERC721Holder.sol";

import "./GeneralFractionalizerStorage.sol";
import "../Fractionalizer.sol";
import "../../../interfaces/ISecurityToken.sol";



contract GeneralFractionalizer is ERC721Holder, GeneralFractionalizerStorage, ReentrancyGuard, Fractionalizer  {
	using SafeERC20 for IERC20;

	/**
	 * @dev Emitted when a user redeems their fractional ownership and claims the NFT.
	 * @param _from The address of the user redeeming their fractions.
	 * @param _fractionsCount The number of fractional tokens redeemed by the user.
	 * @param _redeemAmount The amount paid or required for the redemption process.
	 */
	event Redeem(
		address indexed _from,
		uint256 _fractionsCount,
		uint256 _redeemAmount
	);

	/**
	 * @dev Emitted when a user claims their share of the vault balance after the NFT is sold.
	 * @param _from The address of the user claiming their share.
	 * @param _fractionsCount The number of fractional tokens burned during the claim.
	 * @param _claimAmount The amount of payment received by the user for their claim.
	 */
	event Claim(
		address indexed _from,
		uint256 _fractionsCount,
		uint256 _claimAmount
	);

    // Modifier to ensure the ERC721 token is staked before function execution
    modifier onlyWhenStaked() {
        require(staked, "Operation not allowed: ERC721 is not staked");
        _;
    }


	/**
     * @notice Constructor
     * @param _securityToken Address of the security token
     */
    constructor(address _securityToken, address _polyAddress) public Module(_securityToken, _polyAddress) {
    }

	/**
     * @notice This function returns the signature of configure function
     */
    function getInitFunction() public pure returns(bytes4) {
        return bytes4(0);
    }

    /**
     * @notice Return the permissions flag that are associated with STO
     */
    function getPermissions() public view returns(bytes32[] memory allPermissions) {
        allPermissions = new bytes32[](2);
        allPermissions[0] = OPERATOR;
        allPermissions[1] = ADMIN;
        return allPermissions;
    }


    /**
     * @notice Function used to stake the ERC721 token.
     * @param _issuedToken The security token to issue.
     * @param _from The staker.
     * @param _tokenId The ID of the token to be fractionalized.
     * @param _tokenId The ID of the token to be fractionalized.
     * @param _paymentToken Address of the payment token.
     * @param _target The address of the ERC721 token contract.
     * @param _fractionsCount Total number of fractional tokens.
     * @param _fractionPrice Price of a single fraction.
     */
    function stake(
        ISecurityToken _issuedToken,
        address _from,
        address _paymentToken,
        address _target,
        uint256 _tokenId,
        uint256 _fractionsCount,
        uint256 _fractionPrice
    ) external  {
        require(!staked, "already staked");

        require(_paymentToken != address(this), "invalid token");
        require(target == address(0), "already initialized");
        require(_fractionsCount > 0, "invalid fraction count");
        require(_fractionsCount * _fractionPrice / _fractionsCount == _fractionPrice, "invalid fraction price");

        paymentToken = _paymentToken;
        target = _target;

        tokenId = _tokenId;
        fractionsCount = _fractionsCount;
        fractionPrice = _fractionPrice;

        released = false;
        staked = true;

        IERC721(_target).transferFrom(_from, address(this), _tokenId);

        _issuedToken.issue(_from, fractionsCount, "");

        issuedToken = _issuedToken;
    }


	/**
     * @notice Redeem fractionalized tokens.
     */
    function redeem(address payable _from) external payable nonReentrant onlyWhenStaked {
        uint256 _value = msg.value;

        require(!released, "token already redeemed");
        uint256 _fractionsCount = issuedToken.balanceOf(_from);
        uint256 _redeemAmount = redeemAmountOf(_from);

        released = true;

		address payable contractAddress = address(uint160(address(this)));

        if (_fractionsCount > 0) _burnFraction(_from, _fractionsCount);
        _safeTransferFrom(paymentToken, _from, _value, contractAddress, _redeemAmount);
        IERC721(target).safeTransferFrom(address(this), _from, tokenId);

        emit Redeem(_from, _fractionsCount, _redeemAmount);

        _cleanup();
    }

	/**
     * @notice Burns a specified number of fraction tokens from the given address.
     * @dev Calls the `controllerRedeem` function via a delegate call to burn the specified number of fractions.
     * This ensures the token burning logic is executed within the context of the `securityToken` contract.
     * @param _from The address of the token holder whose fractions are to be burned.
     * @param _fractionsCount The number of fraction tokens to burn.
     */
    function _burnFraction(address _from, uint256 _fractionsCount) internal  {
        issuedToken.redeemFrom(_from, _fractionsCount, "");
    }

    /**
     * @notice Claim fractionalized token rewards after release.
     */
    function claim(address payable _from) external nonReentrant onlyWhenStaked {
        require(released, "token not redeemed");
        uint256 _fractionsCount = issuedToken.balanceOf(_from);
        require(_fractionsCount > 0, "nothing to claim");

        uint256 _claimAmount = vaultBalanceOf(_from);
        _burnFraction(_from, _fractionsCount);
        _safeTransfer(paymentToken, _from, _claimAmount);

        emit Claim(_from, _fractionsCount, _claimAmount);

        _cleanup();
    }

	/**
     * @dev Safely transfers tokens or native currency to a recipient.
     * @param _token Address of the token to transfer. Use `address(0)` for native currency.
     * @param _to Recipient address.
     * @param _amount Amount to transfer.
     */
    function _safeTransfer(address _token, address payable _to, uint256 _amount) internal {
        if (_token == address(0)) {
            _to.transfer(_amount);
        } else {
            IERC20(_token).safeTransfer(_to, _amount);
        }
    }

    /**
     * @dev Safely transfers tokens or native currency from a sender.
     * @param _token Address of the token to transfer. Use `address(0)` for native currency.
     * @param _from Sender address.
     * @param _value Native currency value sent.
     * @param _to Recipient address.
     * @param _amount Amount to transfer.
     */
    function _safeTransferFrom(
        address _token,
        address payable _from,
        uint256 _value,
        address payable _to,
        uint256 _amount
    ) internal {
        if (_token == address(0)) {
            require(_value == _amount, "invalid value");
            if (_to != address(this)) _to.transfer(_amount);
        } else {
            require(_value == 0, "invalid value");
            IERC20(_token).safeTransferFrom(_from, _to, _amount);
        }
    }


    /**
     * @dev Cleanup function to self-destruct the contract if no tokens are left.
     */
    function _cleanup() internal {
        if (issuedToken.totalSupply() == 0) {
            selfdestruct(address(0));
        }
    }

    /**
     * @notice Get the status of the fractionalized token.
     * @return _status The status, either "SOLD" or "OFFER".
     */
    function status() external view returns (string memory _status) {
        return released ? "SOLD" : "OFFER";
    }

    /**
     * @notice Calculates the reserve price of the fractionalized token.
     * @return _reservePrice The reserve price.
     */
    function reservePrice() public view returns (uint256 _reservePrice) {
        return fractionsCount * fractionPrice;
    }

    /**
     * @notice Calculate the remaining amount to redeem.
     * @param _from The address of the redeemer.
     * @return _redeemAmount The redeemable amount.
     */
    function redeemAmountOf(address _from) public view returns (uint256 _redeemAmount) {
        require(!released, "token already redeemed");
        uint256 _fractionsCount = issuedToken.balanceOf(_from);
        uint256 _reservePrice = reservePrice();
        return _reservePrice - _fractionsCount * fractionPrice;
    }

	/**
     * @dev Returns the total balance in the vault if the fractions have been redeemed.
     * @return _vaultBalance The total vault balance (in payment tokens) available for claiming.
     * If the fractions have not been redeemed, the balance is zero.
     */
    function vaultBalance() external view returns (uint256 _vaultBalance) {
        if (!released) return 0; // Vault balance is zero if not redeemed.
        uint256 _fractionsCount = issuedToken.totalSupply();
        return _fractionsCount * fractionPrice; // Total value of all fractions at their price.
    }

    /**
     * @dev Returns the balance in the vault that the given address is entitled to claim.
     * @param _from The address of the user to check the vault balance for.
     * @return _vaultBalanceOf The vault balance (in payment tokens) claimable by the user.
     * If the fractions have not been redeemed, the balance is zero.
     */
    function vaultBalanceOf(address _from) public view returns (uint256 _vaultBalanceOf) {
        if (!released) return 0; // Vault balance is zero if not redeemed.
        uint256 _fractionsCount = issuedToken.balanceOf(_from);
        return _fractionsCount * fractionPrice; // User's proportional share of the total vault.
    }



     /**
     * @notice Returns the total no. of tokens sold
     */
    function getTokensSold() external view returns (uint256) {
        return 0;
    }

}
