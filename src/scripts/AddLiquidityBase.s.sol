// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";

interface IERC20 {
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IWETH {
    function deposit() external payable;
}

interface IPermit2 {
    function approve(address token, address spender, uint160 amount, uint48 expiration) external;
}

contract AddLiquidityBase is Script {
    address constant POSITION_MANAGER = 0x7C5f5A4bBd8fD63184577525326123B519429bDc;
    address constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;
    address constant WETH = 0x4200000000000000000000000000000000000006;
    address constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console2.log("Adding Liquidity on BASE");
        console2.log("Deployer:", deployer);
        console2.log("ETH Balance:", deployer.balance);
        console2.log("USDC Balance:", IERC20(USDC).balanceOf(deployer));

        // Use smaller amount - 0.005 ETH
        uint256 ethAmount = 0.005 ether;
        require(deployer.balance >= ethAmount, "Not enough ETH");

        vm.startBroadcast(deployerPrivateKey);

        // Wrap ETH to WETH
        console2.log("Wrapping ETH to WETH...");
        IWETH(WETH).deposit{value: ethAmount}();

        // Approve Permit2
        console2.log("Approving tokens...");
        IERC20(WETH).approve(PERMIT2, type(uint256).max);
        IERC20(USDC).approve(PERMIT2, type(uint256).max);

        // Approve Position Manager via Permit2
        IPermit2(PERMIT2).approve(WETH, POSITION_MANAGER, type(uint160).max, type(uint48).max);
        IPermit2(PERMIT2).approve(USDC, POSITION_MANAGER, type(uint160).max, type(uint48).max);

        vm.stopBroadcast();

        console2.log("APPROVALS COMPLETE!");
        console2.log("Now use frontend to add liquidity");
    }
}
