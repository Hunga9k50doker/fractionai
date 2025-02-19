export const Config = {
  BASE_URL_API: "https://dapp-backend-4x.fractionai.xyz",
  ENTRYFEE: 0.01, // valid value: 0.1, 0.01, 0.001
  MAX_THREADS: 100,
  SLEEP_TIME: 60, // minutes
  TYPE_CAPTCHA: "anticaptcha", // valid value: 2captcha, anticaptcha
  API_KEY_ANTI_CAPTCHA: "xxx", //api key of anti captcha: https://anti-captcha.com/
  API_KEY_2CAPTCHA: "xxx", //api key of 2captcha: https://2captcha.com/
  RETIES_CAPTCHA: 5, // number of retries

  //setup for auto matching
  AUTO_MAKING_BATTLE: false, // true: turn on auto battle rap , false: turn off auto battle rap (max 2 agents)
  MAX_GAME: 5, // maximum number of games for auto mode
  TURN_OFF_AUTO_MAKING_BATTLE: false, // true: turn off auto battle rap if have agents turning on auto making | false: don't care

  //Warning: key experiment, no change === key thử nghiệm, không thay đổi
  AUTO_CREATE_AGENT: false, // true: enable auto creation | false: disable auto creation
  MAX_AGENT: 1, //number create new agents
  ETH_EARCH_AGENT: 0.1, //amount eth sepolia to create each agent
};
