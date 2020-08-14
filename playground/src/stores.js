import { writable } from "svelte/store";
import ethers from "ethers";
import network from "../../dapp/network.json";
import _ from "underscore";

const RPC_URL = "http://127.0.0.1:8545/";

const PEOPLE = [
  { name: "Matt", icon: "👨‍🚀", id: 0, holdings: { USDT: 9000 } },
  { name: "Sofi", icon: "👸", id: 1, holdings: { USDT: 2000 } },
  { name: "Raul", icon: "👨‍🎨", id: 2, holdings: { USDT: 1000 } },
  { name: "Suparman", icon: "👨🏾‍🎤", id: 3, holdings: { USDT: 1500 } },
  { name: "Anna", icon: "🧝🏻‍♀️", id: 4, holdings: { USDT: 600 } },
  { name: "Pyotr", icon: "👨🏻‍⚖️", id: 5, holdings: { USDT: 4000, PZI: 100 } },
];

const CONTRACTS = [
  {
    name: "OUSD",
    icon: "🖲",
    isERC20: true,
    decimal: 18,
    holdings: {},
    actions: [
      {
        name: "Transfer",
        params: [{ name: "To" }, { name: "Amount", token: "OUSD" }],
      },
      {
        name: "Approve",
        params: [{ name: "To" }, { name: "Amount", token: "OUSD" }],
      },
    ],
  },
  {
    name: "Vault",
    icon: "🏦",
    actions: [
      {
        name: "depositAndMint",
        params: [{ name: "Token" }, { name: "Amount" }],
      },
      {
        name: "depositYield",
        params: [{ name: "Token" }, { name: "Amount" }],
      },
    ],
  },
  {
    name: "USDT",
    icon: "💵",
    isERC20: true,
    decimal: 6,
    actions: [
      {
        name: "Transfer",
        params: [{ name: "To" }, { name: "Amount", token: "USDT" }],
      },
      {
        name: "Approve",
        params: [{ name: "To" }, { name: "Amount", token: "USDT" }],
      },
      { name: "Mint", params: [{ name: "Amount", token: "USDT" }] },
    ],
    contractName: "MockUSDT",
  },
  {
    name: "DAI",
    icon: "📕",
    isERC20: true,
    decimal: 18,
    actions: [
      { name: "Transfer" },
      { name: "Approve" },
      { name: "Mint", params: [{ name: "Amount in USDT" }] },
    ],
    contractName: "MockDAI",
  },
];

// Accounts have holdings
// Contracts are accounts
// Contracts have actions that users can call on them
// ERC20's are Contracts
// An ERC20 can be held
// Users are accounts

class Account {
  constructor({ name, icon }) {
    this.name = name;
    this.icon = icon;
    this.address = "";
    // Holdings is {OGN: writeable(0)}
    this.holdings = _.object(
      CONTRACTS.filter((x)=>x.isERC20).map((x)=>[x.name, writable(0)])
    )
  }
}

class User extends Account {
  constructor({ name, icon }) {
    super({ name, icon });
  }
}

class Contract extends Account {
  constructor({ name, icon, actions, contractName }) {
    super({ name, icon });
    this.actions = actions;
    this.contractName = contractName || this.name;
  }
}

class ERC20 extends Contract {
  constructor({ name, icon, actions, contractName }) {
    super({ name, icon, actions, contractName });
    this.isERC20 = true;
  }
}

// Setup people

const PEOPLE_OBJECTS = _.map(PEOPLE, (x) => new User(x));
const PEOPLE_BY_NAME = _.object(_.map(PEOPLE_OBJECTS, (x) => [x.name, x]));
const CONTRACT_OBJECTS = _.map(CONTRACTS, (x) =>
  x.isERC20 ? new ERC20(x) : new Contract(x)
);
const CONTRACT_BY_NAME = _.object(_.map(CONTRACT_OBJECTS, (x) => [x.name, x]));

export let people = writable(PEOPLE_OBJECTS);
export let contracts = writable(CONTRACT_OBJECTS);

export let activePopupMenu = writable();
export let activePerson = writable();

function updateAll() {
  people.update((old) => old);
  contracts.update((old) => old);
}

let blockRun = function () {};

export async function handleTx(contract, person, action, args) {
  console.log("H>", contract.name, person.name, action.name, args);
  await blockRun([person.name, contract.name, action.name, ...args]);
  await updateAllHoldings();
}

export let mattHolding = writable(0);
window.mattHolding = mattHolding;

