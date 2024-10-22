import {
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";

describe("TokenAirdrop", function () {
  // Fixture to deploy contracts and set up initial state
  async function deployAirdropFixture() {
    // Get signers
    const [owner, recipient1, recipient2, recipient3] = await hre.ethers.getSigners();

    // Deploy mock ERC20 token
    const MockToken = await hre.ethers.getContractFactory("MockERC20");
    const token = await MockToken.deploy("Mock Token", "MTK");
    
    // Deploy airdrop contract
    const TokenAirdrop = await hre.ethers.getContractFactory("TokenAirdrop");
    const airdrop = await TokenAirdrop.deploy(await token.getAddress());

    // Mint tokens to airdrop contract
    const mintAmount = hre.ethers.parseEther("1000000");
    await token.mint(await airdrop.getAddress(), mintAmount);

    return { 
      token, 
      airdrop, 
      owner, 
      recipient1, 
      recipient2, 
      recipient3,
      mintAmount 
    };
  }

  describe("Deployment", function () {
    it("Should set the right token address", async function () {
      const { token, airdrop } = await loadFixture(deployAirdropFixture);
      expect(await airdrop.token()).to.equal(await token.getAddress());
    });

    it("Should set the right owner", async function () {
      const { airdrop, owner } = await loadFixture(deployAirdropFixture);
      expect(await airdrop.owner()).to.equal(owner.address);
    });

    it("Should fail if token address is zero", async function () {
      const TokenAirdrop = await hre.ethers.getContractFactory("TokenAirdrop");
      await expect(TokenAirdrop.deploy(hre.ethers.ZeroAddress))
        .to.be.revertedWith("Invalid token address");
    });
  });

  describe("Airdrop Processing", function () {
    describe("Validations", function () {
      it("Should revert if called by non-owner", async function () {
        const { airdrop, recipient1, recipient2 } = await loadFixture(deployAirdropFixture);
        const recipients = [recipient1.address, recipient2.address];
        const amounts = [100, 200];

        await expect(airdrop.connect(recipient1).processAirdrop(recipients, amounts))
          .to.be.revertedWithCustomError(airdrop, "OwnableUnauthorizedAccount");
      });

      it("Should revert if recipients array is empty", async function () {
        const { airdrop } = await loadFixture(deployAirdropFixture);
        await expect(airdrop.processAirdrop([], []))
          .to.be.revertedWith("Empty recipients array");
      });

      it("Should revert if arrays length mismatch", async function () {
        const { airdrop, recipient1, recipient2 } = await loadFixture(deployAirdropFixture);
        const recipients = [recipient1.address, recipient2.address];
        const amounts = [100];

        await expect(airdrop.processAirdrop(recipients, amounts))
          .to.be.revertedWith("Arrays length mismatch");
      });

      it("Should revert if recipient address is zero", async function () {
        const { airdrop } = await loadFixture(deployAirdropFixture);
        const recipients = [hre.ethers.ZeroAddress];
        const amounts = [100];

        await expect(airdrop.processAirdrop(recipients, amounts))
          .to.be.revertedWith("Invalid recipient address");
      });

      it("Should revert if amount is zero", async function () {
        const { airdrop, recipient1 } = await loadFixture(deployAirdropFixture);
        const recipients = [recipient1.address];
        const amounts = [0];

        await expect(airdrop.processAirdrop(recipients, amounts))
          .to.be.revertedWith("Invalid amount");
      });
    });

    describe("Transfers", function () {
      it("Should transfer correct amounts to recipients", async function () {
        const { airdrop, token, recipient1, recipient2 } = await loadFixture(deployAirdropFixture);
        const recipients = [recipient1.address, recipient2.address];
        const amounts = [hre.ethers.parseEther("100"), hre.ethers.parseEther("200")];

        await airdrop.processAirdrop(recipients, amounts);

        expect(await token.balanceOf(recipient1.address)).to.equal(amounts[0]);
        expect(await token.balanceOf(recipient2.address)).to.equal(amounts[1]);
      });

      it("Should prevent duplicate airdrops to same address", async function () {
        const { airdrop, recipient1 } = await loadFixture(deployAirdropFixture);
        const recipients = [recipient1.address];
        const amounts = [hre.ethers.parseEther("100")];

        await airdrop.processAirdrop(recipients, amounts);

        await expect(airdrop.processAirdrop(recipients, amounts))
          .to.be.revertedWith("Recipient already received tokens");
      });
    });

    describe("Events", function () {
      it("Should emit AirdropProcessed event", async function () {
        const { airdrop, recipient1, recipient2 } = await loadFixture(deployAirdropFixture);
        const recipients = [recipient1.address, recipient2.address];
        const amounts = [hre.ethers.parseEther("100"), hre.ethers.parseEther("200")];

        await expect(airdrop.processAirdrop(recipients, amounts))
          .to.emit(airdrop, "AirdropProcessed")
          .withArgs(recipients, amounts);
      });
    });
  });

  describe("Token Recovery", function () {
    it("Should allow owner to recover tokens", async function () {
      const { airdrop, token, owner } = await loadFixture(deployAirdropFixture);
      const initialBalance = await token.balanceOf(await airdrop.getAddress());

      await airdrop.recoverTokens(await token.getAddress());

      expect(await token.balanceOf(owner.address)).to.equal(initialBalance);
      expect(await token.balanceOf(await airdrop.getAddress())).to.equal(0);
    });

    it("Should emit TokensRecovered event", async function () {
      const { airdrop, token } = await loadFixture(deployAirdropFixture);
      const balance = await token.balanceOf(await airdrop.getAddress());

      await expect(airdrop.recoverTokens(await token.getAddress()))
        .to.emit(airdrop, "TokensRecovered")
        .withArgs(await token.getAddress(), balance);
    });

    it("Should revert if called by non-owner", async function () {
      const { airdrop, token, recipient1 } = await loadFixture(deployAirdropFixture);
      
      await expect(airdrop.connect(recipient1).recoverTokens(await token.getAddress()))
        .to.be.revertedWithCustomError(airdrop, "OwnableUnauthorizedAccount");
    });
  });

  describe("Status Checking", function () {
    it("Should correctly report airdrop status", async function () {
      const { airdrop, recipient1, recipient2, recipient3 } = await loadFixture(deployAirdropFixture);
      
      // Process airdrop for first two recipients
      await airdrop.processAirdrop(
        [recipient1.address, recipient2.address],
        [hre.ethers.parseEther("100"), hre.ethers.parseEther("200")]
      );

      const status = await airdrop.checkReceived([
        recipient1.address,
        recipient2.address,
        recipient3.address
      ]);

      expect(status).to.deep.equal([true, true, false]);
    });
  });
});