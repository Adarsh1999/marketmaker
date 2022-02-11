require('dotenv').config();
const ccxt = require('ccxt');
const axios = require("axios");

const tick = async (config, bittrueClient) => {
  const { asset, base, spread, allocation } = config;
  const market = `${asset}/${base}`;

  // Cancel open orders left from previou tick, if any
  const orders = await bittrueClient.fetchOpenOrders(market);
  // orders.forEach(async order => {
  //   await bittrueClient.cancelOrder(order.id);
  // });

  // Fetch current market prices
  const results = await Promise.all([
    axios.get('https://api.coingecko.com/api/v3/simple/price?ids=affyn&vs_currencies=usd'),
    axios.get('https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=usd')
  ]);
  const marketPrice = results[0].data.affyn.usd / results[1].data.tether.usd;

  // Calculate new orders parameters
  const sellPrice = marketPrice * (1 + spread);
  const buyPrice = marketPrice * (1 - spread);
  const balances = await bittrueClient.fetchBalance();
  const assetBalance = balances.free[asset]; // e.g. 0.01 BTC
  const baseBalance = balances.free[base]; // e.g. 20 USDT
  const sellVolume = assetBalance * allocation;
  const buyVolume = (baseBalance * allocation) / marketPrice;

  //Send orders
  await bittrueClient.createLimitSellOrder(market, sellVolume, sellPrice);
  await bittrueClient.createLimitBuyOrder(market, buyVolume, buyPrice);

  console.log(`
    New tick for ${market}...
    Created limit sell order for ${sellVolume}@${sellPrice}  
    Created limit buy order for ${buyVolume}@${buyPrice}  
  `);
};

const run = () => {
  const config = { 
    asset: "FYN",
    base: "USDT",
    allocation: 0.5,     // Percentage of our available funds that we trade
    spread: 0.02,         // Percentage above and below market prices for sell and buy orders 
    tickInterval: 2000  // Duration between each tick, in milliseconds
  };
  const bittrueClient = new ccxt.bitrue({
    apiKey: process.env.API_KEY,
    secret: process.env.API_SECRET
  });
  tick(config, bittrueClient);
  setInterval(tick, config.tickInterval, config, bittrueClient);
};

run();