// Ether stuff
const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
(async function () {
  const accounts = await provider.listAccounts();
  const signer = await provider.getSigner(accounts[0]);
  const chainContracts = {};
  for (const key in network.contracts) {
    chainContracts[key] = new ethers.Contract(
      network.contracts[key].address,
      network.contracts[key].abi,
      signer
    );
  }
  window.chainContracts = chainContracts;
  const { MockUSDT, MockDAI, MockTUSD, MockUSDC, OUSD, Vault } = chainContracts;

  blockRun = async function (params) {
    console.log("ℨ", params);
    const user = PEOPLE_BY_NAME[params[0]];
    if (user == undefined) {
      console.error(`Run could not lookup user ${params[0]}`);
    }
    if (user.signer == undefined) {
      console.error(`Run could not find signer for user ${params[0]}`);
    }
    const contract = CONTRACT_BY_NAME[params[1]];
    if (contract == undefined) {
      console.error(`Run could not lookup contract ${params[1]}`);
    }
    if (contract.contract == undefined) {
      console.error(`Run could not find backing contract for ${params[1]}`);
    }
    const method = params[2][0].toLowerCase() + params[2].slice(1);
    const args = params.slice(3);
    for (const i in args) {
      const v = args[i];
      const amountTokens = /^([0-9.]+)([A-Z]+)$/.exec(v);
      if (amountTokens) {
        const amount = amountTokens[1];
        const token = amountTokens[2];
        const decimals = CONTRACT_BY_NAME[token].decimal;
        args[i] = ethers.utils.parseUnits(amount, decimals);
        continue;
      }
      if (/^[A-Za-z]+$/.exec(v)) {
        if (PEOPLE_BY_NAME[v]) {
          args[i] = await PEOPLE_BY_NAME[v].signer.getAddress();
          continue;
        }
        if (CONTRACT_BY_NAME[v]) {
          args[i] = await CONTRACT_BY_NAME[v].contract.address;
          continue;
        }
        console.error(`Run could not find account for ${v}`);
      }
    }
    console.log("🔭", user.name, contract.name, method, args);
    console.log(method);
    await contract.contract.connect(user.signer)[method](...args);
  };

  await MockUSDT.mint(ethers.utils.parseUnits("1", 6));
  // console.log(await MockUSDT.balanceOf(signer.getAddress()))
  // console.log(contracts)
  for (const contract of CONTRACT_OBJECTS) {
    // console.log("☞",contract)
    if (contract.contractName) {
      contract.contract = chainContracts[contract.contractName];
      contract.address = contract.contract.address
      console.log(
        `BACKING ${contract.name}, looking for ${contract.contractName}`,
        contract.contract
      );
      if (contract.contract == undefined) {
        console.log(
          `Error, failed to back ${contract.name} with ${contract.contractName}`
        );
      }
    }
  }

  console.log(accounts)
  for (var i in PEOPLE_OBJECTS) {
    const account = accounts[i]
    PEOPLE_OBJECTS[i].signer = await provider.getSigner(account);
    PEOPLE_OBJECTS[i].address = await PEOPLE_OBJECTS[i].signer.getAddress()
  }

  // Setup
  const setup = `
    Matt USDT mint 100USDT
    Matt DAI mint 100DAI
    Matt DAI approve Vault 50DAI
    Matt Vault depositAndMint DAI 50DAI
  `;
  console.log(setup);
  for (const line of setup.split("\n")) {
    if (line.trim() == "") {
      continue;
    }
    await blockRun(line.trim().split(" "));
  }
  await updateAllHoldings()
  
})();


async function updateHolding(user, contractName){
  const contract = CONTRACT_BY_NAME[contractName]
  const rawBalance = await contract.contract.balanceOf(user.address)
  const balance = ethers.utils.formatUnits(rawBalance, contract.decimals)
  console.log("⁍", contractName, user.name, balance, user.address)
  user.holdings[contractName].set(balance)
}

async function updateAllHoldings(){
  let updates = []
  const Erc20Tokens = CONTRACT_OBJECTS.filter((x)=>x.isERC20)
  for(const user of PEOPLE_OBJECTS){
    for(const coin of Erc20Tokens){
      updates.push(updateHolding(user, coin.name))
    }
  }
  for(const contract of CONTRACT_OBJECTS){
    for(const coin of Erc20Tokens){
      updates.push(updateHolding(contract, coin.name))
    }
  }
  await Promise.all(updates)
}