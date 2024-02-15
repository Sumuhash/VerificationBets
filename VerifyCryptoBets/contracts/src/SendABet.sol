// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

contract SendABet {
    event CommitmentPosted(address indexed sender, uint256 quantity, uint256 expireDate);
    function postCommitment( uint256 quantity, uint256 expireDate) public {
        emit CommitmentPosted(msg.sender, quantity, expireDate);
    }
}