const { assert } = require("chai");

const OwnedUpgradeabilityProxy = artifacts.require("OwnedUpgradeabilityProxy");
const Market = artifacts.require("MockMarket");
const Plotus = artifacts.require("MarketRegistry");
const Master = artifacts.require("Master");
const MarketConfig = artifacts.require("MockConfig");
const PlotusToken = artifacts.require("MockPLOT");
const Governance = artifacts.require("Governance");
const TokenController = artifacts.require("TokenController");
const MockchainLinkBTC = artifacts.require("MockChainLinkAggregator");
const BLOT = artifacts.require("BLOT");
const MockUniswapRouter = artifacts.require("MockUniswapRouter");
const AllMarkets = artifacts.require("MockAllMarkets");
const MarketUtility = artifacts.require("MockConfig"); //mock
const MockChainLinkGasPriceAgg = artifacts.require("MockChainLinkGasPriceAgg");
const MemberRoles = artifacts.require("MemberRoles");
const MarketCreationRewards = artifacts.require('MarketCreationRewards');
const BigNumber = require("bignumber.js");
const { increaseTimeTo } = require("./utils/increaseTime.js");

const web3 = Market.web3;
const assertRevert = require("./utils/assertRevert.js").assertRevert;
const increaseTime = require("./utils/increaseTime.js").increaseTime;
const latestTime = require("./utils/latestTime.js").latestTime;
const encode = require("./utils/encoder.js").encode;
const gvProposal = require("./utils/gvProposal.js").gvProposalWithIncentiveViaTokenHolder;
const { toHex, toWei, toChecksumAddress } = require("./utils/ethTools");
// get etherum accounts
// swap ether with LOT
let timeNow,
	marketData,
	expireTme,
	priceOption1,
	priceOption2,
	priceOption3,
	option1RangeMIN,
	option1RangeMAX,
	option2RangeMIN,
	option2RangeMAX,
	option3RangeMIX,
	marketStatus,
	option3RangeMAX, governance,
	marketETHBalanceBeforeDispute,
	marketIncentives;

const ethAddress = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

