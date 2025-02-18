import axios from "axios";
import { Config } from "./config.js";
import { baseHeader } from "./core.js";
import chalk from "chalk";
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const checkAgents = async (bearer, id, accountIndex, agent) => {
  try {
    const getAiagent = await axios.get(`${Config.BASE_URL_API}/api3/agents/user/${id}`, {
      headers: { ...baseHeader, Authorization: `Bearer ${bearer}` },
      httpsAgent: agent,
    });

    let aiagents = getAiagent.data.filter((ai) => ai.active);
    if (getAiagent.data.length == 1) {
      console.log(`[Account ${accountIndex}] ${chalk.yellow(`User ${id}: You should create one more agent to optimize the fractal you earn.`)}`);
    }
    if (aiagents.length <= 0) {
      console.log(`[Account ${accountIndex}] ${chalk.yellow(`No agents found for user ${id}`)}`);
      return {
        isAutoMarking: false,
        agents: [],
      };
    }
    const aiagentsAuto = aiagents.filter((ai) => ai.automationEnabled);
    if (aiagentsAuto.length == 2 || aiagentsAuto.length == aiagents.length) {
      // console.log(chalk.yellow(`Limited 2 agents each user can battle at the same time!`));
      return {
        isAutoMarking: true,
        agents: aiagentsAuto,
      };
    }

    let aiagentsAvaliable = aiagents.filter((ai) => !ai.automationEnabled);
    aiagentsAvaliable = aiagentsAuto.length === 1 ? aiagents.slice(0, 1) : aiagents.slice(0, 2);
    return {
      isAutoMarking: false,
      agents: aiagentsAvaliable,
    };
  } catch (error) {
    return {
      isAutoMarking: false,
      agents: [],
    };
  }
};

const enableSession = async (bearer, id, accountIndex, agent) => {
  try {
    const nonce = await getNonce(agent);
    const payload = {
      agentId: id,
      sessionTypeId: 1,
      maxGames: Config.MAX_GAME,
      stopLoss: 0.5,
      takeProfit: 0.1,
      feeTier: Config.ENTRYFEE,
      maxParallelGames: 10,
      nonce: nonce,
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

const disableSession = async (bearer, id, agent) => {
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
    const message = res.message.includes("successfully") ? chalk.green(res.message) : chalk.yellow(res.message);
    console.log(message);
  } catch (error) {
    console.log(chalk.red(error.message));
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
      captchaText: await solveCaptcha(image, agent),
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

const solveCaptcha = async (CAPTCHA_IMAGE_URL, agent) => {
  try {
    // Step 1: Create a task to solve the captcha
    const { data: taskResponse } = await axios.post(
      "https://api.anti-captcha.com/createTask",
      {
        clientKey: Config.API_KEY_ANTI_CAPTCHA,
        task: {
          type: "ImageToTextTask",
          body: CAPTCHA_IMAGE_URL,
        },
      },
      {
        httpsAgent: agent,
      }
    );
    const taskId = taskResponse.taskId;
    // Step 2: Check the task result
    let solution;
    let retries = 5;
    while (!solution && retries > 0) {
      retries--;
      const { data: resultResponse } = await axios.post(
        "https://api.anti-captcha.com/getTaskResult",
        {
          clientKey: Config.API_KEY_ANTI_CAPTCHA,
          taskId: taskId,
        },
        {
          httpsAgent: agent,
        }
      );

      if (resultResponse.status === "ready") {
        solution = resultResponse.solution.text;
        console.log("Captcha solved:", solution);
        return solution;
      } else {
        console.log("Waiting for captcha to be solved...");
        await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds before checking again
      }
    }
    if (!solution && retries == 0) {
      throw new Error("Failed to solve captcha after 5 attempts.");
    }
  } catch (error) {
    console.error("Error solving captcha:", error);
  }
};

export { createAgent, checkAgents, disableSession, enableSession };
