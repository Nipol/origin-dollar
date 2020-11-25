const { defaultFixture, mockVaultFixture } = require("../_fixture");
const { expect } = require("chai");
const { BigNumber, utils } = require("ethers");

const { daiUnits, loadFixture } = require("../helpers");

describe("Vault mock with rebase", async () => {
  it("Should increase users balance on rebase after increased Vault value", async () => {
    const { vault, matt, ousd, josh } = await loadFixture(mockVaultFixture);
    // Total OUSD supply is 200, mock an increase
    await vault.setTotalValue(utils.parseUnits("220", 18));
    await vault.rebase();
    await expect(matt).has.an.approxBalanceOf("110.00", ousd);
    await expect(josh).has.an.approxBalanceOf("110.00", ousd);
  });

  it("Should not decrease users balance on rebase after decreased Vault value", async () => {
    const { vault, matt, ousd, josh } = await loadFixture(mockVaultFixture);
    // Total OUSD supply is 200, mock a decrease
    await vault.setTotalValue(utils.parseUnits("180", 18));
    await vault.rebase();
    await expect(matt).has.an.approxBalanceOf("100.00", ousd);
    await expect(josh).has.an.approxBalanceOf("100.00", ousd);
  });

  it.only("should not tranfer more than expected", async () => {
    let { ousd, vault, matt, josh, anna, dai } = await loadFixture(
      defaultFixture
    );

    let i = 0;
    const logBalance = async () => {
      console.log("----", i++);
      for (const user of [josh, matt, anna]) {
        console.log(
          utils.formatUnits(await ousd.balanceOf(await user.getAddress()), 18)
        );
      }
      console.log("----", i);
      console.log("Vault total value", Number(await vault.totalValue()));
      console.log(
        "Vault dai balance",
        Number(await dai.balanceOf(vault.address))
      );
    };

    for (const user of [josh, matt]) {
      // Clear the existing balances
      await vault.connect(user).redeemAll();
    }

    const tokens = BigNumber.from(
      "333333333333333333333333333333333333333333333333333333"
    );
    for (const user of [josh, matt, anna]) {
      await dai.connect(user).mint(tokens);
      await dai.connect(user).approve(vault.address, tokens);
      await vault.connect(user).mint(dai.address, tokens);
    }

    await logBalance();

    await vault.rebase();

    await logBalance();

    // Add another 15 DAI to Vault without a mint to simulate a changeSupply(15)
    await dai.connect(josh).transfer(vault.address, daiUnits("15"));
    await vault.rebase();

    await logBalance();

    const secondMint = daiUnits("16");
    await dai.connect(josh).mint(secondMint);
    await dai.connect(josh).approve(vault.address, secondMint);
    await vault.connect(josh).mint(dai.address, secondMint);

    const joshTotal = tokens.add(secondMint);
    console.log("Josh estimated total", Number(joshTotal));

    await logBalance();

    // console.log('Minting 16 tokens...')
    // await tusd.connect(anna).mint(16)
    // await tusd.connect(anna).approve(vault.address, 16);
    // await vault.connect(anna).mint(tusd.address, 16);

    // await logBalance()

    // console.log('Transferring more than that...')
    // expect(
    //   ousd
    //     .connect(anna)
    //     .transfer(await matt.getAddress(), '333333333333333333333333333333333350333333333333333333')
    // ).to.be.revertedWith("Transfer amount exceeds balance")
  });
});
