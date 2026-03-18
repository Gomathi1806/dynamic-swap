// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

library HookMiner {
    function find(
        address deployer,
        uint160 flags,
        bytes memory creationCode,
        bytes memory constructorArgs
    ) internal pure returns (address hookAddress, bytes32 salt) {
        bytes memory creationCodeWithArgs = abi.encodePacked(
            creationCode,
            constructorArgs
        );
        bytes32 initCodeHash = keccak256(creationCodeWithArgs);

        for (uint256 saltNum = 0; saltNum < 100000000; saltNum++) {
            salt = bytes32(saltNum);
            hookAddress = address(
                uint160(
                    uint256(
                        keccak256(
                            abi.encodePacked(
                                bytes1(0xff),
                                deployer,
                                salt,
                                initCodeHash
                            )
                        )
                    )
                )
            );

            if (uint160(hookAddress) & 0x3FFF == flags & 0x3FFF) {
                return (hookAddress, salt);
            }
        }
        revert("No valid salt found");
    }
}
