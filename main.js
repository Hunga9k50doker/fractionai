import axios from "axios";
import chalk from "chalk";
import Web3 from "web3";
import fs from "fs/promises";
import { Config } from "./config.js";
import { checkAgents, createAgent, enableSession } from "./apis.js";
import { Worker, isMainThread, parentPort, workerData } from "worker_threads";
import { fileURLToPath } from "url"; // Import necessary functions for file URL conversion
import { dirname } from "path"; // Import necessary functions for path manipulation
const __filename = fileURLToPath(import.meta.url); // Get the current module's filename
const __dirname = dirname(__filename);
import { HttpsProxyAgent } from "https-proxy-agent";
import { baseHeader } from "./core.js";

const displayBanner = () => {
  const hakari = chalk.yellow("Tool được phát triển bởi nhóm tele Airdrop Hunter Siêu Tốc (https://t.me/airdrophuntersieutoc)");
  console.log(hakari);
};
const delay = (second) => new Promise((resolve) => setTimeout(resolve, second * 1000));

const newAgent = (proxy = null) => {
  if (proxy) {
    if (proxy.startsWith("http://")) {
      return new HttpsProxyAgent(proxy);
    } else if (proxy.startsWith("socks4://") || proxy.startsWith("socks5://")) {
      return new SocksProxyAgent(proxy);
    } else {
      console.log(chalk.yellow(`Unsupported proxy type: ${proxy}`));
      return null;
    }
  }
  return null;
};

async function readFile(pathFile) {
  try {
    const datas = await fs.readFile(pathFile, "utf8");
    return datas
      .split("\n")
      .map((data) => data.trim())
      .filter((data) => data.length > 0);
  } catch (error) {
    console.error(`Error reading file: ${error.message}`);
    return [];
  }
}

class ClientAPI {
  constructor(accountIndex, wallet, proxy, authInfo) {
    this.accountIndex = accountIndex;
    this.authInfo = authInfo;
    this.wallet = wallet;
    this.proxy = proxy || null;
    this.proxyIp = "Unknown IP";
  }

  async checkProxyIP() {
    try {
      const proxyAgent = new HttpsProxyAgent(this.proxy);
      const response = await axios.get("https://api.ipify.org?format=json", { httpsAgent: proxyAgent });
      if (response.status === 200) {
        this.proxyIP = response.data.ip;
        return response.data.ip;
      } else {
        throw new Error(`Cannot check proxy IP. Status code: ${response.status}`);
      }
    } catch (error) {
      throw new Error(`Error checking proxy IP: ${error.message}`);
    }
  }

  login = async (privateKey) => {
    try {
      const web3 = new Web3(new Web3.providers.HttpProvider("https://sepolia.drpc.org/"));
      const account = web3.eth.accounts.privateKeyToAccount(privateKey);
      web3.eth.accounts.wallet.add(account);

      const getNonce = await axios.get(`${Config.BASE_URL_API}/api3/auth/nonce`, {
        headers: baseHeader,
      });
      const nonce = getNonce.data.nonce;

      const issuedAt = new Date().toISOString();
      const message = `dapp.fractionai.xyz wants you to sign in with your Ethereum account:
${account.address}

Sign in with your wallet to Fraction AI.

URI: https://dapp.fractionai.xyz
Version: 1
Chain ID: 11155111
Nonce: ${nonce}
Issued At: ${issuedAt}`;

      const signature = web3.eth.accounts.sign(message, privateKey);
      const payload = {
        message,
        signature: signature.signature,
        referralCode: "BB03C69E",
      };

      const loginData = await axios.post(`${Config.BASE_URL_API}/api3/auth/verify`, payload, {
        headers: {
          ...baseHeader,
          "Content-Type": "application/json",
        },
        httpsAgent: newAgent(this.proxy),
      });
      return loginData.data;
    } catch (error) {
      console.log(error.message);
    }
  };

  sendTransaction = async (privateKey, signature) => {
    const web3 = new Web3(new Web3.providers.HttpProvider("https://sepolia.drpc.org/"));
    const account = web3.eth.accounts.privateKeyToAccount(privateKey);
    web3.eth.accounts.wallet.add(account);

    const tx = {
      from: account.address,
      to: "0x890FD716Cf80B5f9D3CdA34Fc6b1C67CBb2d35c3",
      value: web3.utils.toWei(`${Config.ETH_EARCH_AGENT}`, "ether"), // Amount in Ether
      gas: 2000000, // Set a gas limit
      nonce: await web3.eth.getTransactionCount(account.address, "latest"),
    };

    try {
      // Sign the transaction
      // const signedTx = await web3.eth.accounts.signTransaction(tx, privateKey);

      // Send the transaction
      const receipt = await web3.eth.sendSignedTransaction(signature);

      console.log("Transaction successful with hash:", receipt.transactionHash);
      return receipt.transactionHash; // Return the transaction hash
    } catch (error) {
      console.error("Error sending transaction:", error.message);
    }
  };