contract("Market", async function(users) {
	describe("Place the predictions with ether", async () => {
		it("0.0", async () => {
			masterInstance = await OwnedUpgradeabilityProxy.deployed();
			masterInstance = await Master.at(masterInstance.address);
			plotusToken = await PlotusToken.deployed();
			BLOTInstance = await BLOT.deployed();
			MockUniswapRouterInstance = await MockUniswapRouter.deployed();
			plotusNewAddress = await masterInstance.getLatestAddress(web3.utils.toHex("PL"));
			tokenController  =await TokenController.at(await masterInstance.getLatestAddress(web3.utils.toHex("TC")));
			governance = await masterInstance.getLatestAddress(web3.utils.toHex("GV"));
			governance = await Governance.at(governance);
			plotusNewInstance = await Plotus.at(plotusNewAddress);
			marketConfig = await plotusNewInstance.marketUtility();
			marketConfig = await MarketConfig.at(marketConfig);
			// console.log(await plotusNewInstance.getOpenMarkets());
			openMarkets = await plotusNewInstance.getOpenMarkets();
			timeNow = await latestTime();
			marketInstance = await Market.at(openMarkets["_openMarkets"][0]);

			allMarkets = await AllMarkets.deployed();
			marketIncentives = await MarketCreationRewards.deployed();

			marketData = await marketInstance.getData();
			// expireTme = parseFloat(marketData._expireTime);
			// console.log("expireTme", expireTme);
			// console.log("timeNow", timeNow);

			priceOption1 = parseFloat(await marketInstance.getOptionPrice(1));
			priceOption2 = parseFloat(await marketInstance.getOptionPrice(2));
			priceOption3 = parseFloat(await marketInstance.getOptionPrice(3));

			option1RangeMIN = parseFloat(marketData[1][0]);
			option1RangeMAX = parseFloat(marketData[2][0]);
			option2RangeMIN = parseFloat(marketData[1][1]);
			option2RangeMAX = parseFloat(marketData[2][1]);
			option3RangeMIX = parseFloat(marketData[1][2]);
			option3RangeMAX = parseFloat(marketData[2][2]);

			
            newUtility = await MarketUtility.new();
            existingMarkets = await plotusNewInstance.getOpenMarkets();
            actionHash = encode("upgradeContractImplementation(address,address)", marketConfig.address, newUtility.address);
            await gvProposal(6, actionHash, await MemberRoles.at(await masterInstance.getLatestAddress(toHex("MR"))), governance, 2, 0);
            await increaseTime(604800);
            marketConfig = await MarketUtility.at(marketConfig.address);
            let date = await latestTime();
            await increaseTime(3610);
            date = Math.round(date);
            // await marketConfig.setInitialCummulativePrice();
            await marketConfig.setAuthorizedAddress(allMarkets.address);
            let utility = await MarketUtility.at("0xCBc7df3b8C870C5CDE675AaF5Fd823E4209546D2");
            await utility.setAuthorizedAddress(allMarkets.address);
            // await mockUniswapV2Pair.sync();
            let mockChainLinkGasPriceAgg = await MockChainLinkGasPriceAgg.new();
            await increaseTime(5 * 3600);
            await plotusToken.transfer(users[11],toWei(100000));
            await plotusToken.approve(tokenController.address,toWei(200000),{from:users[11]});
            await tokenController.lock(toHex("SM"),toWei(100000),30*3600*24,{from:users[11]});
            await allMarkets.createMarket(0, 0,{from:users[11],gasPrice:500000});
		});

		it("0.1 Assert values from getData()", async () => {
			assert.equal(option1RangeMIN, 0);
			assert.equal(option1RangeMAX, 934999999999);
			assert.equal(option2RangeMIN, 935000000000);
			assert.equal(option2RangeMAX, 937500000000);
			assert.equal(option3RangeMIX, 937500000001);
			assert.equal(option3RangeMAX, 1.157920892373162e77);
			assert.equal(parseFloat(marketData._optionPrice[0]), priceOption1);
			assert.equal(parseFloat(marketData._optionPrice[1]), priceOption2);
			assert.equal(parseFloat(marketData._optionPrice[2]), priceOption3);
			assert.equal(marketData._marketCurrency, openMarkets._marketCurrencies[0]);
			assert.equal(parseFloat(marketData._ethStaked[0]), 0);
			assert.equal(parseFloat(marketData._ethStaked[1]), 0);
			assert.equal(parseFloat(marketData._ethStaked[2]), 0);
			assert.equal(parseFloat(marketData._predictionTime), 3600);
		});

		it("Scenario 1", async () => {
			// setting option price in eth
			await allMarkets.setOptionPrice(7, 1, 9);
			await allMarkets.setOptionPrice(7, 2, 18);
			await allMarkets.setOptionPrice(7, 3, 27);
			let i;
			for(i=1; i<11;i++){

				await plotusToken.transfer(users[i], toWei(2000));
			    await plotusToken.approve(allMarkets.address, toWei(100000), { from: users[i] });
			    await allMarkets.deposit(toWei(1000), { value: toWei("3"), from: users[i] });
			    await plotusToken.approve(tokenController.address, toWei(100000), { from: users[i] });

			}

			await marketConfig.setPrice(toWei(0.001));
			await marketConfig.setNextOptionPrice(18);
			await allMarkets.placePrediction(7, plotusToken.address, 100*1e8, 2, { from: users[1] });
			await marketConfig.setPrice(toWei(0.002));
			await marketConfig.setNextOptionPrice(18);
			await allMarkets.placePrediction(7, plotusToken.address, 400*1e8, 2, { from: users[2] });
			await marketConfig.setPrice(toWei(0.001));
			await marketConfig.setNextOptionPrice(18);
			await allMarkets.placePrediction(7, plotusToken.address, 210*1e8, 2, { from: users[3] });
			await marketConfig.setPrice(toWei(0.015));
			await marketConfig.setNextOptionPrice(27);
			await allMarkets.placePrediction(7, plotusToken.address, 123*1e8, 3, { from: users[4] });
			await marketConfig.setPrice(toWei(0.012));
			await marketConfig.setNextOptionPrice(9);
			await allMarkets.placePrediction(7, ethAddress, 1e8, 1, { from: users[5] });
			await marketConfig.setPrice(toWei(0.014));
			await marketConfig.setNextOptionPrice(9);
			await allMarkets.placePrediction(7, ethAddress, 2*1e8, 1, { from: users[6] });
			await marketConfig.setPrice(toWei(0.01));
			await marketConfig.setNextOptionPrice(18);
			await allMarkets.placePrediction(7, ethAddress, 1e8, 2, { from: users[7] });
			await marketConfig.setPrice(toWei(0.045));
			await marketConfig.setNextOptionPrice(27);
			await allMarkets.placePrediction(7, ethAddress, 3*1e8, 3, { from: users[8] });
			await marketConfig.setPrice(toWei(0.051));
			await marketConfig.setNextOptionPrice(27);
			await allMarkets.placePrediction(7, ethAddress, 1e8, 3, { from: users[9] });
			await marketConfig.setPrice(toWei(0.012));
			await marketConfig.setNextOptionPrice(9);
			await allMarkets.placePrediction(7, ethAddress, 2*1e8, 2, { from: users[10] });

			let options=[2,2,2,3,1,1,2,3,3,2];

			for(i=1;i<11;i++)
			{
				console.log("user "+i+" bet points: ",(await allMarkets.getUserPredictionPoints(users[i],7,options[i-1]))/1);
				let unusedBal = await allMarkets.getUserUnusedBalance(users[i]);
				console.log("user "+i+" unused balance: ",unusedBal[0]/1e18, "   ", unusedBal[2]/1e18);
			}

			await increaseTime(5*60*60);

			await allMarkets.postResultMock(1,7);

			await increaseTime(60*61);

			for(i=1;i<11;i++)
			{
				let reward = await allMarkets.getReturn(users[i],7);
				console.log("User "+i+" rewards: "+ (reward[0][0])/1e8+ "  "+reward[0][1]);
			}
			let marketCreatorReward = await marketIncentives.getPendingMarketCreationRewards(users[11]);
			console.log("Market creator reward: ",marketCreatorReward[0],  marketCreatorReward[1]/1e18,"  ",marketCreatorReward[2]/1e18);
		});
	});
});
