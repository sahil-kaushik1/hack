import { ethers } from "ethers";

declare global {
  interface Window {
    ethereum?: any;
  }
}

const contractABI = [
  "function wills(uint256) view returns (address beneficiary, uint8 assetType, (address assetAddress, uint256 amountOrId, string metadata) assetInfo, bool active)",
  "function tokenURI(uint256) view returns (string)",
  "function ownerOf(uint256) view returns (address)",
  "function mintNFT(address _beneficiary, uint8 _assetType, address _assetAddress, uint256 _amountOrId, string memory _metadata) external",
  "function checkIn(uint256 tokenId) external",
  "function executeWill(uint256 tokenId) public",
];

class Web3Client {
  private provider: ethers.BrowserProvider | null = null;
  private signer: ethers.JsonRpcSigner | null = null;
  private contract: ethers.Contract | null = null;
  private contractAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

  async connect() {
    if (typeof window.ethereum === "undefined") {
      throw new Error("MetaMask is not installed. Please install MetaMask to use this application.");
    }

    try {
      // Request account access
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });

      if (!accounts || accounts.length === 0) {
        throw new Error("No accounts found. Please unlock MetaMask and try again.");
      }

      // Connect to provider
      this.provider = new ethers.BrowserProvider(window.ethereum);

      // Check network
      const network = await this.provider.getNetwork();
      const chainId = Number(network.chainId);

      // Check if we're on localhost/hardhat network (chainId: 31337)
      if (chainId !== 31337) {
        throw new Error("Please connect to the Hardhat/localhost network (chainId: 31337)");
      }

      // Get signer
      this.signer = await this.provider.getSigner();

      // Create contract instance
      this.contract = new ethers.Contract(
        this.contractAddress, 
        contractABI, 
        this.signer
      );

      // Setup network change listener
      window.ethereum.on('chainChanged', () => {
        window.location.reload();
      });

      // Setup account change listener
      window.ethereum.on('accountsChanged', () => {
        window.location.reload();
      });

      return true;
    } catch (error: any) {
      this.disconnect();
      // If it's a user rejection, throw a more friendly error
      if (error.code === 4001) {
        throw new Error("Please accept the connection request in MetaMask");
      }
      throw error;
    }
  }

  disconnect() {
    if (window.ethereum) {
      window.ethereum.removeAllListeners('chainChanged');
      window.ethereum.removeAllListeners('accountsChanged');
    }
    this.provider = null;
    this.signer = null;
    this.contract = null;
  }

  isConnected(): boolean {
    return this.contract !== null && this.signer !== null;
  }

  async getWillsForUser() {
    if (!this.contract || !this.signer) {
      throw new Error("Please connect your wallet first");
    }

    const wills = [];
    const userAddress = await this.signer.getAddress();

    try {
      for (let tokenId = 1; tokenId <= 100; tokenId++) {
        try {
          const owner = await this.contract.ownerOf(tokenId);
          if (owner.toLowerCase() === userAddress.toLowerCase()) {
            const will = await this.contract.wills(tokenId);
            try {
              // Try to parse metadata as JSON to get image URL
              const metadata = JSON.parse(will.assetInfo.metadata);
              wills.push({
                tokenId,
                beneficiary: will.beneficiary,
                assetType: Number(will.assetType),
                assetInfo: {
                  assetAddress: will.assetInfo.assetAddress,
                  amountOrId: will.assetInfo.amountOrId.toString(),
                  metadata: will.assetInfo.metadata,
                },
                active: will.active,
                imageUrl: metadata.image || null,
              });
            } catch {
              // If metadata is not JSON or doesn't contain image, push will without imageUrl
              wills.push({
                tokenId,
                beneficiary: will.beneficiary,
                assetType: Number(will.assetType),
                assetInfo: {
                  assetAddress: will.assetInfo.assetAddress,
                  amountOrId: will.assetInfo.amountOrId.toString(),
                  metadata: will.assetInfo.metadata,
                },
                active: will.active,
              });
            }
          }
        } catch (error: any) {
          // Token doesn't exist, stop searching
          if (error.code === "CALL_EXCEPTION") {
            break;
          }
          throw error;
        }
      }
    } catch (error) {
      console.error("Error fetching wills:", error);
      throw new Error("Failed to fetch your digital wills. Please try again.");
    }

    return wills;
  }

  async mintNFT(
    beneficiary: string,
    assetType: number,
    assetAddress: string,
    amountOrId: string,
    metadata: string,
    imageUrl?: string
  ) {
    if (!this.contract) {
      throw new Error("Please connect your wallet first");
    }

    try {
      // If imageUrl is provided, include it in metadata
      const metadataObj = imageUrl ? { image: imageUrl, ...JSON.parse(metadata || '{}') } : JSON.parse(metadata || '{}');

      const tx = await this.contract.mintNFT(
        beneficiary,
        assetType,
        assetAddress,
        amountOrId,
        JSON.stringify(metadataObj)
      );
      await tx.wait();
    } catch (error: any) {
      console.error("Mint error:", error);
      throw new Error(error.message || "Failed to create digital will. Please try again.");
    }
  }

  async checkIn(tokenId: number) {
    if (!this.contract) {
      throw new Error("Please connect your wallet first");
    }

    try {
      const tx = await this.contract.checkIn(tokenId);
      await tx.wait();
    } catch (error: any) {
      console.error("Check-in error:", error);
      throw new Error(error.message || "Failed to check in. Please try again.");
    }
  }
}

export const web3Client = new Web3Client();