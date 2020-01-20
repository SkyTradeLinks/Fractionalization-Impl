---
id: version-3.0.0-AdvancedPLCRVotingCheckpointFactory
title: AdvancedPLCRVotingCheckpointFactory
original_id: AdvancedPLCRVotingCheckpointFactory
---

# Factory for deploying AdvancedPLCRVotingCheckpoint module (AdvancedPLCRVotingCheckpointFactory.sol)

View Source: [contracts/modules/Checkpoint/Voting/APLCR/AdvancedPLCRVotingCheckpointFactory.sol](../../contracts/modules/Checkpoint/Voting/APLCR/AdvancedPLCRVotingCheckpointFactory.sol)

**↗ Extends: [UpgradableModuleFactory](UpgradableModuleFactory.md)**

**AdvancedPLCRVotingCheckpointFactory**

## Functions

- [(uint256 _setupCost, uint256 _usageCost, address _logicContract, address _polymathRegistry, bool _isCostInPoly)](#)
- [deploy(bytes _data)](#deploy)

### 

Constructor

```js
function (uint256 _setupCost, uint256 _usageCost, address _logicContract, address _polymathRegistry, bool _isCostInPoly) public nonpayable UpgradableModuleFactory 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _setupCost | uint256 | Setup cost of the module | 
| _usageCost | uint256 | Usage cost of the key action | 
| _logicContract | address | Contract address that contains the logic related to `description` | 
| _polymathRegistry | address | Address of the Polymath registry | 
| _isCostInPoly | bool | true = cost in Poly, false = USD | 

### deploy

⤾ overrides [IModuleFactory.deploy](IModuleFactory.md#deploy)

used to launch the Module with the help of factory

```js
function deploy(bytes _data) external nonpayable
returns(address)
```

**Returns**

address Contract address of the Module

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _data | bytes |  | 
