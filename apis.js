import axios from "axios";
import { Config } from "./config.js";
import { baseHeader } from "./core.js";
import chalk from "chalk";
import { EventEmitter } from "events";
import { solve2Captcha, solveAntiCaptcha } from "./captchaApi.js";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
EventEmitter.defaultMaxListeners = 20;

const solveCaptcha = async (image, accountIndex, agent) => {
  if (Config.TYPE_CAPTCHA == "2captcha") {
    return await solve2Captcha(image, accountIndex, agent);
  } else if (Config.TYPE_CAPTCHA == "anticaptcha") {
    return await solveAntiCaptcha(image, accountIndex, agent);
  } else {
    throw new Error(`Type captcha invalid: 2captcha or anticaptcha`);
  }
};

const matchmaking = async (data, getlogin, accountIndex, agent) => {
  const { id } = data;
  try {
    const resGetNonce = await getNonce(agent);
    const captchaText = await solveCaptcha(resGetNonce.image, accountIndex, agent);
    if (!captchaText) {
      return {
        error: "Can't resolve captcha!",
      };
    }
    const joinSpace = await axios.post(
      `${Config.BASE_URL_API}/api3/matchmaking/initiate`,
      { userId: getlogin.user.id, agentId: id, entryFees: Config.ENTRYFEE, sessionTypeId: 1, nonce: resGetNonce.nonce, captchaText },
      {
        headers: {
          ...baseHeader,
          Authorization: `Bearer ${getlogin.accessToken}`,
          "Content-Type": "application/json",
        },
        httpsAgent: agent,
      }
    );
    return joinSpace;
  } catch (error) {
    return error.response?.data;
  }
};

const getUserInfo = async (id, getlogin, accountIndex, agent) => {
  try {
    const result = await axios.get(`${Config.BASE_URL_API}/api3/rewards/fractal/user/${id}`, {
      headers: {
        ...baseHeader,
        Authorization: `Bearer ${getlogin.accessToken}`,
        "Content-Type": "application/json",
      },
      httpsAgent: agent,
    });
    return result;
  } catch (error) {
    return error.response?.data;
  }
};

const getSessions = async (getlogin, accountIndex, agent) => {
  console.log(chalk.blue(`[Accoutn ${accountIndex}] Watting 30s for get sessions...`));
  await delay(30000);
  try {
    const getSessions = await axios.get(`${Config.BASE_URL_API}/api3/session-types/live-paginated/user/${getlogin.user.id}?pageSize=10&pageNumber=1&status=live`, {
      headers: { ...baseHeader, Accept: "application/json" },
      httpsAgent: agent,
    });
    const sessions = getSessions.data;
    return sessions.sessions.sessions;
  } catch (error) {
    return error.message;
  }
};

const checkAgents = async (bearer, id, accountIndex, agent) => {
  try {
    const getAiagent = await axios.get(`${Config.BASE_URL_API}/api3/agents/user/${id}`, {
      headers: { ...baseHeader, Authorization: `Bearer ${bearer}` },
      httpsAgent: agent,
    });

    let aiagents = getAiagent.data.filter((ai) => ai.active);
    let aiagentsAuto = [];
    let aiagentsManu = [];

    if (getAiagent.data.length == 1) {
      console.log(`[Account ${accountIndex}] ${chalk.yellow(`User ${id}: You should create one more agent to optimize the fractal you earn.`)}`);
    }
    if (aiagents.length <= 0) {
      console.log(`[Account ${accountIndex}] ${chalk.yellow(`No agents found for user ${id}`)}`);
      return {
        agentsAuto: [],
        agentsManu: [],
      };
    }

    for (const agent of aiagents) {
      if (agent.automationEnabled) {
        aiagentsAuto.push(agent);
      } else {
        aiagentsManu.push(agent);
      }
    }

    // if (aiagentsAuto.length == 2 || aiagentsAuto.length == aiagents.length) {
    //   // console.log(chalk.yellow(`Limited 2 agents each user can battle at the same time!`));
    //   return {
    //     isAutoMarking: true,
    //     agentsAuto: aiagentsAuto,
    //   };
    // }
    // let aiagentsAvaliable = aiagents.filter((ai) => !ai.automationEnabled);
    // aiagentsAvaliable = aiagentsAuto.length === 1 ? aiagents.slice(0, 1) : aiagents.slice(0, 2);
    return {
      agentsAuto: aiagentsAuto,
      agentsManu: aiagentsManu,
    };
  } catch (error) {
    return {
      agentsAuto: [],
      agentsManu: [],
    };
  }
};