  createAgentRpc = async (privateKey) => {
    const agent = newAgent(this.proxy);

    const web3 = new Web3(new Web3.providers.HttpProvider("https://sepolia.drpc.org/"));
    const account = web3.eth.accounts.privateKeyToAccount(privateKey);
    web3.eth.accounts.wallet.add(account);

    const balance = await this.checkBalance(account.address);
    console.log(`Balance of ${account.address}: ${balance} ETH`);

    const transaction = {
      from: account.address,
      to: "0x890FD716Cf80B5f9D3CdA34Fc6b1C67CBb2d35c3", // Replace with the target address for the transaction
      value: web3.utils.toWei(`${Config.ETH_EARCH_AGENT}`, "ether"), // The amount you want to send
      // Add other necessary fields such as gasLimit, nonce, etc.
    };
    const gasEstimate = await this.estimateGas(transaction);
    console.log(`Estimated gas: ${gasEstimate}`);

    // Ensure balance is sufficient
    const gasPrice = await web3.eth.getGasPrice();
    const totalCost = gasPrice * gasEstimate;

    if (parseFloat(balance) < totalCost) {
      console.log("Insufficient funds to cover gas fees. Please fund your wallet.");
      return;
    }

    const user = this.authInfo.user;
    console.log(user);
    const resultCreateAgent = await createAgent(user.id, agent);
    if (resultCreateAgent?.signature) {
      //  const transaction = {
      //    from: account.address,
      //    to: "0x890FD716Cf80B5f9D3CdA34Fc6b1C67CBb2d35c3", // Replace with the target address for the transaction
      //    value: web3.utils.toWei(Config.ETH_EARCH_AGENT.toString(), "ether"), // The amount you want to send
      //    // Add other necessary fields such as gasLimit, nonce, etc.
      //  };
      console.log(resultCreateAgent);
      const { signature } = resultCreateAgent;
      const issuedAt = new Date().toISOString();
      //         const message = `dapp.fractionai.xyz wants you to sign in with your Ethereum account:
      // ${account.address}

      // Sign in with your wallet to Fraction AI.

      // URI: https://dapp.fractionai.xyz
      // Version: 1
      // Chain ID: 11155111
      // Nonce: ${nonce}
      // Issued At: ${issuedAt}`;
      const resultSend = await this.sendTransaction(privateKey, signature);
      // console.log(resultSend);
      // process.exit(0);
      const payload = {
        message,
        signature: signature,
      };

      const result = await axios.post(`${Config.BASE_URL_API}/api3/agents/saveTxnHash`, payload, {
        headers: {
          ...baseHeader,
          "Content-Type": "application/json",
        },
        httpsAgent: newAgent(this.proxy),
      });

      return loginData.data;
      // console.log(chalk.green(`Success create agent with wallet: ${user.walletAddress} | Name: ${name}`));
      // console.log(`[Account ${this.accountIndex + 1}] Wating 5s to create next agent ${i + 1 / Config.MAX_AGENT}...`);
    } else {
    }
  };

  estimateGas = async (transaction) => {
    try {
      // Initialize Web3 with the dRPC Sepolia endpoint
      const web3 = new Web3(new Web3.providers.HttpProvider("https://sepolia.drpc.org/"));

      // Ensure the transaction object is valid
      if (!transaction.from || !transaction.to) {
        throw new Error('Transaction must include "from" and "to" addresses.');
      }

      // Estimate gas for the provided transaction
      const gasEstimate = await web3.eth.estimateGas(transaction);
      return gasEstimate;
    } catch (error) {
      // Log any errors that occur during gas estimation
      console.error("Error estimating gas:", error.message);
      return 1; // Return 1 as a fallback
    }
  };

  checkBalance = async (accountAddress) => {
    const web3 = new Web3(new Web3.providers.HttpProvider("https://sepolia.drpc.org/"));
    const balance = await web3.eth.getBalance(accountAddress);
    return web3.utils.fromWei(balance, "ether"); // convert balance from Wei to Ether
  };

