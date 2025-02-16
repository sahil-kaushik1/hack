// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.26;

import {Script} from "lib/forge-std/src/Script.sol";
import {DigitalWill} from "src/hack.sol";

contract DeployHack is Script {
    function run() external returns (DigitalWill) {
        string memory crypto = vm.readFile("img/crypto.svg");
        string memory realestate = vm.readFile("img/realestate.svg");
        string memory intellectual = vm.readFile(
            "img/intellectualproperty.svg"
        );
        vm.startBroadcast();
        DigitalWill Hack = new DigitalWill(crypto, realestate, intellectual);
        vm.stopBroadcast();
        return Hack;
    }
}