const enableSession = async (bearer, id, accountIndex, agent) => {
  try {
    const resGetNonce = await getNonce(agent);
    const captchaText = await solveCaptcha(resGetNonce.image, accountIndex, agent);
    if (!captchaText) {
      console.log(chalk.yellow(`Can resolve captcha!`));
      return;
    }
    const payload = {
      agentId: id,
      sessionTypeId: 1,
      maxGames: Config.MAX_GAME,
      stopLoss: 0.5,
      takeProfit: 0.1,
      feeTier: Config.ENTRYFEE,
      maxParallelGames: 10,
      nonce: resGetNonce.nonce,
      captchaText: captchaText,
    };
    const result = await axios.post(`${Config.BASE_URL_API}/api3/automated-matchmaking/enable`, payload, {
      headers: { ...baseHeader, Authorization: `Bearer ${bearer}` },
      httpsAgent: agent,
    });

    const res = result.data;
    const message = `[Account ${accountIndex}] ${res.message.includes("successfully") ? chalk.green(res.message) : chalk.yellow(res.message)}`;
    console.log(message);
  } catch (error) {
    console.log(`[Account ${accountIndex}] ${chalk.red(error.message)}`);
  }
};

const disableSession = async (bearer, id, accountIndex, agent) => {
  try {
    const result = await axios.post(
      `${Config.BASE_URL_API}/api3/automated-matchmaking/disable/${id}`,
      {},
      {
        headers: { ...baseHeader, Authorization: `Bearer ${bearer}` },
        httpsAgent: agent,
      }
    );

    const res = result.data;
    const message = `[Account ${accountIndex}] ${res.message.includes("successfully") ? chalk.green(res.message) : chalk.yellow(res.message)}`;
    console.log(message);
  } catch (error) {
    console.log(`[Account ${accountIndex}] ${chalk.red(error.message)}`);
  }
};

const getNonce = async (agent) => {
  try {
    const result = await axios.get(`${Config.BASE_URL_API}/api3/auth/nonce`, {
      headers: { ...baseHeader },
      httpsAgent: agent,
    });
    return result.data;
  } catch (error) {
    return error.message;
  }
};

const getAvatar = async (userId, agent) => {
  try {
    const result = await axios.post(
      `${Config.BASE_URL_API}/api3/agents/generate/avatar`,
      {
        battleType: "rap",
        userId: userId,
      },
      {
        headers: { ...baseHeader },
        httpsAgent: agent,
      }
    );
    return result.data.avatarUrl;
  } catch (error) {
    return error.message;
  }
};

const generateName = async (agent) => {
  try {
    const result = await axios.post(
      `${Config.BASE_URL_API}/api3/agents/generate/name`,
      { battleType: "rap" },
      {
        headers: { ...baseHeader },
        httpsAgent: agent,
      }
    );
    return result.data.name;
  } catch (error) {
    return error.message;
  }
};

const generateContent = async (agent) => {
  try {
    const result = await axios.post(
      `${Config.BASE_URL_API}/api3/agents/generate/prompt`,
      { battleType: "rap" },
      {
        headers: { ...baseHeader },
        httpsAgent: agent,
      }
    );
    return result.data.prompt;
  } catch (error) {
    return error.message;
  }
};

const createAgent = async (userId, agent) => {
  try {
    const { nonce, image } = await getNonce(agent);
    const payload = {
      name: await generateName(agent),
      userId: userId,
      battleType: "rap",
      sessionTypeId: 1,
      systemPrompt: await generateContent(agent),
      avatarLink: await getAvatar(userId, agent),
      nonce: nonce,
      captchaText: await solveCaptcha(image, accountIndex, agent),
    };

    const result = await axios.post(`${Config.BASE_URL_API}/api3/agents/create`, payload, {
      headers: { ...baseHeader },
      httpsAgent: agent,
    });
    return result.data;
  } catch (error) {
    return error.message;
  }
};

//=========== handle captcha==========

const fetchWithRetry = async (url, options, retries = 3) => {
  if (!url || typeof url !== "string") {
    throw new Error("URL tidak valid atau undefined.");
  }

  for (let i = 0; i < retries; i++) {
    try {
      return await axios.get(url, options);
    } catch (error) {
      console.log(`⚠️ Retry ${i + 1}/${retries} - Error: ${error.message}`);
      await delay(5000);
    }
  }
  throw new Error("Failed to get response after several attempts.");
};

export { createAgent, checkAgents, disableSession, enableSession, matchmaking, getSessions, getUserInfo };
