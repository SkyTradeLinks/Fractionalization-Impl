pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

/**
 * @title Escrow wallet for distributing tokens on a vesting schedule
 */
contract VestingEscrowWallet is Ownable {
  using SafeMath for uint;

  bytes32 public constant ISSUER = "ISSUER";
  address public securityToken;

  struct VestingSchedule {
    // ID of the vesting schedule
    bytes32 vestingId;
    // Total number of vesting tokens at start of vesting period
    uint256 totalAllocation;
    // Length of the vesting period
    uint256 vestingDuration;
    // Start date of vesting schedule
    uint256 startDate;
    // Vesting frequency of the tokens
    uint256 vestingFrequency;
    // Total number of tokens released to the target
    uint256 totalTokensReleased;
    // Total number of tokens remaining to collect
    uint256 totalTokensRemaining;
    // Number of tokens to release to the target per tranche
    uint256 tokensPerTranche;
  }

  mapping(address => uint256) public individualVestingCount;
  mapping(address => mapping(uint256 => VestingSchedule)) public individualVestingDetails;

  /* Events */
  event VestingStarted(
    address indexed target,
    bytes32 indexed vestingId,
    uint256 indexed totalAllocation,
    uint256 vestingDuration,
    uint256 startDate,
    uint256 vestingFrequency,
    uint256 totalTokensReleased,
    uint256 totalTokensRemaining,
    uint256 tokensPerTranche
  );

  event VestingCancelled(
    address indexed target,
    uint256 indexed whichVestingShedule,
    bytes32 indexed vestingId,
    uint256 tokensCollected,
    uint256 cancellationTime
  );

  event TokensCollected(
    address indexed target,
    uint256 indexed whichVestingShedule,
    bytes32 indexed vestingId,
    uint256 numberTokensCollected
  );

  /**
   * @notice Constructor
   * @param _securityToken Address of the security token
   * @param _polyAddress Address of the polytoken
   */
  // constructor (address _securityToken, address _polyAddress)
  //   public
  //   Module(_securityToken, _polyAddress)
  // {
  // }

  /**
  * @notice Function used to intialize the differnet variables
  * @param _startTime Unix timestamp at which offering get started
  * @param _endTime Unix timestamp at which offering get ended
  * @param _cap Maximum No. of tokens for sale
  * @param _someString Any string that contails the details
  */
  // function configure(uint256 _startTime, uint256 _endTime, uint256 _cap, string _someString) public onlyFactory {
  //   startTime = _startTime;
  //   endTime = _endTime;
  //   cap = _cap;
  //   someString = _someString;
  // }

  /**
  * @notice This function returns the signature of configure function
  */
  // function getInitFunction() public pure returns (bytes4) {
  //   return bytes4(keccak256("configure(uint256,uint256,uint256,string)"));
  // }

  /**
  * @notice Initiate a vesting schedule for any number of employees or affiliates
  * @param _target Address of the employee or the affiliate
  * @param _totalAllocation Total number of tokens allocated for the target
  * @param _vestingDuration Total duration of the vesting schedule
  * @param _startDate Start date of the vesting schedule
  * @param _vestingFrequency Frequency of release of tokens
  */
  function initiateVestingSchedule(
    address[] _target,
    uint256[] _totalAllocation,
    uint256[] _vestingDuration,
    uint256[] _startDate,
    uint256[] _vestingFrequency
  )
    public
    onlyOwner
  {
      require(_target.length == _totalAllocation.length &&
              _target.length == _vestingDuration.length &&
              _target.length == _startDate.length &&
              _target.length == _vestingFrequency.length);

      for (uint i = 0; i <= _target.length; i++) {
          _initiateVestingScheduleIterate(_target[i],
                                          _totalAllocation[i],
                                          _vestingDuration[i],
                                          _startDate[i],
                                          _vestingFrequency[i]);
      }
  }

  /**
  * @notice Initiate a vesting schedule for an employee or affiliate
  * @param _target Address of the employee or the affiliate
  * @param _totalAllocation Total number of tokens allocated for the target
  * @param _vestingDuration Total duration of the vesting schedule
  * @param _startDate Start date of the vesting schedule
  * @param _vestingFrequency Frequency of release of tokens
  */
  function _initiateVestingScheduleIterate(
    address _target,
    uint256 _totalAllocation,
    uint256 _vestingDuration,
    uint256 _startDate,
    uint256 _vestingFrequency
  )
    internal
  {
    require(_target != address(0), "The target should be a valid addrss");
    require(_totalAllocation != 0, "The total allocation should not be 0");
    require(_vestingDuration != 0, "The vestingDuration should not be 0");
    require(_startDate >= now, "The starting date should be after now");
    require(
      _vestingFrequency != 0 && _vestingFrequency <= _vestingDuration,
      "The vestingFrequency should not be 0 and it should be less than the duration");
    require(_vestingDuration % _vestingFrequency == 0, "The vesting frequency should be a multiple of the vesting duration");
    // require(securityToken.balanceOf[address(this)] >= _totalAllocation, "Tokens must have been already sent to the smart contract");

    uint256 _numTranches = _vestingDuration.div(_vestingFrequency);
    uint256 _tokensPerTranche = _totalAllocation.div(_numTranches);   // TODO: Edge cases/truncation. If uneven, take this into account. I asked on Github

    bytes32 _vestingId = keccak256(
      abi.encodePacked(
        block.timestamp,
        _target,
        _totalAllocation,
        _vestingDuration,
        _startDate,
        _vestingFrequency
      )
    );

    uint256 _individualVestingCount = individualVestingCount[_target];
    individualVestingCount[_target] += 1;

    uint256 _totalTokensReleased = 0;
    uint256 _totalTokensRemaining = _totalAllocation;

    individualVestingDetails[_target][_individualVestingCount] = VestingSchedule({
      vestingId: _vestingId,
      totalAllocation: _totalAllocation,
      vestingDuration: _vestingDuration,
      startDate: _startDate,
      vestingFrequency: _vestingFrequency,
      totalTokensReleased: _totalTokensReleased,
      totalTokensRemaining: _totalTokensRemaining,
      tokensPerTranche: _tokensPerTranche
    });

    emit VestingStarted(
      _target,
      _vestingId,
      _totalAllocation,
      _vestingDuration,
      _startDate,
      _vestingFrequency,
      _totalTokensReleased,
      _totalTokensRemaining,
      _tokensPerTranche
    );

    // Send tokens to contract here (see lucidchart -> assumptions -> 2)
  }

  /**
  * @notice Cancel a vesting schedule for an employee or affiliate
  * @param _target Address of the employee or the affiliate
  * @param _whichVestingSchedule Index of the vesting schedule for the target
  */
  function cancelVestingSchedule(address _target, uint256 _whichVestingSchedule)
    public
    onlyOwner
  {
    VestingSchedule memory _vestingSchedule = individualVestingDetails[_target][_whichVestingSchedule];

    require(_vestingSchedule.vestingId != 0, "Schedule not initialized");  // TODO: May need to check a flag. Asked on Github. There may be an ID if we don't have to delete this.

    bytes32 _vestingId = _vestingSchedule.vestingId;
    uint256 _tokensCollected = _vestingSchedule.totalTokensRemaining;
    delete individualVestingDetails[_target][_whichVestingSchedule];  // TODO: Change this to a flag depending on Github response

    emit VestingCancelled(
      _target,
      _whichVestingSchedule,
      _vestingId,
      _tokensCollected,
      block.timestamp
    );

    // TODO: Return tokens to issuer. Asked what to do on Github
  }

  /**
  * @notice Collect vested tokens
  * @param _whichVestingSchedule Index of the vesting schedule for the target
  */
  function collectTokens(uint256 _whichVestingSchedule)
    public
  {
    VestingSchedule memory _vestingSchedule = individualVestingDetails[msg.sender][_whichVestingSchedule];

    require(_vestingSchedule.vestingId != 0, "Schedule not initialized");  // TODO: May need to check a flag. Asked on Github. There may be an ID if we don't have to delete this.
    require(_vestingSchedule.totalTokensRemaining != 0, "No tokens remain");  // TODO: May need to check a flag. Asked on Github. There may be an ID if we don't have to delete this.

    uint256 currentTranche = _calculateCurrentTranche(_vestingSchedule.startDate, _vestingSchedule.vestingDuration);
    uint256 tokensToDistribute = _calculateTokensToDistribute(currentTranche, _vestingSchedule.tokensPerTranche, _vestingSchedule.totalTokensReleased);

    _vestingSchedule.totalTokensReleased += tokensToDistribute;
    _vestingSchedule.totalTokensRemaining -= tokensToDistribute;

    // TODO: Send tokens to target.
  }

  // TODO: May need to push tokens as well. Asked on Github.

  /**
  * @notice Calculate the current tranche the user is on
  * @param _startDate Start date of the vesting period
  * @param _vestingDuration Total duration of the vesting schedule
  */
  function _calculateCurrentTranche(
    uint256 _startDate,
    uint256 _vestingDuration
  )
    internal
    view
    returns (uint256)
  {
    return now < _startDate
    ? 0
    : (now.sub(_startDate)).div(_vestingDuration);
  }

  /**
  * @notice Calculate the number of tokens to distribute per transaction
  * @param _currentTranche Current tranche of the vesting schedule
  * @param _tokensPerTranche Number of tokens to distribute in each tranche
  * @param _totalTokensReleased Number of tokens released thus far
  */
  function _calculateTokensToDistribute(
    uint256 _currentTranche,
    uint256 _tokensPerTranche,
    uint256 _totalTokensReleased
  )
    internal
    view
    returns (uint256)
  {
    uint256 _tokensToDistribute = _currentTranche.mul(_tokensPerTranche);
    return _tokensToDistribute.sub(_totalTokensReleased);
  }
}
