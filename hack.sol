// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "lib/openzeppelin-contracts/contracts/token/ERC721/ERC721.sol";
import "lib/openzeppelin-contracts/contracts/access/Ownable.sol";
import "lib/openzeppelin-contracts/contracts/utils/Pausable.sol";
import "lib/openzeppelin-contracts/contracts/utils/Strings.sol";
import "lib/openzeppelin-contracts/contracts/utils/Base64.sol"; // Import Base64 encoding library
import "lib/chainlink/contracts/src/v0.8/automation/AutomationCompatible.sol"; // Import Chainlink Automation

contract DigitalWill is ERC721, Ownable, Pausable, AutomationCompatible {
    using Strings for uint256;

    enum AssetType {
        CRYPTOCURRENCY,
        REAL_ESTATE,
        INTELLECTUAL_PROPERTY
    }

    struct AssetInfo {
        address assetAddress;
        uint256 amountOrId;
        string metadata;
    }

    struct Will {
        address beneficiary;
        AssetType assetType;
        AssetInfo assetInfo;
        bool active;
    }

    mapping(uint256 => Will) public wills;
    mapping(uint256 => uint256) public lastCheckIn;
    uint256 public checkInThreshold = 365 days;
    uint256 private totalSupplyCounter;
    uint256 private constant REMINDER_PERIOD = 30 days;

    string private CRYPTOCURRENCY_SVG;
    string private REAL_ESTATE_SVG;
    string private INTELLECTUAL_PROPERTY_SVG;

    event WillCreated(
        uint256 indexed tokenId,
        address indexed owner,
        address indexed beneficiary,
        AssetType assetType,
        AssetInfo assetInfo
    );
    event WillExecuted(uint256 indexed tokenId, address indexed beneficiary);
    event OwnerCheckIn(uint256 indexed tokenId, address indexed owner);
    event WillReminder(
        uint256 indexed tokenId,
        address indexed owner,
        uint256 daysLeft
    );
    event WillExecutedNotification(
        uint256 indexed tokenId,
        address indexed owner,
        address indexed beneficiary
    );

    constructor(
        string memory cRYPTOCURRENCY_SVG,
        string memory rEAL_ESTATE_SVG,
        string memory iNTELLECTUAL_PROPERTY_SVG
    ) ERC721("DigitalWillNFT", "DWNFT") Ownable(msg.sender) {
        totalSupplyCounter = 0;
        CRYPTOCURRENCY_SVG = cRYPTOCURRENCY_SVG;
        REAL_ESTATE_SVG = rEAL_ESTATE_SVG;
        INTELLECTUAL_PROPERTY_SVG = iNTELLECTUAL_PROPERTY_SVG;
    }

    function mintNFT(
        address _beneficiary,
        AssetType _assetType,
        address _assetAddress,
        uint256 _amountOrId,
        string memory _metadata
    ) external whenNotPaused {
        totalSupplyCounter++;
        uint256 tokenId = totalSupplyCounter;
        _mint(msg.sender, tokenId);
        wills[tokenId] = Will(
            _beneficiary,
            _assetType,
            AssetInfo(_assetAddress, _amountOrId, _metadata),
            true
        );
        lastCheckIn[tokenId] = block.timestamp;
        emit WillCreated(
            tokenId,
            msg.sender,
            _beneficiary,
            _assetType,
            wills[tokenId].assetInfo
        );
    }

    function tokenURI(
        uint256 tokenId
    ) public view override returns (string memory) {
        Will memory will = wills[tokenId];
        string memory assetTypeStr = getAssetTypeString(will.assetType);
        string memory imageURI = getAssetSVG(will.assetType);

        string memory json = string(
            abi.encodePacked(
                '{"name": "Digital Will NFT #',
                tokenId.toString(),
                '", "description": "A Digital Will NFT representing an asset.", "attributes": [{"trait_type": "Asset Type", "value": "',
                assetTypeStr,
                '"}], "image": "data:image/svg+xml;base64,',
                Base64.encode(bytes(imageURI)),
                '"}'
            )
        );

        return
            string(
                abi.encodePacked(
                    "data:application/json;base64,",
                    Base64.encode(bytes(json))
                )
            );
    }

    function getAssetTypeString(
        AssetType assetType
    ) internal pure returns (string memory) {
        if (assetType == AssetType.CRYPTOCURRENCY) return "Cryptocurrency";
        if (assetType == AssetType.REAL_ESTATE) return "Real Estate";
        return "Intellectual Property";
    }

    function getAssetSVG(
        AssetType assetType
    ) internal view returns (string memory) {
        if (assetType == AssetType.CRYPTOCURRENCY) return CRYPTOCURRENCY_SVG;
        if (assetType == AssetType.REAL_ESTATE) return REAL_ESTATE_SVG;
        return INTELLECTUAL_PROPERTY_SVG;
    }

    function checkIn(uint256 tokenId) external {
        require(ownerOf(tokenId) == msg.sender, "Only owner can check in");
        lastCheckIn[tokenId] = block.timestamp;
        emit OwnerCheckIn(tokenId, msg.sender);
    }

    function executeWill(uint256 tokenId) public {
        Will storage will = wills[tokenId];
        require(will.active, "Will is inactive");
        require(
            block.timestamp > lastCheckIn[tokenId] + checkInThreshold,
            "Owner is still active"
        );

        address owner = ownerOf(tokenId);
        _transfer(owner, will.beneficiary, tokenId);
        will.active = false;

        emit WillExecuted(tokenId, will.beneficiary);
        emit WillExecutedNotification(tokenId, owner, will.beneficiary);
    }

    function updateCheckInThreshold(uint256 newThreshold) external onlyOwner {
        checkInThreshold = newThreshold;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function sendWillReminder(uint256 tokenId) external {
        uint256 lastChecked = lastCheckIn[tokenId];
        uint256 timeLeft = (lastChecked + checkInThreshold) - block.timestamp;

        uint256 daysLeft = timeLeft / 1 days; // Convert to days

        require(daysLeft <= REMINDER_PERIOD / 1 days, "No reminder needed");

        emit WillReminder(tokenId, ownerOf(tokenId), daysLeft);
    }

    function checkUpkeep(
        bytes calldata
    )
        external
        view
        override
        returns (bool upkeepNeeded, bytes memory performData)
    {
        for (uint256 tokenId = 1; tokenId <= totalSupplyCounter; tokenId++) {
            if (
                wills[tokenId].active &&
                block.timestamp > lastCheckIn[tokenId] + checkInThreshold
            ) {
                return (true, abi.encode(tokenId)); // Will needs execution
            }
        }
        return (false, "");
    }

    function performUpkeep(bytes calldata performData) external override {
        uint256 tokenId = abi.decode(performData, (uint256));
        executeWill(tokenId);
    }

    function earlyTransferToBeneficiary(uint256 tokenId) external {
        Will storage will = wills[tokenId];

        require(
            ownerOf(tokenId) == msg.sender,
            "Only owner can transfer early"
        );
        require(will.active, "Will is inactive");

        address beneficiary = will.beneficiary;

        // Transfer NFT to the beneficiary
        _transfer(msg.sender, beneficiary, tokenId);

        // Mark the will as inactive
        will.active = false;

        emit WillExecuted(tokenId, beneficiary);
        emit WillExecutedNotification(tokenId, msg.sender, beneficiary);
    }
}
