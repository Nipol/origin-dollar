const ethers = require("ethers");
const addresses = require("./utils/addresses");

usePlugin("@nomiclabs/buidler-waffle");
usePlugin("@nomiclabs/buidler-solhint");
usePlugin("buidler-deploy");
usePlugin("buidler-ethers-v5");
usePlugin("solidity-coverage");
usePlugin("buidler-gas-reporter");

const fork =
  "https://eth-mainnet.alchemyapi.io/v2/cweL7vuMCrHRZhi4rO227veLANNkWBEo";

const mnemonic =
  "replace hover unaware super where filter stone fine garlic address matrix basic";

const privateKeys = [];

let derivePath = "m/44'/60'/0'/0/";
for (let i = 0; i <= 10; i++) {
  const wallet = new ethers.Wallet.fromMnemonic(mnemonic, `${derivePath}${i}`);
  privateKeys.push(wallet.privateKey);
}


task("mainnet_env_vars", "Check env vars are properly set for a Mainnet deployment", async (taskArguments, bre) => {
  const envVars = ["PROVIDER_URL", "DEPLOYER_PK"];
  for (const envVar of envVars) {
    if (!process.env[envVar]) {
      throw new Error(`For Mainnet deploy env var ${envVar} must be defined.`)
    }
  }
  console.log('All good. Deploy away!')
});

task("accounts", "Prints the list of accounts", async (taskArguments, bre) => {
  const accounts = await bre.ethers.getSigners();
  const roles = ["Deployer", "Proxy Admin", "Governor"];

  const isMainnetOrRinkeby = ["mainnet", "rinkeby"].includes(bre.network.name)

  let i = 0;
  for (const account of accounts) {
    const role = roles.length > i ? `[${roles[i]}]` : "";
    const address = await account.getAddress()
    const pk = isMainnetOrRinkeby ? process.env.DEPLOYER_PK : privateKeys[i]
    console.log(address, pk, role);
    if (!address) {
      throw new Error(`No address defined for role ${role}`)
    }
    i++;
  }
});

// Convert mnemonic into private keys for buidlerevm network config
module.exports = {
  solc: {
    version: "0.5.11",
  },
  networks: {
    mainnet: {
      // Using placeholder values since Buidler does not permit undefined value
      // even if the network is not actively being used.
      url: process.env.PROVIDER_URL || "https://placeholder",
      accounts: [
        process.env.DEPLOYER_PK || "placeholderPk",
        process.env.DEPLOYER_PK || "placeholderPk", // Proxy admin. On Mainnet, use same account as deployer.
        process.env.DEPLOYER_PK || "placeholderPk", // Governor. On Mainnet, use same account as deployer.
      ]
    },
    rinkeby: {
      url: process.env.PROVIDER_URL || "https://placeholder",
      accounts: [
        process.env.DEPLOYER_PK || "placeholderPk",
        process.env.DEPLOYER_PK || "placeholderPk", // Proxy admin. On Rinkeby, use same account as deployer.
        process.env.DEPLOYER_PK || "placeholderPk", // Governor. On Rinkeby, use same account as deployer.
      ]
    },
    buidlerevm: {
      allowUnlimitedContractSize: true,
      chainId: 31337,
      accounts: privateKeys.map((privateKey) => {
        return {
          privateKey,
          balance: "10000000000000000000000",
        };
      }),
    },
    ganache: {
      url: "http://localhost:7546",
      fork: process.env.FORK ? fork : null,
      mnemonic,
      unlocked_accounts: process.env.FORK ? [] : [addresses.mainnet.Binance],
      chainId: 1337,
      // logger: console,
      // verbose: true,
    },
    coverage: {
      url: "http://localhost:8555",
    },
  },
  mocha: {
    // bail: true,
  },
  throwOnTransactionFailures: true,
  namedAccounts: {
    deployerAddr: {
      // On all networks, use as deployer account the first account specified
      // in the "networks" section of the config above.
      default: 0,
    },
    proxyAdminAddr: {
      default: 1,
    },
    governorAddr: {
      default: 2,
    },
  },
  gasReporter: {
    currency: 'USD',
    // outputFile: 'gasreport.out',
    enabled: Boolean(process.env.GAS_REPORT)
  }
};
