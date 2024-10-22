// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
//import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract TokenAirdrop is Ownable {
    // Events
    event AirdropProcessed(address[] recipients, uint256[] amounts);
    event TokensRecovered(address token, uint256 amount);
    
    // State variables
    mapping(address => bool) public hasReceived;
    IERC20 public token;
    
    constructor(address _token) Ownable(msg.sender) {
        require(_token != address(0), "Invalid token address");
        token = IERC20(_token);
    }
    
    /**
     * @dev Processes airdrop to multiple recipients
     * @param _recipients Array of recipient addresses
     * @param _amounts Array of token amounts to distribute
     */
    function processAirdrop(
        address[] calldata _recipients,
        uint256[] calldata _amounts
    ) external onlyOwner  {
        require(_recipients.length > 0, "Empty recipients array");
        require(_recipients.length == _amounts.length, "Arrays length mismatch");
        
        uint256 totalAmount;
        
        // Calculate total amount needed
        for (uint256 i = 0; i < _amounts.length; i++) {
            totalAmount += _amounts[i];
        }
        
        // Check contract has enough tokens
        require(
            token.balanceOf(address(this)) >= totalAmount,
            "Insufficient token balance"
        );
        
        // Process transfers
        for (uint256 i = 0; i < _recipients.length; i++) {
            address recipient = _recipients[i];
            uint256 amount = _amounts[i];
            
            require(recipient != address(0), "Invalid recipient address");
            require(amount > 0, "Invalid amount");
            require(!hasReceived[recipient], "Recipient already received tokens");
            
            hasReceived[recipient] = true;
            require(token.transfer(recipient, amount), "Transfer failed");
        }
        
        emit AirdropProcessed(_recipients, _amounts);
    }
    
    /**
     * @dev Checks if addresses have received airdrop
     * @param _addresses Array of addresses to check
     * @return bool[] Array of receipt status
     */
    function checkReceived(address[] calldata _addresses) 
        external 
        view 
        returns (bool[] memory) 
    {
        bool[] memory received = new bool[](_addresses.length);
        
        for (uint256 i = 0; i < _addresses.length; i++) {
            received[i] = hasReceived[_addresses[i]];
        }
        
        return received;
    }
    
    /**
     * @dev Recovers tokens accidentally sent to contract
     * @param _token Address of token to recover
     */
    function recoverTokens(address _token) external onlyOwner {
        require(_token != address(0), "Invalid token address");
        IERC20 tokenToRecover = IERC20(_token);
        uint256 balance = tokenToRecover.balanceOf(address(this));
        require(balance > 0, "No tokens to recover");
        
        require(
            tokenToRecover.transfer(owner(), balance),
            "Recovery transfer failed"
        );
        
        emit TokensRecovered(_token, balance);
    }
}