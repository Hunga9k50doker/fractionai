import axios from "axios";
import chalk from "chalk";
import { Config } from "./config.js";

const solve2Captcha = async (CAPTCHA_IMAGE_URL, accountIndex, agent) => {
  try {
    // Step 1: Download the image and convert it to base64
    const { data: imageResponse } = await axios.get(CAPTCHA_IMAGE_URL, { responseType: "arraybuffer" });
    const base64Image = Buffer.from(imageResponse, "binary").toString("base64");

    // Step 2: Create a task to solve the captcha
    const { data: taskResponse } = await axios.post(
      "http://2captcha.com/in.php",
      {
        key: Config.API_KEY_2CAPTCHA,
        method: "base64",
        body: base64Image,
        json: 1,
      },
      {
        httpsAgent: agent,
      }
    );

    if (taskResponse.status !== 1) {
      console.log(chalk.yellow(`[Account ${accountIndex}] Cannot get captcha task ID!`));
      return;
    }

    const taskId = taskResponse.request;

    // Step 3: Check the task result
    let solution;
    let retries = 0;
    while (!solution && retries < Config.RETIES_CAPTCHA) {
      retries++;
      await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds before checking again

      const { data: resultResponse } = await axios.get(`http://2captcha.com/res.php?key=${Config.API_KEY_2CAPTCHA}&action=get&id=${taskId}&json=1`);

      if (resultResponse.status === 1) {
        solution = resultResponse.request;
        console.log(chalk.green(`[Account ${accountIndex}] Captcha solved:`), solution);
        return solution;
      } else {
        console.log(chalk.yellow(`[Account ${accountIndex}] Waiting for 2captcha to be solved ${retries}/${Config.RETIES_CAPTCHA}...`));
      }
    }

    if (!solution && retries === Config.RETIES_CAPTCHA) {
      console.log(chalk.yellow(`[Account ${accountIndex}]  Failed to solve captcha after 5 attempts.`));
      return null;
    }
  } catch (error) {
    console.error(`[Account ${accountIndex}]`, error.message);
    return null;
  }
};

const solveAntiCaptcha = async (CAPTCHA_IMAGE_URL, accountIndex, agent) => {
  try {
    // Step 1: Download the image and convert it to base64
    const { data: imageResponse } = await axios.get(CAPTCHA_IMAGE_URL, { responseType: "arraybuffer" });
    const base64Image = Buffer.from(imageResponse, "binary").toString("base64");

    // Step 2: Create a task to solve the captcha
    const { data: taskResponse } = await axios.post(
      "https://api.anti-captcha.com/createTask",
      {
        clientKey: Config.API_KEY_ANTI_CAPTCHA,
        task: {
          type: "ImageToTextTask",
          body: base64Image, // Sử dụng base64 image ở đây
        },
      },
      {
        httpsAgent: agent,
      }
    );

    const taskId = taskResponse.taskId;
    if (!taskId) {
      console.log(chalk.yellow(`Cannot get captcha data!`));
      return;
    }

    // Step 3: Check the task result
    let solution;
    let retries = 0;
    while (!solution && retries < Config.RETIES_CAPTCHA) {
      retries++;
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
        console.log(chalk.green(`[Account ${accountIndex}] Captcha solved: ${solution}`));
        return solution;
      } else {
        console.log(chalk.yellow(`[Account ${accountIndex}] Waiting for anticaptcha to be solved ${retries}/${Config.RETIES_CAPTCHA}...`));
        await new Promise((resolve) => setTimeout(resolve, 10000)); // Wait 5 seconds before checking again
      }
    }

    if (!solution && retries === Config.RETIES_CAPTCHA) {
      console.log(chalk.yellow(`[Account ${accountIndex}] Failed to solve captcha after 5 attempts.`));
      return null;
    }
  } catch (error) {
    console.error(`[Account ${accountIndex}]`, error.message);
    return null;
  }
};

export { solve2Captcha, solveAntiCaptcha };
