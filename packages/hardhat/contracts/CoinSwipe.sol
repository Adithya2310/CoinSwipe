// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// 1inch AggregationRouterV6 interface for Base network
interface IAggregationRouterV6 {
    struct SwapDescription {
        IERC20 srcToken;
        IERC20 dstToken;
        address srcReceiver;
        address dstReceiver;
        uint256 amount;
        uint256 minReturnAmount;
        uint256 flags;
    }

    function swap(
        address executor,
        SwapDescription calldata desc,
        bytes calldata permit,
        bytes calldata data
    ) external payable returns (uint256 returnAmount, uint256 spentAmount);

    function unoswap(
        IERC20 srcToken,
        uint256 amount,
        uint256 minReturn,
        uint256 dex
    ) external payable returns (uint256 returnAmount);

    function unoswapTo(
        IERC20 srcToken,
        uint256 amount,
        uint256 minReturn,
        uint256 dex,
        address to
    ) external payable returns (uint256 returnAmount);
}

contract CoinSwipe is Ownable {
    uint256 public feePercentage; // Fee percentage in basis points (e.g., 100 = 1%)
    address public feeCollectionAddress; // Address where fees are sent
    IAggregationRouterV6 public oneInchRouter;
    
    // Base network addresses
    address private constant WETH = 0x4200000000000000000000000000000000000006;
    address private constant ONE_INCH_ROUTER_V6 = 0x111111125421cA6dc452d289314280a0f8842A65;

    event FeePercentageUpdated(uint256 oldFee, uint256 newFee);
    event FeeCollectionAddressUpdated(address oldAddress, address newAddress);
    event SwapETHToToken(address indexed user, uint256 ethAmount, address token);
    event SwapTokenToETH(address indexed user, uint256 tokenAmount, address token);

    constructor(
        uint256 _initialFeePercentage,
        address _feeCollectionAddress
    ) Ownable(msg.sender) {
        require(_initialFeePercentage <= 10000, "Fee percentage too high");
        require(_feeCollectionAddress != address(0), "Invalid fee address");

        feePercentage = _initialFeePercentage;
        feeCollectionAddress = _feeCollectionAddress;
        oneInchRouter = IAggregationRouterV6(ONE_INCH_ROUTER_V6);
    }

    // Update the fee percentage
    function setFeePercentage(uint256 _newFeePercentage) external onlyOwner {
        require(_newFeePercentage <= 10000, "Fee percentage too high");
        emit FeePercentageUpdated(feePercentage, _newFeePercentage);
        feePercentage = _newFeePercentage;
    }

    // Update the fee collection address
    function setFeeCollectionAddress(address _newFeeCollectionAddress) external onlyOwner {
        require(_newFeeCollectionAddress != address(0), "Invalid fee address");
        emit FeeCollectionAddressUpdated(feeCollectionAddress, _newFeeCollectionAddress);
        feeCollectionAddress = _newFeeCollectionAddress;
    }

    // Swap ETH to token using 1inch unoswap
    function swapEthToToken(address _token, uint256 _minTokens, uint256 _dex) external payable {
        require(msg.value > 0, "ETH required for swap");
        require(_token != WETH, "Cannot swap ETH to WETH directly");

        uint256 fee = (msg.value * feePercentage) / 10000;
        uint256 amountToSwap = msg.value - fee;

        // Send fee to the fee collection address (in ETH)
        if (fee > 0) {
            payable(feeCollectionAddress).transfer(fee);
        }

        // Perform the swap using 1inch unoswapTo with ETH
        oneInchRouter.unoswapTo{value: amountToSwap}(
            IERC20(address(0)), // address(0) represents ETH in 1inch
            amountToSwap,
            _minTokens,
            _dex,
            msg.sender
        );

        emit SwapETHToToken(msg.sender, msg.value, _token);
    }

    // Swap token to ETH using 1inch unoswap
    function swapTokenToEth(
        address _token,
        uint256 _tokenAmount,
        uint256 _minETH,
        uint256 _dex
    ) external {
        require(_tokenAmount > 0, "Token amount required");
        require(_token != WETH, "Cannot swap WETH to WETH");

        uint256 fee = (_tokenAmount * feePercentage) / 10000;
        uint256 amountToSwap = _tokenAmount - fee;

        // Transfer tokens to the contract
        IERC20(_token).transferFrom(msg.sender, address(this), _tokenAmount);

        // Send fee to the fee collection address (in tokens)
        if (fee > 0) {
            IERC20(_token).transfer(feeCollectionAddress, fee);
        }

        // Approve 1inch router to spend tokens
        IERC20(_token).approve(address(oneInchRouter), amountToSwap);

        // Perform the swap using 1inch unoswapTo to ETH
        oneInchRouter.unoswapTo(
            IERC20(_token),
            amountToSwap,
            _minETH,
            _dex,
            msg.sender
        );

        emit SwapTokenToETH(msg.sender, _tokenAmount, _token);
    }

    // Emergency function to recover stuck tokens
    function emergencyWithdraw(address _token, uint256 _amount) external onlyOwner {
        if (_token == address(0)) {
            // Withdraw ETH
            require(address(this).balance >= _amount, "Insufficient contract balance");
            payable(msg.sender).transfer(_amount);
        } else {
            // Withdraw ERC20 tokens
            IERC20 token = IERC20(_token);
            require(token.balanceOf(address(this)) >= _amount, "Insufficient token balance");
            token.transfer(msg.sender, _amount);
        }
    }

    // Allow contract to receive ETH
    receive() external payable {}
}
