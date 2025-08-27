import { expect } from "chai";
import { ethers } from "hardhat";
import { CoinSwipe } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("CoinSwipe", function () {
  let coinSwipe: CoinSwipe;
  let owner: SignerWithAddress;
  let feeCollector: SignerWithAddress;
  let user: SignerWithAddress;

  const INITIAL_FEE_PERCENTAGE = 100; // 1%
  
  before(async () => {
    [owner, feeCollector, user] = await ethers.getSigners();
    const coinSwipeFactory = await ethers.getContractFactory("CoinSwipe");
    coinSwipe = (await coinSwipeFactory.deploy(
      INITIAL_FEE_PERCENTAGE,
      feeCollector.address
    )) as CoinSwipe;
    await coinSwipe.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should have the right owner", async function () {
      expect(await coinSwipe.owner()).to.equal(owner.address);
    });

    it("Should have the correct initial fee percentage", async function () {
      expect(await coinSwipe.feePercentage()).to.equal(INITIAL_FEE_PERCENTAGE);
    });

    it("Should have the correct fee collection address", async function () {
      expect(await coinSwipe.feeCollectionAddress()).to.equal(feeCollector.address);
    });

    it("Should have the correct 1inch router address", async function () {
      const expectedRouterAddress = "0x111111125421cA6dc452d289314280a0f8842A65";
      expect(await coinSwipe.oneInchRouter()).to.equal(expectedRouterAddress);
    });
  });

  describe("Fee Management", function () {
    it("Should allow owner to update fee percentage", async function () {
      const newFeePercentage = 200; // 2%
      
      await expect(coinSwipe.setFeePercentage(newFeePercentage))
        .to.emit(coinSwipe, "FeePercentageUpdated")
        .withArgs(INITIAL_FEE_PERCENTAGE, newFeePercentage);
      
      expect(await coinSwipe.feePercentage()).to.equal(newFeePercentage);
      
      // Reset to original value
      await coinSwipe.setFeePercentage(INITIAL_FEE_PERCENTAGE);
    });

    it("Should not allow non-owner to update fee percentage", async function () {
      await expect(coinSwipe.connect(user).setFeePercentage(200))
        .to.be.revertedWithCustomError(coinSwipe, "OwnableUnauthorizedAccount");
    });

    it("Should not allow fee percentage above 100%", async function () {
      await expect(coinSwipe.setFeePercentage(10001))
        .to.be.revertedWith("Fee percentage too high");
    });

    it("Should allow owner to update fee collection address", async function () {
      const newFeeCollector = user.address;
      
      await expect(coinSwipe.setFeeCollectionAddress(newFeeCollector))
        .to.emit(coinSwipe, "FeeCollectionAddressUpdated")
        .withArgs(feeCollector.address, newFeeCollector);
      
      expect(await coinSwipe.feeCollectionAddress()).to.equal(newFeeCollector);
      
      // Reset to original value
      await coinSwipe.setFeeCollectionAddress(feeCollector.address);
    });

    it("Should not allow setting fee collection address to zero address", async function () {
      await expect(coinSwipe.setFeeCollectionAddress(ethers.ZeroAddress))
        .to.be.revertedWith("Invalid fee address");
    });
  });

  describe("Emergency Functions", function () {
    it("Should allow owner to emergency withdraw ETH", async function () {
      // Send some ETH to the contract
      await user.sendTransaction({
        to: await coinSwipe.getAddress(),
        value: ethers.parseEther("1")
      });

      const contractBalance = await ethers.provider.getBalance(await coinSwipe.getAddress());
      expect(contractBalance).to.equal(ethers.parseEther("1"));

      const ownerBalanceBefore = await ethers.provider.getBalance(owner.address);
      
      // Emergency withdraw
      const tx = await coinSwipe.emergencyWithdraw(ethers.ZeroAddress, contractBalance);
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;

      const ownerBalanceAfter = await ethers.provider.getBalance(owner.address);
      expect(ownerBalanceAfter).to.equal(ownerBalanceBefore + contractBalance - gasUsed);
    });

    it("Should not allow non-owner to emergency withdraw", async function () {
      await expect(coinSwipe.connect(user).emergencyWithdraw(ethers.ZeroAddress, 0))
        .to.be.revertedWithCustomError(coinSwipe, "OwnableUnauthorizedAccount");
    });
  });

  describe("Swap Functions", function () {
    it("Should revert swapEthToToken with zero ETH", async function () {
      const tokenAddress = "0x1234567890123456789012345678901234567890";
      await expect(coinSwipe.swapEthToToken(tokenAddress, 0, 0, { value: 0 }))
        .to.be.revertedWith("ETH required for swap");
    });

    it("Should revert swapEthToToken when trying to swap ETH to WETH", async function () {
      const wethAddress = "0x4200000000000000000000000000000000000006";
      await expect(coinSwipe.swapEthToToken(wethAddress, 0, 0, { value: ethers.parseEther("1") }))
        .to.be.revertedWith("Cannot swap ETH to WETH directly");
    });

    it("Should revert swapTokenToEth with zero token amount", async function () {
      const tokenAddress = "0x1234567890123456789012345678901234567890";
      await expect(coinSwipe.swapTokenToEth(tokenAddress, 0, 0, 0))
        .to.be.revertedWith("Token amount required");
    });
  });

  describe("Contract Receive Function", function () {
    it("Should be able to receive ETH", async function () {
      const amount = ethers.parseEther("0.5");
      
      await expect(
        user.sendTransaction({
          to: await coinSwipe.getAddress(),
          value: amount
        })
      ).to.not.be.reverted;

      const contractBalance = await ethers.provider.getBalance(await coinSwipe.getAddress());
      expect(contractBalance).to.be.gte(amount);
    });
  });
});
