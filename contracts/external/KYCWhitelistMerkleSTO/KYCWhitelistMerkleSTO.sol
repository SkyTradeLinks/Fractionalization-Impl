pragma solidity 0.5.8;

import "./IKYCWhitelistMerkleSTO.sol";
import "openzeppelin-solidity/contracts/cryptography/MerkleProof.sol";

/**
 * @title KYCWhitelistMerkleSTO
 * @dev Manages KYC verification using Merkle proofs and controls token transfer behavior
 *      for a security token offering (STO) platform. It includes role-based permissions for
 *      admins and operators, and supports time-based transfer locks.
 */
contract KYCWhitelistMerkleSTO is IKYCWhitelistMerkleSTO {
    address public admin;
    bytes32 private _root;

    uint64 public constant MAX_LOCK_PERIOD = 365 days;

    mapping(address => InvestorKYCData) internal _investorKYCData;
    mapping(address => uint64) public tokenLockStartTime;
    mapping(address => bool) internal _existingInvestors;

    mapping(address => bool) public isAdmin;
    mapping(address => bool) public isOperator;
    mapping(address => bool) public tokenTransferStatus;

    constructor() public {
        admin = msg.sender;
        isAdmin[msg.sender] = true;
        isOperator[msg.sender] = true;
    }

    modifier onlyAdmin() {
        require(isAdmin[msg.sender], "Not an admin");
        _;
    }

    modifier onlyOperator() {
        require(isOperator[msg.sender], "Not an operator");
        _;
    }

    /**
     * @notice Updates the Merkle root for investor KYC validation.
     * @param root The new Merkle root hash
     */
    function modifyKYCData(bytes32 root) external onlyOperator {
        _root = root;
        emit MerkleRootUpdated(_root);
    }

    /**
     * @notice Sets a lock start time for a given token.
     * @param token The address of the token
     * @param startTime The UNIX timestamp when the lock starts
     */
    function addTokenLockStartTime(
        address token,
        uint64 startTime
    ) external onlyAdmin {
        tokenLockStartTime[token] = startTime;
        emit TokenLockStartTimeAdded(token, startTime);
    }

    /**
     * @notice Enables or disables token transfers for a specific token.
     * @param token The address of the token
     * @param status True if transfers are enabled, false otherwise
     */
    function modifyTokenTransferStatus(
        address token,
        bool status
    ) external onlyAdmin {
        tokenTransferStatus[token] = status;
        emit TokenTransferStatus(token, status);
    }

    /**
     * @notice Grants admin privileges to an account.
     * @param account The address to grant admin rights
     */
    function grantAdminRole(address account) external onlyAdmin {
        require(!isAdmin[account], "Account is already an admin");
        isAdmin[account] = true;
        emit AdminRoleGranted(account);
    }

    /**
     * @notice Revokes admin privileges from an account.
     * @param account The address to revoke admin rights
     */
    function revokeAdminRole(address account) external onlyAdmin {
        require(isAdmin[account], "Account is not an admin");
        isAdmin[account] = false;
        emit AdminRoleRevoked(account);
    }

    /**
     * @notice Grants operator privileges to an account.
     * @param account The address to grant operator rights
     */
    function grantOperatorRole(address account) external onlyAdmin {
        require(!isOperator[account], "Account is already an operator");
        isOperator[account] = true;
        emit OperatorRoleGranted(account);
    }

    /**
     * @notice Revokes operator privileges from an account.
     * @param account The address to revoke operator rights
     */
    function revokeOperatorRole(address account) external onlyAdmin {
        require(isOperator[account], "Account is not an operator");
        isOperator[account] = false;
        emit OperatorRoleRevoked(account);
    }

    /**
     * @notice Checks whether an investor has been verified and recorded.
     * @param investor The address of the investor
     */
    function isExistingInvestor(address investor) external view returns (bool) {
        return _existingInvestors[investor];
    }

    /**
     * @notice Verifies an investor's KYC data using a Merkle proof and stores it.
     * @param proof Array of hashes needed to prove membership in the Merkle tree
     * @param investor Investor's wallet address
     * @param expiry Expiry timestamp for KYC
     * @param isAccredited Boolean flag indicating if the investor is accredited
     */
    function verifyInvestor(
        bytes32[] calldata proof,
        address investor,
        uint64 expiry,
        bool isAccredited
    ) external returns (bool) {
        require(expiry > block.timestamp, "Investor proof has expired");

        bytes32 firstHash = keccak256(abi.encode(investor, expiry, isAccredited));
        bytes32 leaf = keccak256(abi.encode(firstHash));

        require(MerkleProof.verify(proof, _root, leaf), "Invalid proof");

        if (!_existingInvestors[investor]) {
            _existingInvestors[investor] = true;
        }

        _investorKYCData[investor] = InvestorKYCData({
            expiryTime: expiry,
            isAccredited: isAccredited
        });

        emit InvestorKYCDataUpdate(investor, expiry, isAccredited);
        return true;
    }

    /**
     * @notice Retrieves the investor's KYC metadata used by the protocol.
     * @param investor Investor wallet address
     * @param token Token address (used to determine transfer rules)
     * @return canSendAfter Timestamp after which the investor can send tokens
     * @return canReceiveAfter Timestamp after which the investor can receive tokens
     * @return expiryTime KYC expiry timestamp
     * @return added Flag indicating presence in the whitelist (always 1 if known)
     */
    function getInvestorKYCData(
        address investor,
        address token
    )
        external
        view
        returns (
            uint64 canSendAfter,
            uint64 canReceiveAfter,
            uint64 expiryTime,
            uint8 added
        )
    {
        bool exists = _existingInvestors[investor];
        uint64 nowPlusLock = uint64(block.timestamp + MAX_LOCK_PERIOD);
        uint64 nowMinusOne = uint64(block.timestamp - 1);

        if (exists) {
            InvestorKYCData memory data = _investorKYCData[investor];
            uint64 sendAfter = nowMinusOne;

            if (data.isAccredited) {
                sendAfter = tokenLockStartTime[token] + MAX_LOCK_PERIOD;
            }

            if (!tokenTransferStatus[token]) {
                sendAfter += nowPlusLock;
            }

            return (sendAfter, nowMinusOne, data.expiryTime, 1);
        } else {
            return (nowPlusLock, nowPlusLock, nowMinusOne, 1);
        }
    }

    /**
     * @notice Returns whether a token is allowed to be transferred.
     * @param token Address of the token
     * @return True if transfers are allowed, false otherwise
     */
    function getTokenTransferStatus(address token) external view returns (bool) {
        return tokenTransferStatus[token];
    }
}