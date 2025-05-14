pragma solidity 0.5.8;

/**
 * @title KYC Whitelist Merkle STO Interface
 * @dev Interface for a whitelist-based KYC system using Merkle proofs and role-based permissions.
 */
interface IKYCWhitelistMerkleSTO {
    struct InvestorKYCData {
        uint64 expiryTime;
        bool isAccredited;
    }

    struct VerificationData {
        bytes32[] proof;
        uint64 expiry;
        bool isAccredited;
    }

    // ========== Admin/Operator Functions ==========

    function modifyKYCData(bytes32 root) external;

    function addTokenLockStartTime(address token, uint64 startTime) external;

    function modifyTokenTransferStatus(address token, bool status) external;

    function grantAdminRole(address account) external;

    function revokeAdminRole(address account) external;

    function grantOperatorRole(address account) external;

    function revokeOperatorRole(address account) external;

    // ========== Investor View Functions ==========

    function isExistingInvestor(address investor) external view returns (bool);

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
        );

    function getTokenTransferStatus(address token) external view returns (bool);

    // ========== KYC Verification ==========

    function verifyInvestor(
        bytes32[] calldata proof,
        address investor,
        uint64 expiry,
        bool isAccredited
    ) external returns (bool);

    // ========== Events ==========

    event TokenLockStartTimeAdded(address indexed token, uint64 startTime);
    event TokenTransferStatus(address indexed token, bool status);
    event AdminRoleGranted(address indexed account);
    event AdminRoleRevoked(address indexed account);
    event OperatorRoleGranted(address indexed account);
    event OperatorRoleRevoked(address indexed account);
    event MerkleRootUpdated(bytes32 root);
    event InvestorKYCDataUpdate(
        address indexed investor,
        uint64 expiryTime,
        bool isAccredited
    );
}