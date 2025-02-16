pragma solidity ^0.8.26;

import {Test, console} from "lib/forge-std/src/Test.sol";
import {DigitalWill} from "src/hack.sol";
import {DeployHack} from "script/hack.s.sol";

contract testhack is Test {
    address public user1 = makeAddr("USER1");
    address assetAddress = makeAddr("asset");
    address public user2 = makeAddr("USER2");
    uint256 tokenId;
    string tokenURI = "ipfs://example-uri";
    string metadata = "Real Estate in NYC";
    DeployHack dhp;
    DigitalWill dgt;

    function setUp() public {
        dhp = new DeployHack();
        dgt = dhp.run();
    }

    function testMintNFT() public {
        vm.startPrank(user1);

        dgt.mintNFT(
            user2,
            DigitalWill.AssetType.REAL_ESTATE,
            assetAddress,
            123,
            metadata
        );
        console.log("hello");
        tokenId = 1;
        (
            address _user2,
            DigitalWill.AssetType _assetType,
            DigitalWill.AssetInfo memory _assetInfo,
            bool active
        ) = dgt.wills(tokenId);

        assertEq(_user2, user2);
        assertEq(
            uint256(_assetType),
            uint256(DigitalWill.AssetType.REAL_ESTATE)
        );
        assertEq(_assetInfo.assetAddress, assetAddress);
        assertEq(_assetInfo.amountOrId, 123);
        assertEq(_assetInfo.metadata, metadata);
        assertTrue(active);
        vm.stopPrank();
    }

    function testCheckIn() public {
        vm.prank(user1);
        dgt.mintNFT(
            user2,
            DigitalWill.AssetType.CRYPTOCURRENCY,
            assetAddress,
            1000,
            metadata
        );

        tokenId = 1;
        uint256 oldTimestamp = dgt.lastCheckIn(tokenId);

        vm.warp(block.timestamp + 1 days);
        vm.prank(user1);
        dgt.checkIn(tokenId);

        uint256 newTimestamp = dgt.lastCheckIn(tokenId);
        assertGt(newTimestamp, oldTimestamp);
    }

    function testExecuteWill() public {
        vm.prank(user1);
        dgt.mintNFT(
            user2,
            DigitalWill.AssetType.REAL_ESTATE,
            assetAddress,
            123,
            metadata
        );

        tokenId = 1;
        vm.warp(block.timestamp + 366 days);
        vm.prank(user2);
        dgt.executeWill(tokenId);

        (
            address _user2,
            ,
            DigitalWill.AssetInfo memory asset,
            bool active
        ) = dgt.wills(tokenId);
        assertEq(active, false);
        assertEq(dgt.ownerOf(tokenId), user2);
    }

    function testUpdateCheckInThreshold() public {
        vm.prank(msg.sender);
        dgt.updateCheckInThreshold(180 days);

        assertEq(dgt.checkInThreshold(), 180 days);
    }

    function testtokenUri() public {
        vm.startPrank(user1);

        dgt.mintNFT(
            user2,
            DigitalWill.AssetType.REAL_ESTATE,
            assetAddress,
            123,
            metadata
        );

        tokenId = 1;
        console.log(dgt.tokenURI(1));
    }

    function testExecuteWillFailsBeforeThreshold() public {
        vm.startPrank(user1);

        dgt.mintNFT(
            user2,
            DigitalWill.AssetType.INTELLECTUAL_PROPERTY,
            address(0),
            1,
            "Intellectual Property Metadata"
        );
        vm.stopPrank();
        vm.expectRevert("Owner is still active");
        vm.prank(user2); // Simulating a third party calling
        dgt.executeWill(1);

        vm.stopPrank();
    }

    function testSendWillReminder() public {
        vm.startPrank(user1);

        dgt.mintNFT(
            user2,
            DigitalWill.AssetType.REAL_ESTATE,
            address(0),
            0,
            "Real Estate Metadata"
        );

        uint256 tokenId = 1;

        // Simulate reaching 30 days before check-in expiry
        vm.warp(block.timestamp + 335 days);
        console.log(block.timestamp / 1 days);
        console.log(dgt.checkInThreshold() / 1 days);
        vm.expectEmit(true, true, false, false);
        emit DigitalWill.WillReminder(tokenId, user1, 30);
        dgt.sendWillReminder(tokenId);

        vm.stopPrank();
    }

    function testEarlyTransferToBeneficiary() public {
        vm.startPrank(user1);

        dgt.mintNFT(
            user2,
            DigitalWill.AssetType.REAL_ESTATE,
            address(0),
            0,
            "Real Estate Metadata"
        );

        uint256 tokenId = 1;

        // Ensure initial owner is user1
        assertEq(dgt.ownerOf(tokenId), user1);

        // User1 voluntarily transfers the NFT to user2
        dgt.earlyTransferToBeneficiary(tokenId);

        // Ensure new owner is user2
        assertEq(dgt.ownerOf(tokenId), user2);

        vm.stopPrank();
    }
}