  runAccount = async () => {
    try {
      if (this.proxy) {
        this.proxyIP = await this.checkProxyIP();
        if (!this.proxyIP) return console.log(chalk.yellow(`Can't check proxy ${this.proxy} for account ${this.accountIndex + 1}`));
      }
      const privateKey = this.wallet;
      const formattedPrivateKey = privateKey.startsWith("0x") ? privateKey : "0x" + privateKey;
      const getlogin = await this.login(formattedPrivateKey);
      if (!getlogin) return;
      this.authInfo = getlogin;
      const agent = newAgent(this.proxy);
      //   process.exit(0);

      // if (Config.AUTO_CREATE_AGENT) {
      //   for (let i = 0; i < Config.MAX_AGENT; i++) {
      //     await this.createAgentRpc(formattedPrivateKey);
      //   }
      // }
      const getAiagent = await checkAgents(getlogin.accessToken, getlogin.user.id, this.accountIndex + 1, agent);
      console.log(chalk.magenta(`[Account ${this.accountIndex + 1}] Wallet: ${getlogin.user.walletAddress} | Total Fractal Amount : ${getlogin.user.fractionalFractal}`));

      if (!getAiagent.isAutoMarking) {
        for (let j = 0; j < getAiagent.agents.length; j++) {
          console.log(chalk.blue(`[Account ${this.accountIndex + 1}] Starting auto marking for agent ${getAiagent.agents[j].name}...`));
          await enableSession(getlogin.accessToken, getAiagent.agents[j].id, this.accountIndex + 1, agent);
          await delay(2);
        }
      } else {
        for (let j = 0; j < getAiagent.agents.length; j++) {
          const agentAuto = getAiagent.agents[j];
          console.log(
            chalk.green(
              `[Account ${this.accountIndex + 1}][Auto Matching] Agent: ${agentAuto.name} | Level: ${agentAuto?.xpSummary?.xpSummary?.currentLevel}  | Sessions battle: ${
                agentAuto.stats.totalSessions
              }...`
            )
          );
          // await enableSession(getlogin.accessToken, getAiagent.agents[i].id, agent);
        }
      }
    } catch (error) {
      console.error(error.message);
    }
  };
}

async function runWorker(workerData) {
  const { wallet, accountIndex, proxy } = workerData;
  const to = new ClientAPI(accountIndex, wallet, proxy);
  try {
    await to.runAccount();
    parentPort.postMessage({
      accountIndex,
    });
  } catch (error) {
    parentPort.postMessage({ accountIndex, error: error.message });
  } finally {
    if (!isMainThread) {
      parentPort.postMessage("taskComplete");
    }
  }
}

async function main() {
  displayBanner();
  await delay(1);

  const proxies = await readFile("proxy.txt");
  let wallets = await readFile("privateKeys.txt");

  if (proxies.length === 0) console.log("No proxies found in proxy.txt - running without proxies");
  if (wallets.length === 0) {
    console.log('No Wallets found, creating new Wallets first "npm run autoref"');
    return;
  }

  let maxThreads = Config.MAX_THREADS;

  while (true) {
    let currentIndex = 0;
    const errors = [];

    while (currentIndex < wallets.length) {
      const workerPromises = [];
      const batchSize = Math.min(maxThreads, wallets.length - currentIndex);
      for (let i = 0; i < batchSize; i++) {
        const worker = new Worker(__filename, {
          workerData: {
            wallet: wallets[currentIndex],
            accountIndex: currentIndex,
            proxy: proxies[currentIndex % proxies.length],
          },
        });

        workerPromises.push(
          new Promise((resolve) => {
            worker.on("message", (message) => {
              if (message === "taskComplete") {
                worker.terminate();
              }
              resolve();
            });
            worker.on("error", (error) => {
              console.log(`Lỗi worker cho tài khoản ${currentIndex}: ${error.message}`);
              worker.terminate();
              resolve();
            });
            worker.on("exit", (code) => {
              worker.terminate();
              if (code !== 0) {
                errors.push(`Worker cho tài khoản ${currentIndex} thoát với mã: ${code}`);
              }
              resolve();
            });
          })
        );

        currentIndex++;
      }

      await Promise.all(workerPromises);

      if (errors.length > 0) {
        errors.length = 0;
      }

      if (currentIndex < wallets.length) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
    console.log(chalk.magenta(`[${new Date()}]Completed all account | Waiting ${Config.SLEEP_TIME} minutes to continue...`));
    await delay(Config.SLEEP_TIME * 60);
  }
}

if (isMainThread) {
  main().catch((error) => {
    console.log("Lỗi rồi:", error);
    process.exit(1);
  });
} else {
  runWorker(workerData);
}
