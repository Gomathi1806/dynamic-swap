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

/// @title AddLiquidityOptimism
contract AddLiquidityOptimism is Script {
    address constant POSITION_MANAGER = 0x3C3Ea4B57a46241e54610e5f022E5c45859A1017;
    address constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;
    address constant WETH = 0x4200000000000000000000000000000000000006;
    address constant USDC = 0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console2.log("Adding Liquidity on OPTIMISM");
        console2.log("Deployer:", deployer);
        console2.log("ETH Balance:", deployer.balance);
        console2.log("USDC Balance:", IERC20(USDC).balanceOf(deployer));

        uint256 ethAmount = 0.005 ether;
        require(deployer.balance >= ethAmount, "Not enough ETH");

        vm.startBroadcast(deployerPrivateKey);

        IWETH(WETH).deposit{value: ethAmount}();
        IERC20(WETH).approve(PERMIT2, type(uint256).max);
        IERC20(USDC).approve(PERMIT2, type(uint256).max);
        IPermit2(PERMIT2).approve(WETH, POSITION_MANAGER, type(uint160).max, type(uint48).max);
        IPermit2(PERMIT2).approve(USDC, POSITION_MANAGER, type(uint160).max, type(uint48).max);

        vm.stopBroadcast();

        console2.log("APPROVALS COMPLETE on Optimism!");
    }
}

/// @title AddLiquidityUnichain
contract AddLiquidityUnichain is Script {
    address constant POSITION_MANAGER = 0x4529A01c7A0410167c5740C487A8DE60232617bf;
    address constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;
    address constant WETH = 0x4200000000000000000000000000000000000006;
    address constant USDC = 0x078D782b760474a361dDA0AF3839290b0EF57AD6;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console2.log("Adding Liquidity on UNICHAIN");
        console2.log("Deployer:", deployer);
        console2.log("ETH Balance:", deployer.balance);
        console2.log("USDC Balance:", IERC20(USDC).balanceOf(deployer));

        uint256 ethAmount = 0.005 ether;
        require(deployer.balance >= ethAmount, "Not enough ETH");

        vm.startBroadcast(deployerPrivateKey);

        IWETH(WETH).deposit{value: ethAmount}();
        IERC20(WETH).approve(PERMIT2, type(uint256).max);
        IERC20(USDC).approve(PERMIT2, type(uint256).max);
        IPermit2(PERMIT2).approve(WETH, POSITION_MANAGER, type(uint160).max, type(uint48).max);
        IPermit2(PERMIT2).approve(USDC, POSITION_MANAGER, type(uint160).max, type(uint48).max);

        vm.stopBroadcast();

        console2.log("APPROVALS COMPLETE on Unichain!");
    }
}

/// @title AddLiquidityCelo
contract AddLiquidityCelo is Script {
    address constant POSITION_MANAGER = 0xf7965f3981e4D5BC383BfBCb61501763e9068CA9;
    address constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;
    address constant CELO = 0x471EcE3750Da237f93B8E339c536989b8978a438;
    address constant CUSD = 0x765DE816845861e75A25fCA122bb6898B8B1282a;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console2.log("Adding Liquidity on CELO");
        console2.log("Deployer:", deployer);
        console2.log("CELO Balance:", IERC20(CELO).balanceOf(deployer));
        console2.log("cUSD Balance:", IERC20(CUSD).balanceOf(deployer));

        vm.startBroadcast(deployerPrivateKey);

        IERC20(CELO).approve(PERMIT2, type(uint256).max);
        IERC20(CUSD).approve(PERMIT2, type(uint256).max);
        IPermit2(PERMIT2).approve(CELO, POSITION_MANAGER, type(uint160).max, type(uint48).max);
        IPermit2(PERMIT2).approve(CUSD, POSITION_MANAGER, type(uint160).max, type(uint48).max);

        vm.stopBroadcast();

        console2.log("APPROVALS COMPLETE on Celo!");
    }
}
